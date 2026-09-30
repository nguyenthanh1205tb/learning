# 📚 Bài 9: Message Queue & Xử lý bất đồng bộ - Đừng bắt người dùng phải chờ

## 🎯 Mục tiêu bài học

Khi bạn bấm "Đặt hàng" trên một sàn thương mại điện tử, phía sau có cả chục việc phải làm: trừ tồn kho, thu tiền, gửi email, tạo hoá đơn PDF, cộng điểm thưởng, báo cho kho đóng gói, cập nhật báo cáo... Nếu API bắt bạn **chờ hết** những việc đó (có việc mất vài giây, có việc phụ thuộc dịch vụ bên ngoài hay bị lỗi), trải nghiệm sẽ rất tệ và hệ thống rất mong manh.

**Message queue** (hàng đợi tin nhắn) cho phép ta nói: *"Đơn của bạn đã được ghi nhận"* ngay lập tức, còn các việc còn lại được **xếp hàng** và xử lý **bất đồng bộ** (asynchronous) ở phía sau - đáng tin cậy, có retry, không mất việc nào.

Sau bài này bạn sẽ:

- Phân biệt xử lý **đồng bộ** và **bất đồng bộ**, biết **vì sao** và **khi nào** cần queue
- Phân biệt **queue (point-to-point)** và **pub/sub**
- Hiểu **RabbitMQ**: exchange (direct/topic/fanout), binding, ack, prefetch, dead letter exchange
- Hiểu **Kafka**: topic, partition, offset, consumer group, thứ tự, retention
- Nắm 3 **delivery semantics** và viết **consumer idempotent**
- Giải quyết bài toán **dual write** bằng **transactional outbox** và **inbox**
- Làm **retry với exponential backoff** và **dead letter queue**
- Dùng **background job** (Celery/RQ, asynq), hiểu **event-driven**, **event sourcing**, **CQRS**, **saga**
- Xử lý **backpressure** và thiết kế luồng **xử lý đơn hàng bất đồng bộ** hoàn chỉnh

!!! note "Môi trường chạy ví dụ"
    Các ví dụ in-process (worker pool + retry + DLQ, consumer idempotent, transactional outbox) được **chạy thật** với Go 1.24 và Python 3.11 - Python dùng `sqlite3` có sẵn, Go dùng dữ liệu trong bộ nhớ. Code dùng broker thật (RabbitMQ `amqp091-go`/`pika`, Kafka `kafka-go`/`confluent-kafka`, `asynq`, Celery) là **ví dụ minh hoạ** - output được đánh dấu "(ví dụ)".

## 🧪 0. Chuẩn bị môi trường (tuỳ chọn, cho phần broker)

```bash
# RabbitMQ 4 + giao diện quản trị ở http://localhost:15672 (guest/guest)
docker run -d --name rabbit -p 5672:5672 -p 15672:15672 rabbitmq:4-management

# Kafka 4 chế độ KRaft (không cần ZooKeeper), 1 node
docker run -d --name kafka -p 9092:9092 apache/kafka:4.0.0

# Thư viện client
go get github.com/rabbitmq/amqp091-go github.com/segmentio/kafka-go github.com/hibiken/asynq
pip install pika confluent-kafka celery redis
```

## 📖 1. Đồng bộ vs bất đồng bộ

### 1.1 Cách làm đồng bộ - mọi thứ trong một request

```mermaid
sequenceDiagram
    participant U as Người dùng
    participant API as Order API
    participant P as Payment
    participant E as Email
    participant PDF as Hoá đơn PDF
    U->>API: POST /orders
    API->>P: thu tiền (300ms)
    P-->>API: OK
    API->>E: gửi email (800ms)
    E-->>API: OK
    API->>PDF: tạo PDF (1500ms)
    PDF-->>API: OK
    API-->>U: 201 Created (sau ~2,7 giây)
```

Ba vấn đề:

1. **Chậm**: độ trễ = **tổng** độ trễ mọi bước. Người dùng chờ 2,7 giây cho những việc họ không cần chờ (email có thể đến sau 10 giây cũng được).
2. **Mong manh**: dịch vụ email sập → **đặt hàng thất bại**, dù tiền đã thu! Độ sẵn sàng của API = **tích** độ sẵn sàng các phụ thuộc: `99,9% × 99,9% × 99,9% ≈ 99,7%`.
3. **Gắn chặt (coupling)**: thêm việc "cộng điểm thưởng" phải sửa và deploy lại Order API.

### 1.2 Cách làm bất đồng bộ - làm việc cần thiết, xếp hàng việc còn lại

```mermaid
sequenceDiagram
    participant U as Người dùng
    participant API as Order API
    participant Q as Message Queue
    participant W as Workers
    U->>API: POST /orders
    API->>API: lưu đơn (status = PENDING)
    API->>Q: publish "order.created"
    API-->>U: 202 Accepted (sau ~50ms)
    Q->>W: giao message
    W->>W: thu tiền, gửi email, tạo PDF...
    Note over U,W: Người dùng xem trạng thái đơn qua polling / WebSocket / push
```

> 💡 **Ví von**: Quán trà sữa đông khách. Kiểu đồng bộ: thu ngân nhận order xong **tự đi pha** rồi mới phục vụ người tiếp theo - hàng dài dằng dặc. Kiểu bất đồng bộ: thu ngân nhận tiền, **in phiếu order dán lên thanh ray** (queue), đưa bạn **số thứ tự**, rồi phục vụ người tiếp theo ngay. Ba nhân viên pha chế (worker) lấy phiếu theo thứ tự mà làm. Đông khách thì thêm người pha chế, thu ngân không cần làm nhanh hơn.

!!! warning "Không phải việc gì cũng nên bất đồng bộ"
    Nếu người dùng **cần kết quả ngay** để đi tiếp (kiểm tra mật khẩu đăng nhập, xem số dư, kiểm tra mã giảm giá), hãy làm đồng bộ. Async làm hệ thống phức tạp hơn: phải xử lý trạng thái "đang xử lý", retry, message trùng, thứ tự... Chỉ dùng khi lợi ích rõ ràng.

## 📖 2. Vì sao cần message queue?

| Lợi ích | Giải thích | Ví dụ |
|---|---|---|
| **Giảm độ trễ** cho người dùng | Trả lời ngay, việc nặng làm sau | Upload video → trả 202, encode sau |
| **Tách rời (decoupling)** | Producer không cần biết ai xử lý, bao nhiêu consumer | Thêm service "cộng điểm" chỉ cần subscribe thêm |
| **San tải (load leveling)** | Queue là "bể chứa" hấp thụ đỉnh traffic, worker xử lý với tốc độ ổn định | Flash sale 0h: 50.000 đơn/phút, worker xử lý 5.000 đơn/phút, 10 phút là hết hàng đợi |
| **Chịu lỗi** | Consumer sập thì message **nằm chờ** trong queue, sống lại xử lý tiếp | Email service bảo trì 30 phút không mất email nào |
| **Retry** | Lỗi tạm thời → thử lại tự động | Cổng thanh toán timeout |
| **Scale độc lập** | Thêm worker cho khâu chậm, không đụng khâu khác | Tạo PDF chậm → tăng lên 20 worker PDF |

```mermaid
flowchart LR
    subgraph sg1 ["Traffic vào (không đều)"]
        T["Đỉnh 50.000 req/phút<br/>lúc 0h flash sale"]
    end
    T --> Q[["Queue<br/>(bể chứa)"]]
    Q --> W1["Worker 1"]
    Q --> W2["Worker 2"]
    Q --> W3["Worker N"]
    W1 --> DB[("DB - chỉ chịu<br/>5.000 req/phút đều đặn")]
    W2 --> DB
    W3 --> DB
```

## 📖 3. Queue (point-to-point) vs Pub/Sub

Hai mô hình giao message cơ bản:

```mermaid
flowchart LR
    subgraph sg2 ["Point-to-point (work queue)"]
        P1["Producer"] --> Q1[["Queue"]]
        Q1 -->|"msg 1"| C1["Worker A"]
        Q1 -->|"msg 2"| C2["Worker B"]
    end
    subgraph sg3 ["Pub/Sub (broadcast)"]
        P2["Producer"] --> T[["Topic order.created"]]
        T -->|"bản sao"| S1["Email service"]
        T -->|"bản sao"| S2["Inventory service"]
        T -->|"bản sao"| S3["Analytics"]
    end
```

| | Point-to-point | Pub/Sub |
|---|---|---|
| Mỗi message được xử lý bởi | **Một** consumer | **Mọi** subscriber (mỗi bên một bản) |
| Mục đích | Chia việc cho nhiều worker (**scale**) | Thông báo sự kiện cho nhiều bên (**decouple**) |
| Ví dụ | Hàng đợi "tạo thumbnail ảnh" | Sự kiện "đơn hàng đã tạo" |

Thực tế hai mô hình thường **kết hợp**: sự kiện `order.created` được phát cho nhiều **nhóm** (email, kho, analytics) - pub/sub giữa các nhóm; trong mỗi nhóm có nhiều worker chia nhau xử lý - point-to-point trong nhóm. Đây chính là **consumer group** của Kafka, hoặc "mỗi service một queue bind vào cùng exchange" của RabbitMQ.

Thuật ngữ hay gặp:

- **Command** (lệnh): "hãy làm X" - gửi cho **một** người nhận cụ thể, ví dụ `SendEmail`, `ChargePayment`. Tên dạng mệnh lệnh.
- **Event** (sự kiện): "X **đã** xảy ra" - phát cho **ai quan tâm**, người phát không biết ai nghe. Tên ở thì quá khứ: `OrderCreated`, `PaymentFailed`.

## 📖 4. RabbitMQ - người đưa thư thông minh

**RabbitMQ** là message broker theo giao thức **AMQP**. Điểm đặc biệt: producer **không gửi thẳng vào queue** mà gửi vào một **exchange** (bưu cục), exchange dựa vào **routing key** và các **binding** (quy tắc phân loại) để chuyển message vào đúng queue.

```mermaid
flowchart LR
    P["Producer"] -->|"routing key"| X{"Exchange"}
    X -->|"binding"| Q1[["Queue A"]]
    X -->|"binding"| Q2[["Queue B"]]
    Q1 --> C1["Consumer"]
    Q2 --> C2["Consumer"]
```

### 4.1 Các loại exchange

```mermaid
flowchart LR
    subgraph sg4 ["direct: khớp CHÍNH XÁC routing key"]
        PD["key = pdf"] --> XD{"direct"}
        XD -->|"pdf"| QD1[["pdf-jobs"]]
        XD -.->|"email"| QD2[["email-jobs"]]
    end
    subgraph sg5 ["topic: khớp THEO MẪU"]
        PT["key = order.created.vn"] --> XT{"topic"}
        XT -->|"order.created.*"| QT1[["email"]]
        XT -->|"order.#"| QT2[["analytics"]]
        XT -.->|"payment.#"| QT3[["accounting"]]
    end
    subgraph sg6 ["fanout: gửi cho TẤT CẢ"]
        PF["key bị bỏ qua"] --> XF{"fanout"}
        XF --> QF1[["cache-invalidate-1"]]
        XF --> QF2[["cache-invalidate-2"]]
    end
```

| Exchange | Quy tắc định tuyến | Dùng khi |
|---|---|---|
| **direct** | Routing key == binding key | Phân loại job theo tên: `pdf`, `email`, `sms` |
| **topic** | Mẫu với `*` (đúng **1** từ) và `#` (**0 hoặc nhiều** từ), các từ cách nhau bằng dấu chấm | Sự kiện có cấu trúc: `order.created.vn`, `order.cancelled.th` |
| **fanout** | Gửi vào **mọi** queue đã bind, bỏ qua routing key | Broadcast: xoá cache ở mọi instance, thông báo cấu hình mới |
| **headers** | So khớp theo header của message | Hiếm dùng |

Ví dụ với topic exchange, message key `order.created.vn`:

- `order.created.*` → khớp ✅ (`*` = `vn`)
- `order.#` → khớp ✅ (`#` = `created.vn`)
- `*.created` → không khớp ❌ (thiếu 1 từ)
- `#` → khớp tất cả ✅

### 4.2 Ack, prefetch và độ bền

**Acknowledgement (ack)**: consumer nhận message rồi xử lý; **chỉ khi xử lý xong** mới gửi `ack` → broker xoá message. Nếu consumer chết trước khi ack (mất kết nối), broker **giao lại** message cho consumer khác.

- `auto-ack` (ack ngay khi nhận): nhanh nhưng consumer chết giữa chừng là **mất message**. Tránh dùng cho việc quan trọng.
- `ack` thủ công sau khi xử lý xong: an toàn, nhưng message có thể bị **giao trùng** (xử lý xong, chết trước khi kịp ack) → consumer phải **idempotent** (mục 6).
- `nack`/`reject` với `requeue=false` → message đi tới **dead letter exchange** (nếu có cấu hình).

**Prefetch** (`basic.qos`): số message tối đa broker giao cho một consumer **chưa ack**. Không đặt prefetch → broker dồn hết hàng nghìn message cho consumer đầu tiên, các consumer khác ngồi chơi, còn consumer kia có thể hết RAM. Giá trị thường dùng: 10-100 cho việc nhanh, 1 cho việc rất nặng.

**Độ bền** - để message sống sót khi RabbitMQ restart cần đủ 3 thứ:

1. Queue `durable` (nên dùng **quorum queue** - nhân bản trên nhiều node theo Raft).
2. Message `persistent` (`delivery_mode = 2`).
3. **Publisher confirms**: broker xác nhận đã lưu message thì producer mới coi là gửi xong.

### 4.3 Dead Letter Exchange (DLX)

Message bị `reject`/`nack` (không requeue), **hết TTL**, hoặc queue bị **đầy** sẽ được chuyển tới exchange được khai báo trong `x-dead-letter-exchange` - "phòng chứa thư không gửi được" để người vận hành xem xét.

```mermaid
flowchart LR
    X{"orders exchange"} --> Q[["email.order-created<br/>x-dead-letter-exchange = orders.dlx"]]
    Q --> C["Consumer"]
    C -->|"nack, requeue=false"| Q
    Q -->|"message chết"| DLX{"orders.dlx"}
    DLX --> DLQ[["email.order-created.dlq"]]
    DLQ --> OPS["Dashboard / cảnh báo<br/>/ replay thủ công"]
```

### 4.4 Code RabbitMQ

=== "Go"

    ```go
    package main

    import (
    	"context"
    	"log"
    	"time"

    	amqp "github.com/rabbitmq/amqp091-go"
    )

    func main() {
    	conn, err := amqp.Dial("amqp://guest:guest@localhost:5672/")
    	if err != nil {
    		log.Fatal(err)
    	}
    	defer conn.Close()
    	ch, _ := conn.Channel()
    	defer ch.Close()

    	// Khai báo topology (idempotent: chạy nhiều lần không sao)
    	ch.ExchangeDeclare("orders", "topic", true, false, false, false, nil)
    	ch.ExchangeDeclare("orders.dlx", "fanout", true, false, false, false, nil)
    	ch.QueueDeclare("email.order-created.dlq", true, false, false, false, nil)
    	ch.QueueBind("email.order-created.dlq", "", "orders.dlx", false, nil)
    	ch.QueueDeclare("email.order-created", true, false, false, false, amqp.Table{
    		"x-queue-type":           "quorum",
    		"x-dead-letter-exchange": "orders.dlx",
    	})
    	ch.QueueBind("email.order-created", "order.created.*", "orders", false, nil)

    	// Producer
    	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    	defer cancel()
    	err = ch.PublishWithContext(ctx, "orders", "order.created.vn", false, false, amqp.Publishing{
    		ContentType:  "application/json",
    		DeliveryMode: amqp.Persistent,
    		MessageId:    "evt-1001", // id duy nhất để consumer chống trùng
    		Body:         []byte(`{"order_id":1001,"amount":250000}`),
    	})
    	if err != nil {
    		log.Fatal(err)
    	}

    	// Consumer: ack thủ công + prefetch
    	ch.Qos(10, 0, false)
    	msgs, _ := ch.Consume("email.order-created", "", false /* autoAck */, false, false, false, nil)
    	for d := range msgs {
    		if err := sendEmail(d.Body); err != nil {
    			d.Nack(false, false) // requeue=false -> đi vào DLX
    			continue
    		}
    		d.Ack(false)
    	}
    }

    func sendEmail(body []byte) error {
    	log.Printf("gửi email cho đơn %s", body)
    	return nil
    }
    ```

=== "Python"

    ```python
    import json

    import pika

    conn = pika.BlockingConnection(pika.ConnectionParameters("localhost"))
    ch = conn.channel()

    # Khai báo topology (idempotent: chạy nhiều lần không sao)
    ch.exchange_declare(exchange="orders", exchange_type="topic", durable=True)
    ch.exchange_declare(exchange="orders.dlx", exchange_type="fanout", durable=True)
    ch.queue_declare(queue="email.order-created.dlq", durable=True)
    ch.queue_bind(queue="email.order-created.dlq", exchange="orders.dlx")
    ch.queue_declare(queue="email.order-created", durable=True, arguments={
        "x-queue-type": "quorum",
        "x-dead-letter-exchange": "orders.dlx",
    })
    ch.queue_bind(queue="email.order-created", exchange="orders",
                  routing_key="order.created.*")

    # Producer
    ch.confirm_delivery()                        # bật publisher confirms
    ch.basic_publish(
        exchange="orders",
        routing_key="order.created.vn",
        body=json.dumps({"order_id": 1001, "amount": 250000}),
        properties=pika.BasicProperties(
            content_type="application/json",
            delivery_mode=2,                     # persistent
            message_id="evt-1001",               # id duy nhất để consumer chống trùng
        ),
    )


    # Consumer: ack thủ công + prefetch
    def on_message(channel, method, props, body):
        try:
            print("gửi email cho đơn", json.loads(body)["order_id"])
            channel.basic_ack(delivery_tag=method.delivery_tag)
        except Exception:
            channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)  # -> DLX


    ch.basic_qos(prefetch_count=10)
    ch.basic_consume(queue="email.order-created", on_message_callback=on_message)
    ch.start_consuming()
    ```

```text
gửi email cho đơn 1001
```

Output (ví dụ).

## 📖 5. Kafka - cuốn sổ nhật ký phân tán

**Apache Kafka** có tư duy khác hẳn RabbitMQ. RabbitMQ là "bưu cục": thư giao xong là **xoá**. Kafka là **cuốn sổ ghi chép chỉ được viết thêm** (append-only log): message được **giữ lại** theo thời gian cấu hình (ví dụ 7 ngày) dù đã có người đọc, và mỗi consumer tự nhớ **mình đã đọc đến dòng nào**.

### 5.1 Topic, partition, offset

- **Topic**: một dòng sự kiện có tên, ví dụ `order-events`.
- **Partition**: topic được chia thành nhiều **log con** độc lập, nằm rải trên nhiều broker → ghi/đọc song song. Mỗi partition được **nhân bản** (replication factor, thường 3).
- **Offset**: số thứ tự của message **trong một partition** (0, 1, 2...). Thứ tự chỉ được đảm bảo **trong cùng partition**.
- **Key**: producer gửi message kèm key (ví dụ `order_id`); `hash(key) % số_partition` quyết định partition → mọi sự kiện của **cùng một đơn** luôn vào **cùng partition** → **đúng thứ tự** với nhau.

```mermaid
flowchart LR
    P["Producer<br/>key = order_id"] --> T0
    P --> T1
    P --> T2
    subgraph sg7 ["Topic order-events"]
        T0["Partition 0: offset 0 1 2 3 4 5"]
        T1["Partition 1: offset 0 1 2 3"]
        T2["Partition 2: offset 0 1 2 3 4"]
    end
    subgraph sg8 ["Consumer group: email-service"]
        E1["Consumer 1"]
        E2["Consumer 2"]
    end
    subgraph sg9 ["Consumer group: analytics"]
        A1["Consumer 1"]
    end
    T0 --> E1
    T1 --> E1
    T2 --> E2
    T0 --> A1
    T1 --> A1
    T2 --> A1
```

### 5.2 Consumer group

- Mỗi **consumer group** nhận **toàn bộ** message của topic (pub/sub giữa các group).
- Trong một group, mỗi partition được giao cho **đúng một** consumer (point-to-point trong group).
- ⇒ **Số consumer hữu ích tối đa trong group = số partition**. Topic 3 partition mà chạy 5 consumer thì 2 consumer ngồi chơi. Vì vậy hãy chọn số partition đủ lớn ngay từ đầu (tăng được nhưng sẽ làm đổi ánh xạ key → partition).
- Consumer thêm/bớt → **rebalance**: chia lại partition giữa các consumer.
- Mỗi group **commit offset** của mình ("tôi đã xử lý đến offset 1234 của partition 2"). Consumer chết, người thay thế đọc tiếp từ offset đã commit.

!!! tip "Replay - siêu năng lực của Kafka"
    Vì message không bị xoá khi đọc, bạn có thể **tua lại** offset để xử lý lại dữ liệu cũ: sửa bug trong service analytics rồi chạy lại từ đầu tuần; tạo service mới và cho nó đọc toàn bộ lịch sử. RabbitMQ (queue cổ điển) không làm được điều này.

### 5.3 Retention và độ bền

| Cấu hình | Ý nghĩa |
|---|---|
| `retention.ms=604800000` | Giữ message 7 ngày rồi xoá (theo segment) |
| `retention.bytes` | Giới hạn dung lượng mỗi partition |
| `cleanup.policy=compact` | **Log compaction**: chỉ giữ message **mới nhất cho mỗi key** - hợp với dữ liệu dạng "trạng thái hiện tại" (hồ sơ user, cấu hình) |
| `replication.factor=3` | Mỗi partition có 3 bản trên 3 broker |
| `min.insync.replicas=2` | Ghi chỉ thành công khi ≥ 2 bản đã nhận |
| producer `acks=all` | Producer chờ mọi replica đồng bộ xác nhận - bền nhất |
| producer `enable.idempotence=true` | Producer retry không tạo message trùng trong partition |

Từ Kafka 4.0, Kafka chạy hoàn toàn ở chế độ **KRaft** (tự quản lý metadata bằng Raft), không còn cần ZooKeeper.

### 5.4 Code Kafka

=== "Go"

    ```go
    package main

    import (
    	"context"
    	"log"

    	"github.com/segmentio/kafka-go"
    )

    func main() {
    	ctx := context.Background()

    	// Producer: cùng key -> cùng partition -> đúng thứ tự
    	w := &kafka.Writer{
    		Addr:         kafka.TCP("localhost:9092"),
    		Topic:        "order-events",
    		Balancer:     &kafka.Hash{},
    		RequiredAcks: kafka.RequireAll,
    	}
    	defer w.Close()
    	err := w.WriteMessages(ctx,
    		kafka.Message{Key: []byte("order-1001"), Value: []byte(`{"type":"OrderCreated"}`)},
    		kafka.Message{Key: []byte("order-1001"), Value: []byte(`{"type":"OrderPaid"}`)},
    	)
    	if err != nil {
    		log.Fatal(err)
    	}

    	// Consumer trong group "email-service", commit offset THỦ CÔNG sau khi xử lý
    	r := kafka.NewReader(kafka.ReaderConfig{
    		Brokers: []string{"localhost:9092"},
    		GroupID: "email-service",
    		Topic:   "order-events",
    	})
    	defer r.Close()
    	for {
    		m, err := r.FetchMessage(ctx)
    		if err != nil {
    			log.Fatal(err)
    		}
    		log.Printf("partition=%d offset=%d key=%s value=%s", m.Partition, m.Offset, m.Key, m.Value)
    		if err := r.CommitMessages(ctx, m); err != nil { // xử lý xong mới commit
    			log.Fatal(err)
    		}
    	}
    }
    ```

=== "Python"

    ```python
    import json

    from confluent_kafka import Consumer, Producer

    # Producer: cùng key -> cùng partition -> đúng thứ tự
    p = Producer({"bootstrap.servers": "localhost:9092",
                  "acks": "all", "enable.idempotence": True})
    p.produce("order-events", key="order-1001", value=json.dumps({"type": "OrderCreated"}))
    p.produce("order-events", key="order-1001", value=json.dumps({"type": "OrderPaid"}))
    p.flush()

    # Consumer trong group "email-service", commit offset THỦ CÔNG sau khi xử lý
    c = Consumer({"bootstrap.servers": "localhost:9092",
                  "group.id": "email-service",
                  "auto.offset.reset": "earliest",
                  "enable.auto.commit": False})
    c.subscribe(["order-events"])
    try:
        while True:
            msg = c.poll(1.0)
            if msg is None:
                continue
            if msg.error():
                print("lỗi:", msg.error())
                continue
            print(f"partition={msg.partition()} offset={msg.offset()} "
                  f"key={msg.key().decode()} value={msg.value().decode()}")
            c.commit(message=msg, asynchronous=False)   # xử lý xong mới commit
    finally:
        c.close()
    ```

```text
partition=2 offset=0 key=order-1001 value={"type":"OrderCreated"}
partition=2 offset=1 key=order-1001 value={"type":"OrderPaid"}
```

Output (ví dụ) - hai sự kiện của cùng đơn nằm cùng partition, offset liên tiếp.

### 5.5 Chọn broker nào?

| | RabbitMQ | Kafka | Redis Streams | Cloud (SQS/SNS, Pub/Sub) |
|---|---|---|---|---|
| Mô hình | Queue + routing linh hoạt | Log phân tán, giữ lại message | Log nhẹ trong Redis | Queue/pub-sub được quản lý sẵn |
| Message sau khi xử lý | Bị xoá | **Giữ lại** theo retention, replay được | Giữ đến khi `XTRIM` | Bị xoá |
| Thứ tự | Trong 1 queue (1 consumer) | Trong 1 partition | Trong 1 stream | SQS FIFO có (giới hạn) |
| Thông lượng | Chục nghìn msg/s/node | Hàng trăm nghìn - triệu msg/s | Cao, giới hạn bởi RAM | Tự scale |
| Điểm mạnh | Routing, retry, priority, TTL, dễ bắt đầu | Event streaming, analytics, replay, nhiều consumer group | Đã có Redis sẵn, đơn giản | Không phải vận hành |
| Hợp với | **Task queue**, command giữa service | **Event bus**, pipeline dữ liệu, CDC, log | Hệ thống nhỏ-vừa | Team nhỏ trên cloud |

!!! tip "Lời khuyên thực dụng"
    Hệ thống nhỏ đã có Redis/PostgreSQL: bắt đầu với **job queue trên Redis** (asynq, RQ, Celery) hoặc thậm chí bảng Postgres + `SELECT ... FOR UPDATE SKIP LOCKED`. Cần routing phức tạp, task queue nghiêm túc → **RabbitMQ**. Cần event streaming, nhiều team cùng đọc một dòng sự kiện, replay → **Kafka**.

## 📖 6. Delivery semantics và consumer idempotent

### 6.1 Ba mức đảm bảo giao nhận

| Mức | Nghĩa | Cách đạt được | Rủi ro |
|---|---|---|---|
| **At-most-once** | Tối đa 1 lần - có thể **mất** | Ack/commit **trước** khi xử lý | Consumer chết giữa chừng → mất message |
| **At-least-once** | Ít nhất 1 lần - có thể **trùng** | Ack/commit **sau** khi xử lý | Xử lý xong, chết trước khi ack → giao lại |
| **Exactly-once** | Đúng 1 lần | Rất khó trên đường truyền mạng | - |

Vì sao trùng lặp là **không tránh khỏi** với at-least-once:

```mermaid
sequenceDiagram
    participant B as Broker
    participant C as Consumer
    participant D as Database
    B->>C: message evt-2 (cộng 50.000đ)
    C->>D: UPDATE balance = balance + 50000
    D-->>C: OK
    C--xB: ACK bị mất (mạng chập / consumer bị kill)
    Note over B: Không nhận được ACK -> coi như chưa xử lý
    B->>C: giao lại evt-2
    C->>D: UPDATE balance = balance + 50000 (LẦN 2!)
```

!!! note "Exactly-once trong thực tế = at-least-once + idempotent"
    Kafka có "exactly-once semantics" (idempotent producer + transaction) nhưng chỉ đúng **trong phạm vi Kafka** (đọc từ topic → ghi sang topic). Khi consumer ghi vào database, gửi email, gọi API bên ngoài thì phải tự lo. Công thức chuẩn của ngành: **giao at-least-once, xử lý idempotent** → hiệu quả như "exactly-once" (effectively-once).

### 6.2 Consumer idempotent

**Idempotent** = xử lý 1 lần hay N lần cho **cùng kết quả**. Các cách:

1. **Bảng chống trùng (inbox / processed_messages)**: lưu `message_id` đã xử lý với `PRIMARY KEY`; ghi bảng này **trong cùng transaction** với thay đổi nghiệp vụ. Trùng → vi phạm khoá → bỏ qua.
2. **Thao tác tự nhiên idempotent**: `SET status = 'PAID'` (idempotent) thay vì `balance = balance + x` (không idempotent); `INSERT ... ON CONFLICT DO NOTHING`; upsert theo khoá nghiệp vụ.
3. **Kiểm tra trạng thái / version**: chỉ chuyển đơn sang `SHIPPED` nếu đang `PAID`; `UPDATE ... WHERE version = 7`.
4. **Idempotency key khi gọi bên ngoài**: cổng thanh toán (Stripe, VNPay...) nhận `Idempotency-Key` - gọi lại với cùng key sẽ không trừ tiền lần 2 (xem [Bài 3](./03-api-design.md)).

Ví dụ chạy thật: broker giao `evt-2` **ba lần**. Consumer "ngây thơ" cộng tiền 3 lần; consumer idempotent chỉ cộng 1 lần. Bản Python dùng SQLite với bảng `inbox` và transaction thật:

=== "Go"

    ```go
    package main

    import (
    	"fmt"
    	"sync"
    )

    type Message struct {
    	ID     string // id DUY NHẤT của sự kiện, do producer sinh ra
    	UserID int
    	Amount int
    }

    // Consumer "ngây thơ": cứ nhận là cộng tiền.
    type NaiveConsumer struct{ balance map[int]int }

    func (c *NaiveConsumer) Handle(m Message) { c.balance[m.UserID] += m.Amount }

    // Consumer idempotent: nhớ các message id đã xử lý (bảng "inbox").
    type IdempotentConsumer struct {
    	mu        sync.Mutex
    	balance   map[int]int
    	processed map[string]bool
    }

    func (c *IdempotentConsumer) Handle(m Message) bool {
    	c.mu.Lock() // trong DB thật: 1 transaction gồm INSERT inbox + UPDATE balance
    	defer c.mu.Unlock()
    	if c.processed[m.ID] {
    		return false // đã xử lý rồi -> bỏ qua, nhưng vẫn ACK
    	}
    	c.balance[m.UserID] += m.Amount
    	c.processed[m.ID] = true
    	return true
    }

    func main() {
    	// Broker giao "at-least-once": evt-2 bị giao lại 2 lần (consumer ACK bị mất)
    	deliveries := []Message{
    		{"evt-1", 7, 100_000},
    		{"evt-2", 7, 50_000},
    		{"evt-2", 7, 50_000},
    		{"evt-3", 7, -30_000},
    		{"evt-2", 7, 50_000},
    	}

    	naive := &NaiveConsumer{balance: map[int]int{}}
    	idem := &IdempotentConsumer{balance: map[int]int{}, processed: map[string]bool{}}
    	for _, m := range deliveries {
    		naive.Handle(m)
    		if idem.Handle(m) {
    			fmt.Printf("xử lý  %s: %+d\n", m.ID, m.Amount)
    		} else {
    			fmt.Printf("bỏ qua %s (trùng)\n", m.ID)
    		}
    	}
    	fmt.Println("số dư - consumer ngây thơ:", naive.balance[7])
    	fmt.Println("số dư - consumer idempotent:", idem.balance[7])
    }
    ```

    Output:

    ```text
    xử lý  evt-1: +100000
    xử lý  evt-2: +50000
    bỏ qua evt-2 (trùng)
    xử lý  evt-3: -30000
    bỏ qua evt-2 (trùng)
    số dư - consumer ngây thơ: 220000
    số dư - consumer idempotent: 120000
    ```

=== "Python"

    ```python
    import sqlite3

    db = sqlite3.connect(":memory:")
    db.executescript("""
    CREATE TABLE accounts (user_id INTEGER PRIMARY KEY, balance INTEGER NOT NULL);
    CREATE TABLE inbox (message_id TEXT PRIMARY KEY);   -- các message đã xử lý
    INSERT INTO accounts VALUES (7, 0);
    """)


    def handle(msg):
        """Xử lý idempotent: INSERT inbox + UPDATE balance trong CÙNG 1 transaction."""
        try:
            with db:  # BEGIN ... COMMIT (hoặc ROLLBACK nếu có exception)
                db.execute("INSERT INTO inbox (message_id) VALUES (?)", (msg["id"],))
                db.execute("UPDATE accounts SET balance = balance + ? WHERE user_id = ?",
                           (msg["amount"], msg["user_id"]))
            return True
        except sqlite3.IntegrityError:        # trùng PRIMARY KEY -> đã xử lý rồi
            return False                       # bỏ qua, nhưng vẫn ACK với broker


    # Broker giao "at-least-once": evt-2 bị giao lại 2 lần (consumer ACK bị mất)
    deliveries = [
        {"id": "evt-1", "user_id": 7, "amount": 100_000},
        {"id": "evt-2", "user_id": 7, "amount": 50_000},
        {"id": "evt-2", "user_id": 7, "amount": 50_000},
        {"id": "evt-3", "user_id": 7, "amount": -30_000},
        {"id": "evt-2", "user_id": 7, "amount": 50_000},
    ]

    naive_balance = 0
    for m in deliveries:
        naive_balance += m["amount"]           # consumer "ngây thơ"
        if handle(m):
            print(f"xử lý  {m['id']}: {m['amount']:+d}")
        else:
            print(f"bỏ qua {m['id']} (trùng)")

    balance = db.execute("SELECT balance FROM accounts WHERE user_id = 7").fetchone()[0]
    print("số dư - consumer ngây thơ:", naive_balance)
    print("số dư - consumer idempotent:", balance)
    ```

    Output:

    ```text
    xử lý  evt-1: +100000
    xử lý  evt-2: +50000
    bỏ qua evt-2 (trùng)
    xử lý  evt-3: -30000
    bỏ qua evt-2 (trùng)
    số dư - consumer ngây thơ: 220000
    số dư - consumer idempotent: 120000
    ```

Đúng phải là `100.000 + 50.000 − 30.000 = 120.000`. Consumer ngây thơ ra `220.000` - khách được cộng thêm 100.000đ "từ trên trời rơi xuống".

!!! warning "Kiểm tra rồi mới ghi là KHÔNG đủ"
    `if not exists(id): process(); save(id)` có race condition khi 2 consumer nhận cùng message song song - cả hai đều thấy "chưa có". Hãy để **database đảm bảo** bằng `PRIMARY KEY`/`UNIQUE` + transaction như bản Python, hoặc khoá đúng cách như bản Go.

## 📖 7. Transactional outbox & inbox

### 7.1 Bài toán dual write

Order service cần làm 2 việc: **lưu đơn vào DB** và **publish sự kiện** `OrderCreated`. Hai hệ thống khác nhau, không có transaction chung:

```mermaid
sequenceDiagram
    participant S as Order Service
    participant D as Database
    participant B as Broker
    S->>D: INSERT order (COMMIT)
    D-->>S: OK
    S--xB: publish OrderCreated
    Note over S,B: Service crash / broker timeout
    Note over D,B: Đơn có trong DB nhưng KHÔNG ai biết:<br/>không trừ kho, không gửi email
```

Đảo thứ tự (publish trước, ghi DB sau) cũng hỏng: sự kiện bay đi, nhưng ghi DB thất bại → các service khác xử lý một **đơn không tồn tại**.

### 7.2 Giải pháp: transactional outbox

Ý tưởng: **đừng publish trực tiếp**. Ghi sự kiện vào một bảng `outbox` **trong cùng database, cùng transaction** với đơn hàng. Một tiến trình riêng (**relay**) đọc bảng outbox và publish lên broker, gửi được thì đánh dấu.

```mermaid
sequenceDiagram
    participant S as Order Service
    participant D as Database (orders + outbox)
    participant R as Relay
    participant B as Broker
    participant C as Consumer
    S->>D: BEGIN
    S->>D: INSERT INTO orders ...
    S->>D: INSERT INTO outbox (OrderCreated)
    S->>D: COMMIT (cả hai hoặc không gì cả)
    loop mỗi 500ms
        R->>D: SELECT * FROM outbox WHERE published_at IS NULL
        R->>B: publish OrderCreated
        B-->>R: confirm
        R->>D: UPDATE outbox SET published_at = now()
    end
    B->>C: OrderCreated
    C->>C: xử lý idempotent (inbox)
```

- Đơn lưu thành công ⇔ sự kiện chắc chắn **sẽ** được publish (sớm hay muộn).
- Relay có thể publish **trùng** (gửi xong, sập trước khi `UPDATE`) → đây là at-least-once → consumer phải idempotent (**inbox**, mục 6.2). **Outbox ở đầu gửi + inbox ở đầu nhận** là cặp đôi kinh điển.
- Relay có 2 kiểu: **polling** bảng outbox (đơn giản, như ví dụ dưới) hoặc **CDC** (Change Data Capture) - đọc WAL của PostgreSQL bằng **Debezium** rồi đẩy vào Kafka (độ trễ thấp, không tốn query polling).

Ví dụ chạy thật: đơn thứ 2 không hợp lệ → rollback, **không có cả order lẫn event**; broker sập ở lần relay đầu → event vẫn nằm an toàn trong outbox và được gửi ở lần sau:

=== "Go"

    ```go
    package main

    import (
    	"errors"
    	"fmt"
    	"sync"
    )

    type Order struct {
    	ID     int
    	Amount int
    }

    type OutboxEvent struct {
    	ID        int
    	Topic     string
    	Payload   string
    	Published bool
    }

    // DB giả lập: mutex đóng vai trò transaction - order và event được ghi
    // "cùng lúc", hoặc không cái nào được ghi.
    type DB struct {
    	mu     sync.Mutex
    	orders []Order
    	outbox []OutboxEvent
    	nextID int
    }

    func (db *DB) PlaceOrder(amount int) (int, error) {
    	db.mu.Lock()
    	defer db.mu.Unlock()
    	if amount <= 0 { // lỗi giữa chừng -> "rollback": không ghi gì cả
    		return 0, errors.New("số tiền không hợp lệ")
    	}
    	db.nextID++
    	id := db.nextID
    	db.orders = append(db.orders, Order{id, amount})
    	db.outbox = append(db.outbox, OutboxEvent{
    		ID: id, Topic: "order.created",
    		Payload: fmt.Sprintf(`{"order_id":%d,"amount":%d}`, id, amount),
    	})
    	return id, nil
    }

    // Broker giả lập, có thể "sập" để thử tình huống lỗi.
    type Broker struct {
    	down     bool
    	received []string
    }

    func (b *Broker) Publish(topic, payload string) error {
    	if b.down {
    		return errors.New("broker không phản hồi")
    	}
    	b.received = append(b.received, topic+" "+payload)
    	return nil
    }

    // Relay: đọc các event chưa publish, gửi lên broker, rồi đánh dấu đã gửi.
    func relay(db *DB, b *Broker) {
    	db.mu.Lock()
    	defer db.mu.Unlock()
    	sent := 0
    	for i := range db.outbox {
    		e := &db.outbox[i]
    		if e.Published {
    			continue
    		}
    		if err := b.Publish(e.Topic, e.Payload); err != nil {
    			fmt.Println("  relay: lỗi", err, "-> giữ trong outbox, lần sau gửi lại")
    			return
    		}
    		e.Published = true // nếu sập ngay trước dòng này -> gửi trùng (at-least-once)
    		sent++
    	}
    	fmt.Println("  relay: đã publish", sent, "event")
    }

    func main() {
    	db, broker := &DB{}, &Broker{}

    	for _, amount := range []int{250_000, 0, 120_000} {
    		if id, err := db.PlaceOrder(amount); err != nil {
    			fmt.Println("đặt đơn thất bại:", err, "(không có order, không có event)")
    		} else {
    			fmt.Println("đặt đơn thành công: order", id)
    		}
    	}
    	fmt.Println("số order:", len(db.orders), "| số event trong outbox:", len(db.outbox))

    	broker.down = true
    	fmt.Println("relay lần 1 (broker sập):")
    	relay(db, broker)

    	broker.down = false
    	fmt.Println("relay lần 2 (broker sống lại):")
    	relay(db, broker)
    	fmt.Println("relay lần 3:")
    	relay(db, broker)

    	fmt.Println("broker đã nhận:")
    	for _, m := range broker.received {
    		fmt.Println("  ", m)
    	}
    }
    ```

    Output:

    ```text
    đặt đơn thành công: order 1
    đặt đơn thất bại: số tiền không hợp lệ (không có order, không có event)
    đặt đơn thành công: order 2
    số order: 2 | số event trong outbox: 2
    relay lần 1 (broker sập):
      relay: lỗi broker không phản hồi -> giữ trong outbox, lần sau gửi lại
    relay lần 2 (broker sống lại):
      relay: đã publish 2 event
    relay lần 3:
      relay: đã publish 0 event
    broker đã nhận:
       order.created {"order_id":1,"amount":250000}
       order.created {"order_id":2,"amount":120000}
    ```

=== "Python"

    ```python
    import json
    import sqlite3

    db = sqlite3.connect(":memory:")
    db.executescript("""
    CREATE TABLE orders (
        id     INTEGER PRIMARY KEY AUTOINCREMENT,
        amount INTEGER NOT NULL CHECK (amount > 0)
    );
    CREATE TABLE outbox (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        topic        TEXT NOT NULL,
        payload      TEXT NOT NULL,
        published_at TEXT                      -- NULL = chưa gửi lên broker
    );
    """)


    def place_order(amount):
        """Ghi order + event trong CÙNG 1 transaction: cả hai hoặc không gì cả."""
        with db:
            cur = db.execute("INSERT INTO orders (amount) VALUES (?)", (amount,))
            order_id = cur.lastrowid
            db.execute("INSERT INTO outbox (topic, payload) VALUES (?, ?)",
                       ("order.created", json.dumps({"order_id": order_id, "amount": amount})))
        return order_id


    class Broker:
        def __init__(self):
            self.down = False
            self.received = []

        def publish(self, topic, payload):
            if self.down:
                raise ConnectionError("broker không phản hồi")
            self.received.append(f"{topic} {payload}")


    def relay(broker):
        """Đọc event chưa gửi, publish, rồi đánh dấu đã gửi."""
        rows = db.execute(
            "SELECT id, topic, payload FROM outbox WHERE published_at IS NULL ORDER BY id"
        ).fetchall()
        sent = 0
        for event_id, topic, payload in rows:
            try:
                broker.publish(topic, payload)
            except ConnectionError as e:
                print(f"  relay: lỗi {e} -> giữ trong outbox, lần sau gửi lại")
                return
            # nếu sập ngay trước lệnh UPDATE này -> lần sau gửi trùng (at-least-once)
            with db:
                db.execute("UPDATE outbox SET published_at = datetime('now') WHERE id = ?",
                           (event_id,))
            sent += 1
        print(f"  relay: đã publish {sent} event")


    broker = Broker()
    for amount in [250_000, 0, 120_000]:
        try:
            print("đặt đơn thành công: order", place_order(amount))
        except sqlite3.IntegrityError as e:
            print(f"đặt đơn thất bại: {e} (không có order, không có event)")

    n_orders = db.execute("SELECT COUNT(*) FROM orders").fetchone()[0]
    n_events = db.execute("SELECT COUNT(*) FROM outbox").fetchone()[0]
    print("số order:", n_orders, "| số event trong outbox:", n_events)

    broker.down = True
    print("relay lần 1 (broker sập):")
    relay(broker)

    broker.down = False
    print("relay lần 2 (broker sống lại):")
    relay(broker)
    print("relay lần 3:")
    relay(broker)

    print("broker đã nhận:")
    for m in broker.received:
        print("  ", m)
    ```

    Output:

    ```text
    đặt đơn thành công: order 1
    đặt đơn thất bại: CHECK constraint failed: amount > 0 (không có order, không có event)
    đặt đơn thành công: order 2
    số order: 2 | số event trong outbox: 2
    relay lần 1 (broker sập):
      relay: lỗi broker không phản hồi -> giữ trong outbox, lần sau gửi lại
    relay lần 2 (broker sống lại):
      relay: đã publish 2 event
    relay lần 3:
      relay: đã publish 0 event
    broker đã nhận:
       order.created {"order_id": 1, "amount": 250000}
       order.created {"order_id": 2, "amount": 120000}
    ```

!!! tip "Vận hành outbox trong production"
    - Nhiều instance relay → dùng `SELECT ... FOR UPDATE SKIP LOCKED LIMIT 100` để mỗi instance lấy một lô khác nhau.
    - Dọn bảng outbox định kỳ (xoá event đã publish quá 7 ngày) để bảng không phình.
    - Muốn đúng thứ tự theo đơn: publish theo thứ tự `id` và dùng `order_id` làm key Kafka.

## 📖 8. Retry, exponential backoff và Dead Letter Queue

### 8.1 Phân loại lỗi

| Loại lỗi | Ví dụ | Xử lý |
|---|---|---|
| **Tạm thời** (transient) | Timeout, 503, mất kết nối DB, rate limit 429 | **Retry** với backoff |
| **Vĩnh viễn** (permanent) | JSON sai định dạng, đơn không tồn tại, validation lỗi | **Không retry** - đưa thẳng vào DLQ |
| **Poison message** | Message làm consumer crash mỗi lần xử lý | Giới hạn số lần giao, rồi DLQ |

### 8.2 Exponential backoff + jitter

Retry ngay lập tức khi dịch vụ đang quá tải chỉ làm nó **sập nặng hơn**. Hãy chờ **tăng dần theo cấp số nhân**: 1s, 2s, 4s, 8s, 16s... (có trần, ví dụ tối đa 5 phút), và cộng **jitter** (ngẫu nhiên) để hàng nghìn consumer không cùng retry đúng một thời điểm.

```text
delay = min(cap, base * 2^(attempt-1))       # exponential
delay = random(0, delay)                     # "full jitter" - khuyến nghị của AWS
```

```mermaid
flowchart LR
    M["Nhận message"] --> P{"Xử lý"}
    P -- "thành công" --> ACK["ACK"]
    P -- "lỗi vĩnh viễn" --> DLQ[["Dead Letter Queue"]]
    P -- "lỗi tạm thời" --> N{"Đã thử đủ<br/>số lần tối đa?"}
    N -- "chưa" --> W["Chờ backoff<br/>1s, 2s, 4s... + jitter"]
    W --> M
    N -- "rồi" --> DLQ
    DLQ --> A["Cảnh báo + xem xét<br/>+ replay sau khi sửa"]
```

### 8.3 Ví dụ chạy thật: worker pool + retry + DLQ

3 worker xử lý 8 job. Job 3 lỗi tạm thời 2 lần rồi thành công; job 5 lỗi mãi (dịch vụ email sập) → sau 4 lần thử vào DLQ; job 7 lỗi vĩnh viễn → vào DLQ **ngay**, không retry. Bản Go đưa job quay lại hàng đợi bằng `time.AfterFunc` (worker không bị chặn khi chờ); bản Python cho gọn nên `sleep` trong worker.

=== "Go"

    ```go
    package main

    import (
    	"errors"
    	"fmt"
    	"sort"
    	"sync"
    	"time"
    )

    type Job struct {
    	ID      int
    	Attempt int // lần thử thứ mấy (bắt đầu từ 1)
    }

    // ErrPermanent: lỗi "vĩnh viễn" (dữ liệu sai) - retry bao nhiêu lần cũng vô ích.
    var ErrPermanent = errors.New("dữ liệu không hợp lệ")

    // process giả lập việc xử lý: vài job lỗi tạm thời, một job lỗi vĩnh viễn.
    func process(j Job) error {
    	switch j.ID {
    	case 3: // lỗi tạm thời, lần thử thứ 3 thì thành công
    		if j.Attempt < 3 {
    			return errors.New("timeout khi gọi cổng thanh toán")
    		}
    	case 5: // dịch vụ email sập suốt
    		return errors.New("email service 503")
    	case 7:
    		return ErrPermanent
    	}
    	return nil
    }

    const maxAttempts = 4

    // Exponential backoff: 10ms, 20ms, 40ms... (thực tế: giây/phút + jitter)
    func backoff(attempt int) time.Duration {
    	return time.Duration(1<<(attempt-1)) * 10 * time.Millisecond
    }

    func main() {
    	jobs := make(chan Job, 100)
    	var (
    		mu      sync.Mutex
    		done    []int
    		dlq     []string
    		logs    []string
    		pending sync.WaitGroup // số job chưa tới trạng thái cuối (xong hoặc DLQ)
    		workers sync.WaitGroup
    	)

    	for w := 1; w <= 3; w++ {
    		workers.Add(1)
    		go func() {
    			defer workers.Done()
    			for j := range jobs {
    				err := process(j)
    				mu.Lock()
    				switch {
    				case err == nil:
    					done = append(done, j.ID)
    					pending.Done()
    				case errors.Is(err, ErrPermanent) || j.Attempt >= maxAttempts:
    					dlq = append(dlq, fmt.Sprintf("job %d (lần %d): %v", j.ID, j.Attempt, err))
    					pending.Done()
    				default:
    					d := backoff(j.Attempt)
    					logs = append(logs, fmt.Sprintf("job %d lần %d lỗi: %v -> thử lại sau %v", j.ID, j.Attempt, err, d))
    					next := Job{ID: j.ID, Attempt: j.Attempt + 1}
    					// Không sleep trong worker: hẹn giờ đưa job quay lại hàng đợi
    					time.AfterFunc(d, func() { jobs <- next })
    				}
    				mu.Unlock()
    			}
    		}()
    	}

    	for i := 1; i <= 8; i++ {
    		pending.Add(1)
    		jobs <- Job{ID: i, Attempt: 1}
    	}
    	pending.Wait() // chờ mọi job xong hoặc vào DLQ
    	close(jobs)
    	workers.Wait()

    	sort.Strings(logs) // các worker chạy song song: sắp xếp để output ổn định
    	sort.Ints(done)
    	for _, l := range logs {
    		fmt.Println(l)
    	}
    	fmt.Println("thành công:", done)
    	fmt.Println("dead letter queue:")
    	sort.Strings(dlq)
    	for _, d := range dlq {
    		fmt.Println("  -", d)
    	}
    }
    ```

    Output:

    ```text
    job 3 lần 1 lỗi: timeout khi gọi cổng thanh toán -> thử lại sau 10ms
    job 3 lần 2 lỗi: timeout khi gọi cổng thanh toán -> thử lại sau 20ms
    job 5 lần 1 lỗi: email service 503 -> thử lại sau 10ms
    job 5 lần 2 lỗi: email service 503 -> thử lại sau 20ms
    job 5 lần 3 lỗi: email service 503 -> thử lại sau 40ms
    thành công: [1 2 3 4 6 8]
    dead letter queue:
      - job 5 (lần 4): email service 503
      - job 7 (lần 1): dữ liệu không hợp lệ
    ```

=== "Python"

    ```python
    import queue
    import threading
    import time


    class PermanentError(Exception):
        """Lỗi 'vĩnh viễn' (dữ liệu sai) - retry bao nhiêu lần cũng vô ích."""


    def process(job_id, attempt):
        if job_id == 3 and attempt < 3:          # lỗi tạm thời, lần 3 thì được
            raise TimeoutError("timeout khi gọi cổng thanh toán")
        if job_id == 5:                          # dịch vụ email sập suốt
            raise ConnectionError("email service 503")
        if job_id == 7:
            raise PermanentError("dữ liệu không hợp lệ")


    MAX_ATTEMPTS = 4


    def backoff(attempt):
        return 0.01 * 2 ** (attempt - 1)         # 10ms, 20ms, 40ms...


    jobs = queue.Queue()
    lock = threading.Lock()
    done, dlq, logs = [], [], []


    def worker():
        while True:
            job_id = jobs.get()
            if job_id is None:                   # "viên thuốc độc": báo worker dừng
                jobs.task_done()
                return
            attempt = 1
            while True:
                try:
                    process(job_id, attempt)
                    with lock:
                        done.append(job_id)
                    break
                except PermanentError as e:
                    with lock:
                        dlq.append(f"job {job_id} (lần {attempt}): {e}")
                    break
                except Exception as e:
                    if attempt >= MAX_ATTEMPTS:
                        with lock:
                            dlq.append(f"job {job_id} (lần {attempt}): {e}")
                        break
                    d = backoff(attempt)
                    with lock:
                        logs.append(f"job {job_id} lần {attempt} lỗi: {e} -> thử lại sau {d * 1000:.0f}ms")
                    time.sleep(d)                # đơn giản hoá: production dùng delay queue
                    attempt += 1
            jobs.task_done()


    threads = [threading.Thread(target=worker) for _ in range(3)]
    for t in threads:
        t.start()
    for i in range(1, 9):
        jobs.put(i)
    for _ in threads:
        jobs.put(None)
    jobs.join()

    for line in sorted(logs):                    # sắp xếp để output ổn định
        print(line)
    print("thành công:", sorted(done))
    print("dead letter queue:")
    for d in sorted(dlq):
        print("  -", d)
    ```

    Output:

    ```text
    job 3 lần 1 lỗi: timeout khi gọi cổng thanh toán -> thử lại sau 10ms
    job 3 lần 2 lỗi: timeout khi gọi cổng thanh toán -> thử lại sau 20ms
    job 5 lần 1 lỗi: email service 503 -> thử lại sau 10ms
    job 5 lần 2 lỗi: email service 503 -> thử lại sau 20ms
    job 5 lần 3 lỗi: email service 503 -> thử lại sau 40ms
    thành công: [1, 2, 3, 4, 6, 8]
    dead letter queue:
      - job 5 (lần 4): email service 503
      - job 7 (lần 1): dữ liệu không hợp lệ
    ```

!!! warning "Retry trong worker có thể chặn cả hàng đợi"
    `sleep` 5 phút trong worker = worker đó "chết" 5 phút. Với backoff dài, hãy đưa message sang một **delay queue** / **retry topic** (Kafka: `orders.retry.1m`, `orders.retry.10m`; RabbitMQ: queue có TTL + DLX quay về queue chính; asynq/Celery hỗ trợ sẵn) rồi ack message gốc.

### 💡 Tips quan trọng

- **DLQ phải có người canh**: đặt cảnh báo khi DLQ có message mới. DLQ không ai xem = thùng rác.
- Lưu kèm **lý do lỗi, số lần thử, thời điểm** vào header của message trong DLQ.
- Có công cụ **replay** từ DLQ về queue chính sau khi sửa bug.
- Retry chỉ an toàn khi handler **idempotent**.

## 📖 9. Background jobs - Celery, RQ, asynq

Rất nhiều việc bất đồng bộ đơn giản chỉ là "**chạy hàm này ở nền**": gửi email chào mừng, resize ảnh, xuất báo cáo Excel. Các thư viện job queue đóng gói sẵn queue + worker + retry + lịch chạy, thường dùng Redis làm broker.

| Thư viện | Ngôn ngữ | Broker | Ghi chú |
|---|---|---|---|
| **Celery** | Python | RabbitMQ, Redis | Mạnh, nhiều tính năng (chain, group, beat lịch định kỳ) |
| **RQ** (Redis Queue) | Python | Redis | Rất đơn giản |
| **Dramatiq**, **arq** | Python | Redis/RabbitMQ | Hiện đại, arq hỗ trợ asyncio |
| **asynq** | Go | Redis | Retry, lịch, priority queue, Web UI |
| **River** | Go | PostgreSQL | Job queue ngay trong Postgres - enqueue **cùng transaction** với dữ liệu |

=== "Go"

    ```go
    package main

    import (
    	"context"
    	"encoding/json"
    	"fmt"
    	"log"
    	"time"

    	"github.com/hibiken/asynq"
    )

    const TypeWelcomeEmail = "email:welcome"

    type WelcomePayload struct {
    	UserID int `json:"user_id"`
    }

    // ---- Phía API: xếp job vào hàng đợi ----
    func enqueue() {
    	client := asynq.NewClient(asynq.RedisClientOpt{Addr: "localhost:6379"})
    	defer client.Close()
    	payload, _ := json.Marshal(WelcomePayload{UserID: 42})
    	info, err := client.Enqueue(asynq.NewTask(TypeWelcomeEmail, payload),
    		asynq.MaxRetry(5), asynq.Timeout(30*time.Second), asynq.Queue("critical"))
    	if err != nil {
    		log.Fatal(err)
    	}
    	log.Printf("đã xếp job id=%s queue=%s", info.ID, info.Queue)
    }

    // ---- Phía worker ----
    func handleWelcome(ctx context.Context, t *asynq.Task) error {
    	var p WelcomePayload
    	if err := json.Unmarshal(t.Payload(), &p); err != nil {
    		return fmt.Errorf("payload hỏng: %v: %w", err, asynq.SkipRetry) // lỗi vĩnh viễn
    	}
    	log.Printf("gửi email chào mừng user %d", p.UserID)
    	return nil // trả error khác nil -> asynq tự retry với backoff
    }

    func main() {
    	enqueue()
    	srv := asynq.NewServer(asynq.RedisClientOpt{Addr: "localhost:6379"}, asynq.Config{
    		Concurrency: 10,
    		Queues:      map[string]int{"critical": 6, "default": 3, "low": 1}, // trọng số ưu tiên
    	})
    	mux := asynq.NewServeMux()
    	mux.HandleFunc(TypeWelcomeEmail, handleWelcome)
    	if err := srv.Run(mux); err != nil {
    		log.Fatal(err)
    	}
    }
    ```

=== "Python"

    ```python
    # tasks.py
    from celery import Celery

    app = Celery("shop", broker="redis://localhost:6379/0")
    app.conf.task_acks_late = True            # ack SAU khi chạy xong (at-least-once)
    app.conf.worker_prefetch_multiplier = 1   # không ôm nhiều job một lúc


    @app.task(
        autoretry_for=(ConnectionError, TimeoutError),  # chỉ retry lỗi tạm thời
        retry_backoff=True,                             # 1s, 2s, 4s, ...
        retry_backoff_max=600,                          # tối đa 10 phút
        retry_jitter=True,
        max_retries=5,
    )
    def send_welcome_email(user_id: int):
        print(f"gửi email chào mừng user {user_id}")


    # Phía API:
    #   send_welcome_email.delay(42)
    # Chạy worker:
    #   celery -A tasks worker --concurrency=4 --loglevel=info
    ```

```text
đã xếp job id=6f1c... queue=critical
gửi email chào mừng user 42
```

Output (ví dụ).

!!! warning "Job queue trên Redis và dual write"
    `db.commit()` rồi `task.delay()` cũng là **dual write** (mục 7.1): commit xong mà enqueue lỗi → mất job; enqueue trước commit → worker có thể chạy khi dữ liệu **chưa commit** (không tìm thấy user). Cách an toàn: outbox, hoặc job queue nằm **trong chính Postgres** (River, `SKIP LOCKED`), hoặc tối thiểu enqueue **sau** commit (`transaction.on_commit` trong Django) và chấp nhận rủi ro nhỏ.

## 📖 10. Event-driven architecture, Event Sourcing và CQRS

### 10.1 Event-driven architecture (EDA)

Các service giao tiếp bằng cách **phát sự kiện** khi có gì đó xảy ra, thay vì gọi trực tiếp nhau.

```mermaid
flowchart LR
    O["Order Service"] -->|"OrderCreated"| BUS[["Event bus (Kafka)"]]
    BUS --> I["Inventory"]
    BUS --> PM["Payment"]
    BUS --> N["Notification"]
    BUS --> AN["Analytics"]
    PM -->|"PaymentSucceeded"| BUS
    I -->|"StockReserved"| BUS
```

Hai kiểu nội dung sự kiện:

- **Event notification**: chỉ báo "đơn 1001 đã tạo" (kèm id). Consumer cần thêm thông tin thì gọi API → gọn nhẹ nhưng tạo lại coupling.
- **Event-carried state transfer**: sự kiện mang **đủ dữ liệu** (sản phẩm, số lượng, địa chỉ...). Consumer không cần gọi lại → tách rời hoàn toàn, nhưng message lớn và phải quản lý **schema** (dùng Avro/Protobuf + Schema Registry, chỉ thêm field chứ không xoá/đổi nghĩa field cũ).

### 10.2 Event Sourcing - lưu sự kiện thay vì lưu trạng thái

Cách truyền thống lưu **trạng thái hiện tại**: `accounts(id=7, balance=120000)`. Event sourcing lưu **chuỗi sự kiện** đã xảy ra, trạng thái là **kết quả cộng dồn**:

```text
AccountOpened(7)          -> 0
MoneyDeposited(100000)    -> 100.000
MoneyDeposited(50000)     -> 150.000
MoneyWithdrawn(30000)     -> 120.000   (trạng thái hiện tại = fold các sự kiện)
```

> 💡 **Ví von**: Sổ tiết kiệm ngân hàng không ghi "số dư hiện tại" bằng bút chì rồi tẩy đi viết lại - nó ghi **từng dòng giao dịch**, số dư là kết quả tính từ các dòng đó. Muốn biết số dư ngày 1/3 năm ngoái? Cộng các dòng đến ngày đó.

- ✅ Lịch sử đầy đủ, audit tự nhiên, "du hành thời gian", tạo view mới từ lịch sử.
- ❌ Phức tạp: truy vấn trạng thái cần **projection**/snapshot, sửa schema sự kiện khó, rất ít team cần thật sự. Hợp với: ngân hàng/ví điện tử, sổ cái (ledger), hệ thống cần audit nghiêm ngặt.

### 10.3 CQRS - tách mô hình ghi và mô hình đọc

**CQRS** (Command Query Responsibility Segregation): phía **ghi** (command) dùng mô hình chuẩn hoá, tối ưu cho tính đúng đắn; phía **đọc** (query) dùng một hoặc nhiều **read model** được tối ưu cho từng màn hình, cập nhật **bất đồng bộ** qua sự kiện.

```mermaid
flowchart LR
    U["Client"] -->|"Command: PlaceOrder"| W["Write model<br/>(PostgreSQL chuẩn hoá)"]
    W -->|"sự kiện"| BUS[["Kafka"]]
    BUS --> P1["Projector"]
    P1 --> R1[("Read model 1<br/>Elasticsearch - tìm đơn")]
    P1 --> R2[("Read model 2<br/>Redis - dashboard")]
    U -->|"Query"| R1
    U -->|"Query"| R2
```

Cái giá: read model **trễ** vài trăm ms so với write model (**eventual consistency**) - người dùng vừa đặt đơn có thể chưa thấy nó trong danh sách. Kỹ thuật "read your own writes": sau khi ghi, trả luôn dữ liệu vừa ghi cho client, hoặc đọc từ write model trong vài giây đầu. CQRS và event sourcing hay đi cùng nhau nhưng **độc lập** - dùng cái này không bắt buộc dùng cái kia.

## 📖 11. Saga - transaction trải dài nhiều service

Đặt hàng cần: **tạo đơn** (Order DB) → **giữ hàng** (Inventory DB) → **thu tiền** (Payment DB). Ba database khác nhau, không thể dùng một transaction ACID. Two-phase commit (2PC) có nhưng chậm, khoá lâu, và điều phối viên là điểm chết.

**Saga** = chuỗi **transaction cục bộ**; mỗi bước có một **hành động bù trừ** (compensating action) để "hoàn tác" khi bước sau thất bại.

| Bước | Hành động | Bù trừ |
|---|---|---|
| 1 | Tạo đơn (PENDING) | Huỷ đơn (CANCELLED) |
| 2 | Giữ hàng | Trả hàng về kho |
| 3 | Thu tiền | Hoàn tiền |
| 4 | Xác nhận đơn (CONFIRMED) | - |

### 11.1 Choreography - mỗi service tự "nhảy" theo nhạc

Không có ai chỉ huy; mỗi service nghe sự kiện và phát sự kiện tiếp theo.

```mermaid
sequenceDiagram
    participant O as Order
    participant I as Inventory
    participant P as Payment
    O->>I: OrderCreated
    I->>P: StockReserved
    P-->>I: PaymentFailed
    P-->>O: PaymentFailed
    Note over I: bù trừ: trả hàng về kho
    Note over O: bù trừ: đơn -> CANCELLED
```

- ✅ Đơn giản khi ít bước, các service tách rời, không có điểm tập trung.
- ❌ Luồng nghiệp vụ **rải rác** khắp nơi, khó hình dung và debug; dễ phát sinh vòng lặp sự kiện khi nhiều bước.

### 11.2 Orchestration - có nhạc trưởng

Một **orchestrator** (thường là một state machine) ra lệnh từng bước và quyết định bù trừ.

```mermaid
sequenceDiagram
    participant S as Order Saga (orchestrator)
    participant I as Inventory
    participant P as Payment
    participant O as Order
    S->>I: ReserveStock
    I-->>S: StockReserved
    S->>P: ChargePayment
    P-->>S: PaymentFailed
    S->>I: ReleaseStock (bù trừ)
    I-->>S: StockReleased
    S->>O: CancelOrder (bù trừ)
```

- ✅ Luồng nằm **một chỗ**, dễ đọc, dễ thêm bước, dễ theo dõi trạng thái.
- ❌ Orchestrator là thêm một thành phần; nguy cơ nó "biết quá nhiều".

Công cụ: **Temporal** (durable workflow - viết saga như code tuần tự, Temporal lo retry/lưu trạng thái), AWS Step Functions, Camunda. Quy tắc: **ít bước, ít team → choreography; nhiều bước, logic phức tạp → orchestration**.

!!! warning "Saga không có tính cô lập (isolation)"
    Giữa các bước, người khác có thể thấy trạng thái "dở dang" (hàng đã giữ nhưng chưa thu tiền). Thiết kế trạng thái rõ ràng (`PENDING`, `RESERVED`...) và mọi bước + bù trừ đều phải **idempotent** vì chúng sẽ bị retry.

## 📖 12. Backpressure - khi producer nhanh hơn consumer

Nếu message vào 1.000/s mà consumer chỉ xử lý 800/s, hàng đợi **tăng mãi** → hết RAM/đĩa, độ trễ lên hàng giờ. **Backpressure** là các cơ chế để phía chậm "đẩy ngược" áp lực về phía nhanh.

```mermaid
flowchart LR
    P["Producer<br/>1.000 msg/s"] --> Q[["Queue<br/>giới hạn 10.000"]]
    Q --> C["Consumer<br/>800 msg/s"]
    Q -. "đầy: chặn / từ chối / giảm tốc" .-> P
    C -. "lag tăng -> autoscale" .-> K["Thêm consumer"]
```

| Kỹ thuật | Cách làm |
|---|---|
| **Bounded queue** | Hàng đợi có giới hạn; đầy thì producer **bị chặn** (channel có buffer trong Go, `queue.Queue(maxsize=...)` trong Python) hoặc nhận lỗi |
| **Prefetch / max in-flight** | Consumer chỉ nhận N message chưa ack cùng lúc |
| **Load shedding** | Quá tải thì **từ chối** bớt (HTTP 429/503) thay vì nhận rồi xử lý trễ 2 tiếng |
| **Autoscale theo lag** | Theo dõi **consumer lag** (Kafka) / độ dài queue; tăng số consumer khi lag tăng (KEDA trên Kubernetes) |
| **Rate limit producer** | Giới hạn tốc độ phía gửi (token bucket - [Bài 8](./08-caching.md)) |
| **Batching** | Consumer xử lý theo lô (insert 500 dòng/lần) để tăng thông lượng |

!!! tip "Chỉ số phải giám sát"
    **Độ dài queue / consumer lag**, **tuổi của message cũ nhất** (quan trọng hơn độ dài!), tốc độ vào/ra, tỉ lệ lỗi, số message vào DLQ. "Message cũ nhất đã chờ 45 phút" là cảnh báo rõ ràng nhất rằng hệ thống không theo kịp.

## 📖 13. Case study: xử lý đơn hàng bất đồng bộ

Ghép mọi thứ lại cho một sàn TMĐT:

```mermaid
flowchart TB
    U["Người dùng"] -->|"POST /orders<br/>Idempotency-Key"| API["Order API"]
    API -->|"1 transaction"| DB[("orders + outbox")]
    API -->|"202 Accepted<br/>order_id, status=PENDING"| U
    DB --> RL["Outbox relay / Debezium"]
    RL --> K[["Kafka: order-events<br/>key = order_id"]]
    K --> INV["Inventory consumer<br/>(inbox, idempotent)"]
    K --> PAY["Payment consumer<br/>(Idempotency-Key tới cổng TT)"]
    K --> NOTI["Notification consumer<br/>(email/SMS/push)"]
    K --> ANA["Analytics consumer"]
    INV -->|"StockReserved / OutOfStock"| K
    PAY -->|"PaymentSucceeded / PaymentFailed"| K
    PAY -.->|"lỗi quá số lần retry"| DLQ[["DLQ + cảnh báo"]]
    K --> SAGA["Order saga<br/>cập nhật trạng thái đơn"]
    SAGA --> DB
    U -.->|"GET /orders/:id hoặc WebSocket"| API
```

Vòng đời trạng thái của đơn:

```mermaid
stateDiagram-v2
    [*] --> PENDING: đặt hàng
    PENDING --> RESERVED: StockReserved
    PENDING --> CANCELLED: OutOfStock
    RESERVED --> PAID: PaymentSucceeded
    RESERVED --> CANCELLED: PaymentFailed / hết 15 phút
    PAID --> SHIPPING: kho đóng gói xong
    SHIPPING --> DELIVERED: giao thành công
    DELIVERED --> [*]
    CANCELLED --> [*]
```

Những quyết định thiết kế và lý do:

1. **API trả 202 + `order_id`** sau khi ghi DB (~50ms). Client theo dõi trạng thái qua polling/WebSocket/push.
2. **Idempotency-Key** ở API: người dùng bấm "Đặt hàng" 2 lần (mạng chậm) không tạo 2 đơn.
3. **Outbox** đảm bảo không có đơn nào "bị lãng quên".
4. **Key Kafka = `order_id`**: mọi sự kiện của một đơn đi theo thứ tự trong một partition.
5. **Mọi consumer idempotent** (inbox) vì giao at-least-once.
6. **Thanh toán**: gọi cổng thanh toán với idempotency key = `order_id` → retry không trừ tiền 2 lần.
7. **Timeout của saga**: đơn `RESERVED` quá 15 phút chưa thanh toán → tự huỷ, trả hàng (một **delayed message** hoặc job định kỳ).
8. **Giám sát**: lag từng consumer group, DLQ, thời gian từ `PENDING` → `PAID` (p50/p99) - xem [Bài 11](./11-observability-reliability.md).

## 🌍 Ứng dụng thực tế

| Hệ thống | Dùng queue/sự kiện thế nào |
|---|---|
| Sàn TMĐT (flash sale) | Queue san tải đặt hàng; outbox + Kafka cho sự kiện đơn; saga giữ hàng - thanh toán |
| Ví điện tử / ngân hàng | Sổ cái kiểu event sourcing; mọi consumer idempotent theo mã giao dịch; đối soát cuối ngày |
| Ứng dụng gọi xe / giao đồ ăn | Kafka nhận vị trí tài xế mỗi vài giây; nhiều consumer group: ghép chuyến, tính giá, bản đồ nhiệt |
| Nền tảng video | Upload xong trả 202; job encode nhiều độ phân giải chạy nền; thông báo khi xong |
| Hệ thống email/SMS marketing | Queue có rate limit theo nhà mạng; retry backoff; DLQ số điện thoại lỗi |
| Data pipeline | CDC từ PostgreSQL (Debezium) → Kafka → data warehouse, search index, cache invalidation |
| Chatbot / app có AI | Tác vụ gọi LLM chậm vài giây đến vài phút chạy qua job queue; kết quả đẩy về bằng WebSocket |

## ⚠️ Lỗi thường gặp

| Lỗi | Hậu quả | Cách đúng |
|---|---|---|
| Consumer không idempotent | Trừ tiền/gửi email/cộng điểm 2 lần | Inbox table, upsert, idempotency key |
| `auto-ack` / commit offset trước khi xử lý | Consumer chết → mất message | Ack/commit **sau** khi xử lý xong |
| Ghi DB rồi publish trực tiếp (dual write) | Mất sự kiện hoặc sự kiện "ma" | Transactional outbox / CDC |
| Retry vô hạn, không backoff | Poison message chặn queue; dội bom dịch vụ đang yếu | Giới hạn số lần, exponential backoff + jitter, DLQ |
| Retry cả lỗi vĩnh viễn | Phí tài nguyên, chậm phát hiện bug | Phân loại lỗi: vĩnh viễn → DLQ ngay |
| DLQ không ai giám sát | Mất đơn hàng trong im lặng | Cảnh báo khi DLQ > 0, có công cụ replay |
| Không đặt prefetch | Một consumer ôm hết message, các consumer khác rảnh | `basic_qos(prefetch_count=N)` |
| Mong đợi thứ tự toàn cục trên Kafka | Sự kiện `OrderPaid` xử lý trước `OrderCreated` | Chọn **key** đúng (order_id) để cùng partition |
| Nhiều consumer hơn số partition | Consumer dư ngồi chơi | Số partition ≥ số consumer tối đa dự kiến |
| Message quá lớn (ảnh, file vài MB) | Broker chậm, vượt giới hạn | Lưu file ở object storage (S3), message chỉ chứa **đường dẫn** |
| Đổi schema sự kiện phá consumer cũ | Consumer crash hàng loạt | Chỉ **thêm** field, versioning, Schema Registry |
| Dùng queue cho việc cần kết quả ngay | Phức tạp vô ích, UX tệ | Việc cần kết quả tức thì → gọi đồng bộ |

## 🏋️ Bài tập

### Bài 1 (Dễ) - Đồng bộ hay bất đồng bộ?

Với mỗi việc sau, chọn làm **đồng bộ** hay **bất đồng bộ** và giải thích: (a) kiểm tra mã giảm giá khi thanh toán, (b) gửi email xác nhận đơn, (c) tạo thumbnail cho ảnh vừa upload, (d) trừ số dư ví khi chuyển tiền, (e) cập nhật số liệu dashboard doanh thu.

<details><summary>Đáp án</summary>

(a) Đồng bộ - người dùng cần biết ngay mã có hợp lệ để thấy giá cuối. (b) Bất đồng bộ - trễ vài giây không sao, email service lỗi không được làm hỏng đơn. (c) Bất đồng bộ - việc nặng; hiển thị ảnh gốc/placeholder trước. (d) Đồng bộ (trong transaction DB) - người dùng cần biết chuyển thành công hay không; các việc **sau** đó (thông báo, cộng điểm) mới async. (e) Bất đồng bộ - dashboard chấp nhận trễ.

</details>

### Bài 2 (Dễ) - Routing key

Topic exchange có các binding: Q1 `order.*`, Q2 `order.#`, Q3 `*.created.*`, Q4 `#.vn`. Message với routing key sau vào queue nào: (a) `order.created`, (b) `order.created.vn`, (c) `payment.created.th`, (d) `order`?

<details><summary>Đáp án</summary>

(a) Q1, Q2. (b) Q2, Q3, Q4. (c) Q3. (d) Q2 (`#` khớp 0 từ).

</details>

### Bài 3 (Trung bình) - Kafka partition

Topic có 6 partition. Group A có 4 consumer, group B có 8 consumer. Mỗi consumer trong A và B nhận bao nhiêu partition? Nếu cần thứ tự sự kiện theo từng **khách hàng**, chọn key là gì?

<details><summary>Đáp án</summary>

Group A: 6 partition chia cho 4 consumer → 2 consumer nhận 2 partition, 2 consumer nhận 1. Group B: 6 consumer mỗi người 1 partition, **2 consumer rảnh**. Key = `customer_id`.

</details>

### Bài 4 (Trung bình) - Thêm full jitter và retry qua "delay queue"

Sửa ví dụ worker pool (mục 8.3): (1) backoff dùng **full jitter** `random(0, min(cap, base·2^attempt))`; (2) bản Python không `sleep` trong worker nữa mà đưa job vào một **delay queue** (ví dụ `heapq` theo thời điểm sẵn sàng + một thread "scheduler" chuyển job đến hạn về hàng đợi chính). Đảm bảo chương trình vẫn dừng đúng khi mọi job xong hoặc vào DLQ.

### Bài 5 (Trung bình) - Outbox với nhiều relay

Trong bản Python outbox, chạy **2 relay** song song (2 thread, mỗi thread một connection SQLite tới cùng một file DB). Điều gì xảy ra? Vì sao PostgreSQL dùng `FOR UPDATE SKIP LOCKED` để giải quyết? Viết câu SQL lấy lô 100 event cho PostgreSQL.

<details><summary>Đáp án</summary>

Hai relay có thể đọc **cùng** các event chưa gửi và cùng publish → trùng lặp (vẫn đúng nếu consumer idempotent, nhưng lãng phí). Với PostgreSQL:

```sql
BEGIN;
SELECT id, topic, payload
FROM outbox
WHERE published_at IS NULL
ORDER BY id
LIMIT 100
FOR UPDATE SKIP LOCKED;   -- dòng đang bị relay khác khoá thì BỎ QUA, không chờ
-- publish từng event ...
UPDATE outbox SET published_at = now() WHERE id = ANY($1);
COMMIT;
```

Lưu ý: nhiều relay song song làm mất thứ tự toàn cục; nếu cần thứ tự theo đơn, phân chia theo `hash(order_id)`.

</details>

### Bài 6 (Khó) - Saga orchestrator in-process

Viết orchestrator cho saga đặt hàng (3 bước: giữ hàng → thu tiền → xác nhận) bằng Go hoặc Python, mỗi bước là một hàm có thể lỗi, mỗi bước có hàm bù trừ. Yêu cầu: khi bước k lỗi, chạy bù trừ các bước `k-1 … 1` theo **thứ tự ngược**; lưu trạng thái saga sau mỗi bước (dict/map giả lập DB) để nếu orchestrator "crash" và khởi động lại thì **chạy tiếp** từ bước dở dang. Viết test cho 3 kịch bản: thành công, lỗi ở bước thu tiền, crash sau bước giữ hàng.

### Bài 7 (Khó) - Thiết kế

Một ứng dụng đặt vé xem phim: 20.000 người cùng mở bán vé một bộ phim bom tấn lúc 10h. Thiết kế luồng giữ ghế (giữ 10 phút) - thanh toán - xuất vé dùng queue. Trả lời: dùng queue ở đâu để san tải? Làm sao đảm bảo 1 ghế không bán cho 2 người? Ghế hết hạn giữ được nhả ra thế nào? Vẽ sequence diagram.

## ✅ Checklist hoàn thành

- [ ] Giải thích được khi nào nên xử lý bất đồng bộ và khi nào không
- [ ] Nêu 5 lợi ích của queue: độ trễ, decoupling, load leveling, chịu lỗi, retry
- [ ] Phân biệt point-to-point và pub/sub, command và event
- [ ] Hiểu exchange direct/topic/fanout, binding, routing key với `*` và `#`
- [ ] Biết ack thủ công, prefetch, durable/persistent, publisher confirms, DLX
- [ ] Hiểu topic, partition, offset, consumer group, rebalance, retention, compaction của Kafka
- [ ] Biết thứ tự chỉ được đảm bảo trong một partition và chọn key phù hợp
- [ ] Phân biệt at-most-once, at-least-once, "exactly-once" và viết consumer idempotent
- [ ] Giải thích bài toán dual write và cài được transactional outbox + inbox
- [ ] Phân loại lỗi tạm thời/vĩnh viễn, dùng exponential backoff + jitter và DLQ
- [ ] Dùng được một thư viện background job (Celery/RQ hoặc asynq)
- [ ] Giải thích event sourcing, CQRS và cái giá eventual consistency
- [ ] Phân biệt saga choreography và orchestration, biết hành động bù trừ
- [ ] Biết các kỹ thuật backpressure và chỉ số cần giám sát (lag, tuổi message cũ nhất)

**Bài tiếp theo**: [Bài 10: System Design & Scalability](./10-system-design.md)
