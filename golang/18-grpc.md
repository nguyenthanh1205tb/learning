# 📚 Bài 18: gRPC với Go

## 🎯 Mục tiêu bài học

- Hiểu **RPC** là gì, **gRPC** khác gì REST/JSON và **khi nào nên / không nên** dùng gRPC
- Viết file **`.proto`** với Protocol Buffers (proto3): message, kiểu dữ liệu, `repeated`, `map`, `enum`, `oneof`, `optional`, message lồng nhau, **well-known types**
- Hiểu **field number** và các quy tắc **tương thích ngược/xuôi** (`reserved`) - để sửa API mà không làm sập client cũ
- Cài và dùng **`protoc`**, **`protoc-gen-go`**, **`protoc-gen-go-grpc`** và **`buf`** (`buf generate`, `buf lint`, `buf breaking`)
- Viết server + client cho đủ **4 kiểu RPC**: unary, server streaming, client streaming, bidirectional streaming
- **Xử lý lỗi** chuẩn gRPC: `status`, `codes`, `errdetails`, dịch lỗi domain → gRPC code
- **Deadline**, **cancellation**, **metadata** (header/trailer) và **interceptor** (logging, recovery, xác thực, chain)
- **Vận hành**: TLS, health check, reflection + `grpcurl`, keepalive, load balancing, retry, graceful stop
- **Test** gRPC hoàn toàn trong bộ nhớ với `bufconn`
- Giới thiệu **grpc-gateway** (REST ↔ gRPC) và chạy gRPC trong **Docker**
- Xây dựng 4 ứng dụng thực tế: **microservice đặt hàng + kho**, **phòng chat realtime**, **upload file lớn theo chunk**, **bảng giá chứng khoán**

> 💡 **Kiến thức cần có**: [Bài 8](./08-concurrency.md) (goroutine, channel, `context`), [Bài 12](./12-http-apis.md) (HTTP API, middleware, timeout, retry), [Bài 16](./16-production-ready.md) (`slog`, graceful shutdown, cấu trúc project) và [Bài 17](./17-docker.md) (Docker). Bài này dùng lại rất nhiều ý tưởng của các bài đó - chỉ là "phiên bản gRPC".

> 💡 **Tất cả ví dụ đều chạy offline** trên máy bạn (localhost). Chỉ cần internet một lần để cài công cụ và tải module.

### 📦 Phiên bản dùng trong bài (đã chạy thử thật)

| Thành phần | Phiên bản | Ghi chú |
|-----------|-----------|---------|
| Go | **1.24** | `go 1.24.0` trong `go.mod` |
| `google.golang.org/grpc` | **v1.80.0** | Bản mới nhất còn hỗ trợ Go 1.24 (v1.81+ yêu cầu Go 1.25) |
| `google.golang.org/protobuf` | **v1.36.11** | |
| `protoc-gen-go` | **v1.36.11** | Sinh code cho message |
| `protoc-gen-go-grpc` | **v1.6.1** | Sinh code cho service (v1.6.2+ yêu cầu Go 1.25) |
| `buf` | **v1.65.0** | (v1.66+ yêu cầu Go 1.25) |
| `grpc-gateway` | **v2.28.0** | (v2.29+ yêu cầu Go 1.25) |
| `grpcurl` | **v1.9.3** | Công cụ "curl cho gRPC" |
| `protoc` | 3.21+ (bài test với 3.21.12) | Bản nào từ 3.15 trở lên đều được |

> ⚠️ **Vì sao phải ghim (pin) version?** Thư viện gRPC ra bản mới gần như mỗi tháng và thường xuyên nâng yêu cầu phiên bản Go. Nếu bạn gõ `go get google.golang.org/grpc@latest` trên Go 1.24, Go sẽ **tự tải toolchain mới hơn** (hoặc báo lỗi nếu đặt `GOTOOLCHAIN=local`) và `go.mod` bị đổi thành `go 1.25` (hoặc mới hơn). Ghim version rõ ràng giúp cả team build giống hệt nhau.

## 📖 1. RPC là gì? gRPC là gì?

### RPC - "Gọi hàm ở máy khác như gọi hàm ở máy mình"

**RPC** (Remote Procedure Call - lời gọi thủ tục từ xa) là ý tưởng: bạn gọi một hàm, nhưng hàm đó **chạy trên máy khác**. Thư viện RPC lo hết phần "bẩn": đóng gói tham số, gửi qua mạng, chờ kết quả, mở gói kết quả.

```go
// Trông như gọi hàm bình thường...
resp, err := inventory.ReserveStock(ctx, &inventoryv1.ReserveStockRequest{...})
// ...nhưng thực ra: đóng gói request → gửi qua mạng → service Kho xử lý → gửi kết quả về
```

So với REST (Bài 12), bạn **không** phải tự nghĩ URL, method, tự `json.Marshal`, tự đọc `resp.Body`, tự kiểm tra status code...

> 💡 **Ví von**: REST giống **gửi thư**: bạn tự viết địa chỉ (URL), tự chọn loại thư (GET/POST), tự viết nội dung theo định dạng hai bên "ngầm hiểu" với nhau (JSON). gRPC giống **gọi điện qua tổng đài nội bộ có sẵn danh bạ**: bấm số máy lẻ "Kho → Giữ hàng", nói theo **kịch bản đã thống nhất trước** (file `.proto`), và cuộc gọi có thể kéo dài để hai bên nói qua nói lại (streaming).

### gRPC là gì?

**gRPC** là framework RPC mã nguồn mở do Google tạo ra (2015), hiện thuộc CNCF (cùng "nhà" với Kubernetes). Ba thành phần cốt lõi:

1. **Protocol Buffers (protobuf)**: ngôn ngữ mô tả dữ liệu + định dạng nhị phân gọn nhẹ. Bạn viết "hợp đồng" API trong file `.proto`
2. **Sinh code (code generation)**: từ file `.proto`, công cụ sinh ra struct, client và interface server cho **hơn 10 ngôn ngữ** (Go, Java, Python, C#, Node.js, Kotlin, Swift, Dart...)
3. **HTTP/2**: nhiều lời gọi chạy song song trên **một** kết nối TCP, hỗ trợ **streaming** hai chiều, nén header

### So sánh gRPC và REST/JSON

| Tiêu chí | REST + JSON | gRPC + Protobuf |
|----------|-------------|-----------------|
| Giao thức | HTTP/1.1 hoặc HTTP/2 | **HTTP/2** (bắt buộc) |
| Định dạng dữ liệu | JSON (văn bản, người đọc được) | Protobuf (**nhị phân**, nhỏ hơn 2-5 lần, parse nhanh hơn) |
| Hợp đồng API | Tùy chọn (OpenAPI/Swagger, thường viết sau) | **Bắt buộc**, viết trước (**contract-first**) trong `.proto` |
| Sinh code client | Tùy chọn, thường tự viết | **Có sẵn** cho mọi ngôn ngữ |
| Kiểu dữ liệu | Lỏng lẻo (số là `float64`? `string`?) | **Chặt chẽ**, kiểm tra lúc compile |
| Streaming | Khó (SSE, WebSocket là thứ riêng) | **Có sẵn** 4 kiểu, kể cả hai chiều |
| Gọi từ trình duyệt | ✅ Trực tiếp | ❌ Cần **gRPC-Web** + proxy, hoặc **grpc-gateway**/ConnectRPC |
| Debug bằng tay | ✅ `curl`, trình duyệt | Cần `grpcurl`, Postman (hỗ trợ gRPC) |
| Deadline, cancel | Tự làm (timeout client) | **Có sẵn**, truyền qua các service |
| Mã lỗi | HTTP status (404, 500...) | ~16 `codes` chuẩn (`NotFound`, `Unavailable`...) |
| Caching HTTP (CDN) | ✅ Dễ (GET + Cache-Control) | ❌ Gần như không |

### Khi nào nên dùng gRPC?

| ✅ Nên dùng gRPC | ❌ Không nên (dùng REST/JSON) |
|------------------|------------------------------|
| Giao tiếp **giữa các microservice nội bộ** (service-to-service) | API **công khai** cho bên thứ ba, đối tác (họ quen REST, `curl`) |
| Cần **hiệu năng** cao, độ trễ thấp, nhiều lời gọi nhỏ | Frontend **trình duyệt** gọi trực tiếp (trừ khi dùng gRPC-Web/gateway) |
| Cần **streaming**: chat, bảng giá realtime, upload file lớn, đồng bộ dữ liệu | Cần **cache HTTP**/CDN cho dữ liệu công khai |
| Nhiều ngôn ngữ khác nhau cần chung một hợp đồng chặt chẽ | Dự án nhỏ, một service, team chưa quen protobuf |
| App di động ↔ backend (tiết kiệm băng thông, pin) | Webhook (bên gửi luôn là HTTP/JSON) |

> 💡 **Thực tế phổ biến**: **"REST ở ngoài, gRPC ở trong"**. Trình duyệt/đối tác gọi REST vào API Gateway; phía sau, các service nói chuyện với nhau bằng gRPC. Với **grpc-gateway** (mục 13), bạn viết service **một lần** bằng gRPC và có luôn REST API.

### gRPC trong kiến trúc microservices

```text
                          ┌──────────────── Mạng nội bộ (gRPC, HTTP/2, protobuf) ───────────────┐
 Trình duyệt ── REST ──►  │  API Gateway ──gRPC──► OrderService ──gRPC──► InventoryService      │
 App mobile  ── gRPC ──►  │                              │                                      │
                          │                              └───gRPC──► PaymentService             │
                          │  ChatService ◄══ bidi stream ══► client chat                         │
                          └─────────────────────────────────────────────────────────────────────┘
```

Mỗi mũi tên gRPC là một **hợp đồng `.proto`**. Team Kho sửa code thoải mái miễn là giữ đúng hợp đồng; team Đơn hàng không cần đọc code của team Kho - chỉ cần đọc file `.proto`.

## 📖 2. Protocol Buffers - "Hợp đồng" giữa các service

### 2.1. File `.proto` đầu tiên

Tạo project và file `proto/shop/v1/customer.proto` - file này gom gần như **mọi thứ** bạn cần biết về cú pháp proto3:

```bash
mkdir grpc-demo && cd grpc-demo
go mod init grpc-demo
mkdir -p proto/shop/v1
```

```protobuf
// Luôn dùng proto3 cho dự án mới
syntax = "proto3";

// package của protobuf: tránh trùng tên giữa các file .proto (không phải package Go!)
package shop.v1;

// Import các "well-known types" có sẵn của Google
import "google/protobuf/duration.proto";
import "google/protobuf/timestamp.proto";
import "google/protobuf/wrappers.proto";

// go_package = "<đường dẫn import Go>;<tên package Go>"
option go_package = "grpc-demo/gen/shop/v1;shopv1";

// enum: giá trị đầu tiên PHẢI là 0 và nên mang nghĩa "chưa xác định"
enum Tier {
  TIER_UNSPECIFIED = 0;
  TIER_SILVER = 1;
  TIER_GOLD = 2;
  TIER_DIAMOND = 3;
}

message Customer {
  // Đã từng có field 4 "phone" và đã xóa → khóa số và tên lại, không ai dùng lại được
  reserved 4;
  reserved "phone";

  // message lồng nhau (nested) - tên đầy đủ: shop.v1.Customer.Address
  message Address {
    string street = 1;
    string city = 2;
  }

  int64 id = 1;                 // Số 1..15 chỉ tốn 1 byte cho "tag" → dành cho field hay dùng
  string name = 2;
  string email = 3;
  Tier tier = 5;
  repeated string tags = 6;             // Danh sách (slice trong Go)
  map<string, int32> points_by_shop = 7; // Map
  Address address = 8;                  // Field kiểu message → con trỏ trong Go

  // optional: phân biệt được "không gửi" và "gửi giá trị 0"
  optional int32 age = 9;

  // oneof: CHỈ MỘT trong các field bên trong được set
  oneof contact {
    string zalo = 10;
    string telegram = 11;
  }

  google.protobuf.Timestamp created_at = 12;       // Thời điểm
  google.protobuf.Duration session_timeout = 13;   // Khoảng thời gian
  google.protobuf.StringValue nickname = 14;       // Wrapper: string "có thể null" (kiểu cũ)
}
```

Đọc từng phần:

- **`syntax = "proto3";`** - luôn là dòng đầu tiên. proto2 là bản cũ, dự án mới luôn dùng proto3
- **`package shop.v1;`** - "không gian tên" của protobuf, giúp phân biệt `shop.v1.Customer` với `crm.v1.Customer`. Hậu tố **`v1`** là **phiên bản API** - khi cần thay đổi lớn, tạo `shop.v2` song song, không sửa `v1`
- **`message`** ≈ `struct` trong Go. Mỗi field có **kiểu**, **tên** (`snake_case`) và **số thứ tự** (field number)
- **`import`** - dùng message từ file `.proto` khác

### 2.2. Các kiểu dữ liệu cơ bản (scalar types)

| Kiểu proto | Kiểu Go | Zero value | Dùng khi |
|-----------|---------|------------|----------|
| `double` / `float` | `float64` / `float32` | `0` | Số thực (⚠️ **không** dùng cho tiền) |
| `int32` / `int64` | `int32` / `int64` | `0` | Số nguyên thông thường |
| `uint32` / `uint64` | `uint32` / `uint64` | `0` | Số không âm |
| `sint32` / `sint64` | `int32` / `int64` | `0` | Số nguyên **hay âm** (mã hóa âm gọn hơn `int32`) |
| `fixed64` / `sfixed64` | `uint64` / `int64` | `0` | Số rất lớn (luôn 8 byte, ví dụ hash) |
| `bool` | `bool` | `false` | Cờ đúng/sai |
| `string` | `string` | `""` | Văn bản **UTF-8** |
| `bytes` | `[]byte` | `nil` | Dữ liệu nhị phân (ảnh, file, chunk) |

> 💡 **Tiền tệ**: dùng `int64` đơn vị nhỏ nhất (đồng, xu) - như `price_vnd` trong bài - hoặc message `google.type.Money`. **Không bao giờ** dùng `double` cho tiền (0.1 + 0.2 ≠ 0.3).

> ⚠️ **proto3 không có `nil` cho kiểu cơ bản**: không gửi `age` và gửi `age = 0` là **giống hệt nhau** trên dây. Nếu cần phân biệt, dùng `optional` (mục 2.4).

### 2.3. Field number - "số nhà" của field, KHÔNG BAO GIỜ được đổi ⭐

Trên dây (wire), protobuf **không gửi tên field**, chỉ gửi **số**. Ví dụ `Customer{id: 1001, name: "An"}` được mã hóa thành **7 byte**:

```text
08 E9 07        ← field 1 (id), kiểu varint, giá trị 1001
12 02 41 6E     ← field 2 (name), kiểu length-delimited, dài 2 byte: "An"
```

Byte đầu mỗi field là **tag** = `(field_number << 3) | wire_type`. Vì vậy:

- **Đổi tên field** (`name` → `full_name`): dữ liệu nhị phân **vẫn tương thích** (số không đổi). Nhưng JSON (`protojson`, grpc-gateway) **sẽ đổi** vì JSON dùng tên → vẫn nên cẩn thận
- **Đổi số** (`name = 2` → `name = 20`): client cũ gửi field 2, server mới **không nhận ra** → dữ liệu **mất âm thầm**, không có lỗi nào!
- **Dùng lại số của field đã xóa**: client cũ gửi `phone` (số 4, kiểu string), server mới hiểu số 4 là... `tier`? → **dữ liệu rác**, lỗi rất khó tìm

> 💡 **Ví von**: Field number là **số nhà**. Bưu tá (protobuf) chỉ nhìn số nhà, không nhìn tên chủ nhà. Đổi tên chủ nhà thì thư vẫn đến đúng. Đổi số nhà thì thư đến nhầm chỗ. Và khi một nhà bị phá, **đừng** cấp số nhà đó cho người mới - thư của người cũ vẫn đang được gửi tới!

**Quy tắc chọn số**:
- `1`-`15`: tag chỉ tốn **1 byte** → dành cho field **hay dùng**
- `16`-`2047`: tag tốn 2 byte
- `19000`-`19999`: **cấm dùng** (protobuf giữ riêng)
- Số không cần liên tục - có thể chừa khoảng trống

### 2.4. `repeated`, `map`, `enum`, `oneof`, `optional`, message lồng nhau

| Cú pháp proto | Sinh ra trong Go | Ghi chú |
|---------------|------------------|---------|
| `repeated string tags = 6;` | `Tags []string` | Danh sách, giữ thứ tự |
| `map<string, int32> points_by_shop = 7;` | `PointsByShop map[string]int32` | Key: số nguyên, `bool` hoặc `string`. **Không** giữ thứ tự, không `repeated` được |
| `enum Tier { TIER_UNSPECIFIED = 0; ... }` | `type Tier int32` + hằng `Tier_TIER_GOLD` | Giá trị **0 phải là "chưa xác định"** - vì 0 là mặc định khi client không gửi |
| `Address address = 8;` (message) | `Address *Customer_Address` | Field kiểu message luôn là **con trỏ** → có thể `nil` |
| `optional int32 age = 9;` | `Age *int32` | Phân biệt "không gửi" (`nil`) với "gửi 0" |
| `oneof contact { string zalo = 10; string telegram = 11; }` | `Contact isCustomer_Contact` (interface) | Chỉ **một** field được set. Dùng type switch |
| `message Address {...}` bên trong `Customer` | `Customer_Address` | Tên Go nối bằng `_` |

> 💡 **Quy ước đặt tên enum**: giá trị có **tiền tố** là tên enum viết hoa (`TIER_GOLD`, không phải `GOLD`). Lý do: enum trong protobuf (theo quy tắc của C++) chia sẻ không gian tên với cả package - hai enum cùng có `ACTIVE` sẽ xung đột. `buf lint` (mục 3) sẽ nhắc bạn.

### 2.5. Well-known types - Các kiểu "có sẵn" của Google

| Kiểu | Ý nghĩa | Chuyển đổi trong Go |
|------|---------|---------------------|
| `google.protobuf.Timestamp` | Thời điểm (UTC, độ chính xác nano giây) | `timestamppb.New(t)`, `ts.AsTime()`, `timestamppb.Now()` |
| `google.protobuf.Duration` | Khoảng thời gian | `durationpb.New(d)`, `d.AsDuration()` |
| `google.protobuf.Empty` | Message rỗng (request/response không có gì) | `&emptypb.Empty{}` |
| `google.protobuf.StringValue`, `Int64Value`, `BoolValue`... (wrappers) | Giá trị "có thể null" | `wrapperspb.String("x")`, `v.GetValue()` |
| `google.protobuf.FieldMask` | Danh sách field cần cập nhật (API `Update` một phần) | `fieldmaskpb.New(...)` |
| `google.protobuf.Struct` / `Value` | JSON tùy ý, không có schema | `structpb.NewStruct(map[string]any{...})` |

> 💡 Từ khi có `optional` (protoc 3.15+), **wrappers ít được dùng** trong code mới - `optional string nickname` gọn hơn `google.protobuf.StringValue nickname`. Bạn vẫn gặp wrappers trong nhiều API cũ. Còn `Empty`: nhiều style guide (và `buf lint`) khuyên **không** dùng làm request/response, mà tạo message riêng (`DeleteProductResponse {}`) - để sau này thêm field được.

### 2.6. `package` và `go_package`

Hai khái niệm **khác nhau** hay bị nhầm:

```protobuf
package shop.v1;                                      // Tên trong THẾ GIỚI PROTOBUF (dùng khi import, trong URL gRPC)
option go_package = "grpc-demo/gen/shop/v1;shopv1";   // Nơi đặt code Go sinh ra: "<import path>;<tên package Go>"
```

- `package shop.v1` xuất hiện trong **tên method trên dây**: `/shop.v1.CustomerService/GetCustomer`
- `go_package` = **đường dẫn import** (bắt đầu bằng tên module trong `go.mod`) + `;` + **tên package Go** (đặt `shopv1` để tránh trùng khi import nhiều version: `shopv1`, `shopv2`)

### 2.7. Dùng code Go được sinh ra

Sau khi sinh code (cách cài công cụ ở mục 3), bạn dùng message như struct bình thường. File `cmd/protobasics/main.go`:

```go
package main

import (
	"encoding/json"
	"fmt"
	"time"

	shopv1 "grpc-demo/gen/shop/v1"

	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/durationpb"
	"google.golang.org/protobuf/types/known/timestamppb"
	"google.golang.org/protobuf/types/known/wrapperspb"
)

func main() {
	c := &shopv1.Customer{
		Id:             1001,
		Name:           "Nguyễn Văn An",
		Email:          "an@example.com",
		Tier:           shopv1.Tier_TIER_GOLD,
		Tags:           []string{"vip", "hanoi"},
		PointsByShop:   map[string]int32{"q1": 120},
		Address:        &shopv1.Customer_Address{Street: "12 Lý Thường Kiệt", City: "Hà Nội"},
		Age:            proto.Int32(0),                            // optional: "có gửi, giá trị là 0"
		Contact:        &shopv1.Customer_Zalo{Zalo: "0901234567"}, // oneof
		CreatedAt:      timestamppb.New(time.Date(2026, 9, 1, 8, 30, 0, 0, time.UTC)),
		SessionTimeout: durationpb.New(30 * time.Minute),
		Nickname:       wrapperspb.String("An béo"),
	}

	// 1. Getter an toàn với nil - không bao giờ panic
	var empty *shopv1.Customer
	fmt.Printf("Getter trên nil: name=%q city=%q\n", empty.GetName(), empty.GetAddress().GetCity())

	// 2. optional: phân biệt "không gửi" và "gửi 0"
	fmt.Println("Có gửi age?", c.Age != nil, "- giá trị:", c.GetAge())

	// 3. oneof: dùng type switch để biết field nào đang được set
	switch v := c.Contact.(type) {
	case *shopv1.Customer_Zalo:
		fmt.Println("Liên hệ qua Zalo:", v.Zalo)
	case *shopv1.Customer_Telegram:
		fmt.Println("Liên hệ qua Telegram:", v.Telegram)
	case nil:
		fmt.Println("Chưa có kênh liên hệ")
	}

	// 4. Well-known types chuyển qua lại với kiểu Go
	fmt.Println("Tạo lúc:", c.GetCreatedAt().AsTime().Format(time.RFC3339))
	fmt.Println("Timeout phiên:", c.GetSessionTimeout().AsDuration())
	fmt.Println("Hạng:", c.GetTier(), "=", int32(c.GetTier()))

	// 5. Mã hóa nhị phân (binary) - thứ thực sự đi trên dây trong gRPC
	bin, err := proto.Marshal(c)
	if err != nil {
		panic(err)
	}
	// 6. So sánh với JSON (protojson = JSON theo chuẩn protobuf)
	js, _ := protojson.Marshal(c)
	fmt.Printf("Binary: %d byte | JSON: %d byte\n", len(bin), len(js))

	// 7. Giải mã ngược lại và so sánh
	var decoded shopv1.Customer
	if err := proto.Unmarshal(bin, &decoded); err != nil {
		panic(err)
	}
	fmt.Println("Giải mã giống bản gốc?", proto.Equal(c, &decoded))

	// 8. protojson in đẹp - để debug/log (tên field dạng lowerCamelCase)
	pretty := protojson.MarshalOptions{Multiline: true, Indent: "  "}
	fmt.Println(pretty.Format(&shopv1.Customer{Id: 7, Name: "Bình", Tier: shopv1.Tier_TIER_SILVER}))

	// ⚠️ Đừng dùng encoding/json cho message protobuf!
	std, _ := json.Marshal(&shopv1.Customer{Id: 7, Contact: &shopv1.Customer_Zalo{Zalo: "09"}})
	fmt.Println("encoding/json:", string(std))
}
```

```bash
go run ./cmd/protobasics
```

```text
// Output:
Getter trên nil: name="" city=""
Có gửi age? true - giá trị: 0
Liên hệ qua Zalo: 0901234567
Tạo lúc: 2026-09-01T08:30:00Z
Timeout phiên: 30m0s
Hạng: TIER_GOLD = 2
Binary: 135 byte | JSON: 307 byte
Giải mã giống bản gốc? true
{
  "id": "7",
  "name": "Bình",
  "tier": "TIER_SILVER"
}
encoding/json: {"id":7,"Contact":{"Zalo":"09"}}
```

**Điểm đáng chú ý**:

- ✅ **Luôn dùng getter** `GetXxx()`: chúng an toàn với `nil` (`empty.GetAddress().GetCity()` không panic). Truy cập trực tiếp `c.Address.City` sẽ panic nếu `Address` là `nil`
- ✅ Bản nhị phân **nhỏ hơn 2 lần** JSON (135 vs 307 byte) - và parse nhanh hơn nhiều
- ✅ `protojson` in `int64` thành **chuỗi** (`"id": "7"`) - vì JavaScript không biểu diễn chính xác số nguyên > 2^53. Enum in bằng **tên** (`"TIER_SILVER"`), field bằng `lowerCamelCase`
- ✅ So sánh message bằng `proto.Equal`, sao chép bằng `proto.Clone` - **không** dùng `==` hay `reflect.DeepEqual`
- ❌ `encoding/json` cho ra kết quả **sai chuẩn** (oneof thành `"Contact":{"Zalo":...}`, bỏ qua quy ước protobuf) → luôn dùng `protojson`
- ⚠️ **Không copy message theo giá trị** (`x := *c`): struct sinh ra chứa `sync.Mutex` ẩn bên trong, `go vet` sẽ cảnh báo. Luôn dùng con trỏ `*Customer`

### 2.8. Tương thích ngược/xuôi - Sửa API mà không làm sập ai ⭐

Trong microservices, **không bao giờ** deploy mọi service cùng lúc. Sẽ luôn có lúc **client cũ nói chuyện với server mới** (tương thích ngược - backward) và **client mới nói chuyện với server cũ** (tương thích xuôi - forward). Protobuf được thiết kế để việc này an toàn **nếu bạn tuân thủ quy tắc**:

| Thay đổi | An toàn? | Giải thích |
|----------|:--------:|-----------|
| **Thêm** field mới (số mới) | ✅ | Bên cũ gặp field lạ → bỏ qua (và giữ lại nếu chuyển tiếp message). Bên mới không nhận được → zero value |
| **Xóa** field + `reserved` số và tên | ✅ | `reserved` chặn người sau dùng lại |
| Xóa field mà **không** `reserved` | ⚠️ | Nguy hiểm: ai đó sẽ dùng lại số đó |
| **Đổi số** của field | ❌ | Như đổi số nhà - dữ liệu đi lạc |
| **Đổi kiểu** (`int64` → `string`, `int64` → `double`) | ❌ | Dữ liệu bị hiểu sai. (Một số cặp như `int32`↔`int64` tương thích nhưng có thể tràn số) |
| **Đổi tên** field | ⚠️ | Nhị phân OK, nhưng **JSON hỏng** và code Go phải sửa |
| Thêm giá trị enum mới | ✅ | Bên cũ nhận giá trị lạ → giữ nguyên con số (Go: `Tier(4)`, in ra `4`) → code cần có nhánh `default` |
| Chuyển field đơn lẻ vào `oneof` đã có | ❌ | Có thể mất dữ liệu |
| Thêm RPC mới vào service | ✅ | Client cũ không gọi → không sao |
| Đổi request/response type của RPC | ❌ | Tạo RPC mới thay vì sửa |

```protobuf
message Customer {
  reserved 4, 15 to 17;        // Số đã dùng rồi xóa - cấm dùng lại
  reserved "phone", "fax";     // Tên đã dùng rồi xóa - cấm dùng lại (bảo vệ JSON)
  ...
}
```

Thử thêm lại `string phone = 4;` vào `Customer` rồi sinh code - `protoc` chặn ngay:

```text
shop/v1/customer.proto: Field "phone" uses reserved number 4.
shop/v1/customer.proto:37:10: Field name "phone" is reserved.
shop/v1/customer.proto: Suggested field numbers for shop.v1.Customer: 15
```

> 💡 `reserved` chỉ bảo vệ **khi bạn nhớ viết nó**. Còn `buf breaking` (mục 3.4) tự động phát hiện **mọi** thay đổi phá vỡ tương thích bằng cách so sánh với phiên bản trước trên git.


## 📖 3. Công cụ: `protoc`, plugin Go và `buf`

Quy trình làm việc với gRPC luôn là:

```text
 ① Viết .proto  ──►  ② Sinh code (protoc/buf + plugin)  ──►  ③ Viết server/client dùng code sinh ra
     (hợp đồng)          *.pb.go (message)                       (logic nghiệp vụ của bạn)
                         *_grpc.pb.go (client + interface server)
```

### 3.1. Cài `protoc` (trình biên dịch protobuf)

`protoc` là chương trình C++ đọc file `.proto`. Nó **không** tự sinh code Go - nó gọi các **plugin** (`protoc-gen-go`, `protoc-gen-go-grpc`...) để làm việc đó.

```bash
# Cách 1 (mọi hệ điều hành): tải file zip từ GitHub Releases
#   https://github.com/protocolbuffers/protobuf/releases
#   chọn protoc-<phiên bản>-linux-x86_64.zip / -osx-universal_binary.zip / -win64.zip
PB_VER=31.1   # Thay bằng bản mới nhất trên trang Releases
curl -LO https://github.com/protocolbuffers/protobuf/releases/download/v$PB_VER/protoc-$PB_VER-linux-x86_64.zip
unzip protoc-$PB_VER-linux-x86_64.zip -d $HOME/.local   # bin/protoc + include/google/protobuf/*.proto
export PATH="$PATH:$HOME/.local/bin"

# Cách 2: trình quản lý gói
brew install protobuf              # macOS
sudo apt install protobuf-compiler # Ubuntu/Debian (bản hơi cũ nhưng đủ dùng)
winget install protobuf            # Windows

protoc --version
# Output: libprotoc 3.21.12   (bản apt trên Ubuntu 24.04 - của bạn có thể mới hơn)
```

> 💡 Thư mục `include/` trong file zip chứa các **well-known types** (`google/protobuf/timestamp.proto`...). Giữ nó cạnh `bin/` để `import "google/protobuf/timestamp.proto"` hoạt động.

### 3.2. Cài plugin Go (ghim version!)

```bash
go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.36.11
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.6.1

# Plugin được cài vào $(go env GOPATH)/bin - thư mục này phải nằm trong PATH
export PATH="$PATH:$(go env GOPATH)/bin"
protoc-gen-go --version        # Output: protoc-gen-go v1.36.11
protoc-gen-go-grpc --version   # Output: protoc-gen-go-grpc 1.6.1
```

Và thêm thư viện vào module:

```bash
go get google.golang.org/grpc@v1.80.0 google.golang.org/protobuf@v1.36.11
```

### 3.3. Cấu trúc thư mục & sinh code bằng `protoc`

```text
grpc-demo/
├── proto/                         ← Nguồn sự thật: CHỈ file .proto
│   ├── catalog/v1/catalog.proto   ← Thư mục = package protobuf (catalog.v1)
│   ├── shop/v1/customer.proto
│   └── ...
├── third_party/google/api/        ← .proto của bên thứ ba (dùng ở mục 13)
├── gen/                           ← Code SINH RA - không sửa tay!
│   └── catalog/v1/
│       ├── catalog.pb.go          ← Message (protoc-gen-go)
│       └── catalog_grpc.pb.go     ← Client + interface server (protoc-gen-go-grpc)
├── internal/                      ← Code của bạn: nghiệp vụ, interceptor
├── cmd/                           ← Các chương trình: server, client, demo
├── buf.yaml, buf.gen.yaml, Makefile
└── go.mod
```

```bash
protoc -I proto \
  --go_out=gen --go_opt=paths=source_relative \
  --go-grpc_out=gen --go-grpc_opt=paths=source_relative \
  proto/shop/v1/customer.proto proto/catalog/v1/catalog.proto
```

| Cờ | Ý nghĩa |
|----|---------|
| `-I proto` | Thư mục gốc để tìm file `.proto` và giải quyết `import` (có thể nhiều `-I`) |
| `--go_out=gen` | Gọi plugin `protoc-gen-go`, ghi kết quả vào `gen/` |
| `--go-grpc_out=gen` | Gọi plugin `protoc-gen-go-grpc` |
| `--go_opt=paths=source_relative` | Đặt file sinh ra theo **vị trí file `.proto`** (`gen/catalog/v1/`) thay vì theo `go_package` đầy đủ (`gen/grpc-demo/gen/catalog/v1/` - rất rối) |

> ⚠️ **Có nên commit thư mục `gen/`?** Hai trường phái đều phổ biến. **Commit** → `go build`/`go install` chạy ngay không cần cài `protoc` (khuyên dùng cho người mới và thư viện public). **Không commit** → CI phải sinh code trước khi build. Dù chọn cách nào, **không bao giờ sửa tay** file trong `gen/`.

### 3.4. `buf` - Công cụ hiện đại thay cho `protoc` ⭐

Gõ lệnh `protoc` dài dòng rất dễ sai, và `protoc` không có lint hay kiểm tra tương thích. **`buf`** (viết bằng Go, của công ty Buf) giải quyết cả ba:

```bash
go install github.com/bufbuild/buf/cmd/buf@v1.65.0
buf --version   # Output: 1.65.0
```

> 💡 `buf` có **trình biên dịch protobuf riêng** bên trong - bạn **không cần** cài `protoc` nếu dùng `buf`. Plugin Go (`protoc-gen-go`...) thì vẫn cần.

**`buf.yaml`** (gốc project) - khai báo module và luật lint/breaking:

```yaml
version: v2
modules:
  - path: proto
  - path: third_party   # Chỉ chứa google/api/*.proto (copy từ googleapis)
    lint:
      ignore:
        - third_party/google
lint:
  use:
    - STANDARD
breaking:
  use:
    - FILE
```

**`buf.gen.yaml`** - thay cho cả dòng lệnh `protoc`:

```yaml
version: v2
inputs:
  - directory: proto
plugins:
  - local: protoc-gen-go
    out: gen
    opt: paths=source_relative
  - local: protoc-gen-go-grpc
    out: gen
    opt: paths=source_relative
  - local: protoc-gen-grpc-gateway
    out: gen
    opt: paths=source_relative
```

> 💡 Plugin thứ ba (`protoc-gen-grpc-gateway`) và module `third_party` phục vụ mục 13. Nếu chưa học tới, bạn có thể xóa chúng khỏi hai file trên.

```bash
buf generate      # Sinh code vào gen/
buf lint          # Kiểm tra style: tên, cấu trúc, quy ước
buf breaking --against '.git#branch=main'   # So với nhánh main: có phá vỡ tương thích không?
```

**`buf lint` bắt lỗi style** - thử với một file viết "tùy hứng" (enum `Status { ACTIVE = 0; DELETED = 1; }`, field `userName`, service `UserAPI` có `rpc GetUser(User) returns (User)`):

```text
// Output của buf lint:
proto/bad/v1/bad.proto:6:3:Enum value name "ACTIVE" should be prefixed with "STATUS_".
proto/bad/v1/bad.proto:6:3:Enum zero value name "ACTIVE" should be suffixed with "_UNSPECIFIED".
proto/bad/v1/bad.proto:7:3:Enum value name "DELETED" should be prefixed with "STATUS_".
proto/bad/v1/bad.proto:11:10:Field name "userName" should be lower_snake_case, such as "user_name".
proto/bad/v1/bad.proto:14:9:Service name "UserAPI" should be suffixed with "Service".
proto/bad/v1/bad.proto:15:3:RPC "GetUser" has the same type "bad.v1.User" for the request and response.
proto/bad/v1/bad.proto:15:15:RPC request type "User" should be named "GetUserRequest" or "UserAPIGetUserRequest".
proto/bad/v1/bad.proto:15:30:RPC response type "User" should be named "GetUserResponse" or "UserAPIGetUserResponse".
```

> 💡 **Vì sao mỗi RPC nên có `XxxRequest`/`XxxResponse` riêng?** Nếu `GetUser` trả thẳng `User`, sau này muốn trả thêm "thời điểm cache" thì phải thêm field vào `User` - ảnh hưởng mọi RPC khác dùng `User`. Bọc trong `GetUserResponse { User user = 1; }` thì thoải mái mở rộng.

**`buf breaking` bắt thay đổi phá vỡ tương thích** - thử xóa field `stock`, đổi `price_vnd` sang `double`, đổi tên `id` thành `product_id` trong `catalog.proto` (đã commit trên `main`):

```text
// Output của buf breaking --against '.git#branch=main':
proto/catalog/v1/catalog.proto:23:1:Previously present field "5" with name "stock" on message "Product" was deleted.
proto/catalog/v1/catalog.proto:27:3:Field "4" with name "price_vnd" on message "Product" changed type from "int64" to "double".
proto/catalog/v1/catalog.proto:31:3:Field "1" with name "product_id" on message "GetProductRequest" changed option "json_name" from "id" to "productId".
proto/catalog/v1/catalog.proto:31:10:Field "1" on message "GetProductRequest" changed name from "id" to "product_id".
```

Đưa `buf lint` và `buf breaking` vào **CI** (Bài 16) → không ai vô tình làm hỏng client đang chạy trên production.

### 3.5. Makefile - Gom lệnh lại

```makefile
# Cài công cụ (một lần) - ghim version để cả team sinh code giống hệt nhau
.PHONY: tools generate generate-protoc lint breaking test

tools:
	go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.36.11
	go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.6.1
	go install github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-grpc-gateway@v2.28.0
	go install github.com/bufbuild/buf/cmd/buf@v1.65.0

# Cách 1 (khuyên dùng): buf
generate:
	rm -rf gen
	buf generate

# Cách 2: protoc "thuần"
generate-protoc:
	rm -rf gen && mkdir -p gen
	protoc -I proto -I third_party \
		--go_out=gen --go_opt=paths=source_relative \
		--go-grpc_out=gen --go-grpc_opt=paths=source_relative \
		--grpc-gateway_out=gen --grpc-gateway_opt=paths=source_relative \
		$$(find proto -name '*.proto')

lint:
	buf lint

# So sánh .proto hiện tại với nhánh main → phát hiện thay đổi phá vỡ tương thích
breaking:
	buf breaking --against '.git#branch=main'

test:
	go test -race ./...
```

```bash
make tools      # Lần đầu
make generate   # Mỗi khi sửa .proto
make lint test
```

`go.mod` sau khi cài đủ (đã ghim version):

```text
module grpc-demo

go 1.24.0

toolchain go1.24.7

require (
	github.com/grpc-ecosystem/grpc-gateway/v2 v2.28.0
	google.golang.org/genproto/googleapis/api v0.0.0-20260209200024-4cfbd4190f57
	google.golang.org/grpc v1.80.0
	google.golang.org/protobuf v1.36.11
)
```

> ⚠️ **Cẩn thận với `go mod tidy`**: khi bạn import một package mới mà `go.mod` **chưa có**, `go mod tidy` sẽ tải **bản mới nhất** - có thể yêu cầu Go 1.25+ và kéo theo nâng cấp cả gRPC. Luôn `go get <module>@<version>` **trước**, rồi mới `go mod tidy`. Đặt `GOTOOLCHAIN=local` để Go báo lỗi thay vì âm thầm tải toolchain mới.

## 📖 4. Định nghĩa service: 4 kiểu RPC

Service trong `.proto` là danh sách các **RPC** (method). Từ khóa **`stream`** quyết định kiểu RPC. File `proto/catalog/v1/catalog.proto` - dịch vụ **danh mục sản phẩm** của một quán cà phê:

```protobuf
syntax = "proto3";

package catalog.v1;

option go_package = "grpc-demo/gen/catalog/v1;catalogv1";

// CatalogService minh họa đủ 4 kiểu RPC
service CatalogService {
  // 1. Unary: 1 request → 1 response (giống gọi hàm bình thường)
  rpc GetProduct(GetProductRequest) returns (GetProductResponse);
  rpc CreateProduct(CreateProductRequest) returns (CreateProductResponse);

  // 2. Server streaming: 1 request → server trả về NHIỀU message
  rpc ListProducts(ListProductsRequest) returns (stream ListProductsResponse);

  // 3. Client streaming: client gửi NHIỀU message → server trả 1 response
  rpc ImportProducts(stream ImportProductsRequest) returns (ImportProductsResponse);

  // 4. Bidirectional streaming: hai bên gửi/nhận song song, độc lập
  rpc CheckPrices(stream CheckPricesRequest) returns (stream CheckPricesResponse);
}

message Product {
  string id = 1;
  string name = 2;
  string category = 3;
  int64 price_vnd = 4; // Tiền: dùng số nguyên (đồng), không dùng float!
  int32 stock = 5;
}

message GetProductRequest {
  string id = 1;
}

message GetProductResponse {
  Product product = 1;
}

message CreateProductRequest {
  string name = 1;
  string category = 2;
  int64 price_vnd = 3;
  int32 stock = 4;
}

message CreateProductResponse {
  Product product = 1;
}

message ListProductsRequest {
  string category = 1; // Rỗng = tất cả
}

message ListProductsResponse {
  Product product = 1;
}

message ImportProductsRequest {
  string name = 1;
  string category = 2;
  int64 price_vnd = 3;
  int32 stock = 4;
}

message ImportProductsResponse {
  int32 created = 1;
  int32 failed = 2;
  repeated string errors = 3;
}

message CheckPricesRequest {
  string id = 1; // Mã sản phẩm vừa quét
}

message CheckPricesResponse {
  string id = 1;
  string name = 2;
  int64 price_vnd = 3;
  bool found = 4;
}
```

| Kiểu | Cú pháp | Ví von | Dùng khi |
|------|---------|--------|----------|
| **Unary** | `rpc A(Req) returns (Resp)` | Hỏi một câu, nhận một câu trả lời | 90% trường hợp: CRUD, tính toán |
| **Server streaming** | `returns (stream Resp)` | Đăng ký kênh YouTube: đăng ký một lần, video cứ thế về | Danh sách lớn, bảng giá realtime, theo dõi tiến trình, thông báo |
| **Client streaming** | `rpc A(stream Req)` | Đọc chính tả: bạn đọc nhiều câu, cuối cùng người kia đưa bài viết | Upload file, gửi hàng loạt (import), gửi dữ liệu cảm biến |
| **Bidirectional** | `rpc A(stream Req) returns (stream Resp)` | Gọi điện thoại: hai bên nói bất cứ lúc nào | Chat, game, quét mã ở quầy thu ngân, đồng bộ hai chiều |

Sinh code (`make generate`), mở `gen/catalog/v1/catalog_grpc.pb.go` - hai interface quan trọng nhất:

```go
// Phía CLIENT gọi - được cài đặt sẵn, bạn chỉ việc dùng
type CatalogServiceClient interface {
	GetProduct(ctx context.Context, in *GetProductRequest, opts ...grpc.CallOption) (*GetProductResponse, error)
	CreateProduct(ctx context.Context, in *CreateProductRequest, opts ...grpc.CallOption) (*CreateProductResponse, error)
	ListProducts(ctx context.Context, in *ListProductsRequest, opts ...grpc.CallOption) (grpc.ServerStreamingClient[ListProductsResponse], error)
	ImportProducts(ctx context.Context, opts ...grpc.CallOption) (grpc.ClientStreamingClient[ImportProductsRequest, ImportProductsResponse], error)
	CheckPrices(ctx context.Context, opts ...grpc.CallOption) (grpc.BidiStreamingClient[CheckPricesRequest, CheckPricesResponse], error)
}

// Phía SERVER - BẠN phải cài đặt interface này
type CatalogServiceServer interface {
	GetProduct(context.Context, *GetProductRequest) (*GetProductResponse, error)
	CreateProduct(context.Context, *CreateProductRequest) (*CreateProductResponse, error)
	ListProducts(*ListProductsRequest, grpc.ServerStreamingServer[ListProductsResponse]) error
	ImportProducts(grpc.ClientStreamingServer[ImportProductsRequest, ImportProductsResponse]) error
	CheckPrices(grpc.BidiStreamingServer[CheckPricesRequest, CheckPricesResponse]) error
	mustEmbedUnimplementedCatalogServiceServer()
}
```

Còn trong `catalog.pb.go`, mỗi message thành một struct (`Product`, `GetProductRequest`...) kèm các getter `GetId()`, `GetName()`...

> 💡 Tên field `snake_case` trong proto → `CamelCase` trong Go (`price_vnd` → `PriceVnd`, không phải `PriceVND`). Comment trong `.proto` được chép sang code Go - hãy viết comment cho API của bạn!

> 💡 Các kiểu stream (`grpc.ServerStreamingServer[T]`...) là **generics** (Bài 15) - có từ `protoc-gen-go-grpc` v1.4. Code cũ trên mạng dùng tên dài như `CatalogService_ListProductsServer` - vẫn còn dưới dạng **alias** nên vẫn chạy.

## 📖 5. Viết server

### 5.1. Tầng nghiệp vụ - không biết gì về gRPC

Theo tinh thần Bài 16: nghiệp vụ tách khỏi tầng giao tiếp. File `internal/catalog/store.go` - kho sản phẩm trong bộ nhớ với **lỗi domain** của riêng nó:

```go
package catalog

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"
)

// Lỗi nghiệp vụ (domain) - KHÔNG biết gì về gRPC
var (
	ErrNotFound      = errors.New("không tìm thấy sản phẩm")
	ErrAlreadyExists = errors.New("sản phẩm đã tồn tại")
)

type Product struct {
	ID       string
	Name     string
	Category string
	PriceVND int64
	Stock    int32
}

// Store lưu sản phẩm trong bộ nhớ, an toàn khi dùng từ nhiều goroutine
type Store struct {
	mu       sync.RWMutex
	products map[string]Product
	nextID   int
}

func NewStore() *Store {
	s := &Store{products: make(map[string]Product)}
	// Dữ liệu mẫu
	s.Create(Product{Name: "Cà phê sữa đá", Category: "do-uong", PriceVND: 29000, Stock: 100})
	s.Create(Product{Name: "Trà đào cam sả", Category: "do-uong", PriceVND: 35000, Stock: 50})
	s.Create(Product{Name: "Bánh mì thịt", Category: "do-an", PriceVND: 25000, Stock: 30})
	return s
}

func (s *Store) Get(id string) (Product, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, ok := s.products[id]
	if !ok {
		return Product{}, fmt.Errorf("id %q: %w", id, ErrNotFound)
	}
	return p, nil
}

func (s *Store) Create(p Product) (Product, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, existing := range s.products {
		if strings.EqualFold(existing.Name, p.Name) {
			return Product{}, fmt.Errorf("tên %q: %w", p.Name, ErrAlreadyExists)
		}
	}
	s.nextID++
	p.ID = fmt.Sprintf("SP%03d", s.nextID)
	s.products[p.ID] = p
	return p, nil
}

// List trả về sản phẩm theo danh mục (rỗng = tất cả), sắp xếp theo ID
func (s *Store) List(category string) []Product {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var out []Product
	for _, p := range s.products {
		if category == "" || p.Category == category {
			out = append(out, p)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out
}
```

### 5.2. Tầng gRPC - cài đặt `CatalogServiceServer`

File `internal/catalog/server.go`. Phần khai báo và **unary**:

```go
package catalog

import (
	"context"
	"errors"
	"fmt"
	"io"
	"time"

	catalogv1 "grpc-demo/gen/catalog/v1"

	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// Server cài đặt catalogv1.CatalogServiceServer
type Server struct {
	// BẮT BUỘC embed: RPC nào chưa viết sẽ tự trả codes.Unimplemented,
	// và thêm RPC mới vào .proto không làm hỏng build
	catalogv1.UnimplementedCatalogServiceServer

	store *Store
	// SlowDown giả lập database chậm (chỉ đặt trước khi Serve) - dùng để demo deadline
	SlowDown time.Duration
}

func NewServer(store *Store) *Server {
	return &Server{store: store}
}

// ===== 1. Unary =====

func (s *Server) GetProduct(ctx context.Context, req *catalogv1.GetProductRequest) (*catalogv1.GetProductResponse, error) {
	if req.GetId() == "" {
		return nil, status.Error(codes.InvalidArgument, "id là bắt buộc")
	}
	if s.SlowDown > 0 {
		select {
		case <-time.After(s.SlowDown): // "Truy vấn DB" xong
		case <-ctx.Done(): // Client hết kiên nhẫn / hủy → dừng ngay, không làm tiếp
			return nil, status.FromContextError(ctx.Err()).Err()
		}
	}
	p, err := s.store.Get(req.GetId())
	if err != nil {
		return nil, toStatus(err)
	}
	return &catalogv1.GetProductResponse{Product: toProto(p)}, nil
}

func (s *Server) CreateProduct(ctx context.Context, req *catalogv1.CreateProductRequest) (*catalogv1.CreateProductResponse, error) {
	if err := validateCreate(req.GetName(), req.GetPriceVnd(), req.GetStock()); err != nil {
		return nil, err
	}
	p, err := s.store.Create(Product{
		Name: req.GetName(), Category: req.GetCategory(),
		PriceVND: req.GetPriceVnd(), Stock: req.GetStock(),
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &catalogv1.CreateProductResponse{Product: toProto(p)}, nil
}
```

> 💡 **`UnimplementedCatalogServiceServer`** phải được embed **theo giá trị** (không phải con trỏ). Nếu quên, code không compile (thiếu method `mustEmbed...`). Nhờ nó, khi team thêm RPC mới vào `.proto` và sinh lại code, server cũ **vẫn build được** - RPC mới tự trả lỗi `Unimplemented` cho tới khi bạn viết.

**Server streaming** - gọi `stream.Send` nhiều lần, `return nil` để kết thúc:

```go
// ===== 2. Server streaming =====

func (s *Server) ListProducts(req *catalogv1.ListProductsRequest, stream grpc.ServerStreamingServer[catalogv1.ListProductsResponse]) error {
	for _, p := range s.store.List(req.GetCategory()) {
		// Client đã hủy (tắt app, hết deadline) → dừng gửi
		if err := stream.Context().Err(); err != nil {
			return status.FromContextError(err).Err()
		}
		if err := stream.Send(&catalogv1.ListProductsResponse{Product: toProto(p)}); err != nil {
			return err
		}
	}
	return nil // return nil = kết thúc stream, client nhận io.EOF
}
```

**Client streaming** - `Recv` cho tới `io.EOF`, rồi `SendAndClose` **một** response:

```go
// ===== 3. Client streaming =====

func (s *Server) ImportProducts(stream grpc.ClientStreamingServer[catalogv1.ImportProductsRequest, catalogv1.ImportProductsResponse]) error {
	summary := &catalogv1.ImportProductsResponse{}
	for {
		req, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			// Client đã gửi xong (CloseSend) → trả kết quả tổng hợp
			return stream.SendAndClose(summary)
		}
		if err != nil {
			return err
		}
		if err := validateCreate(req.GetName(), req.GetPriceVnd(), req.GetStock()); err != nil {
			summary.Failed++
			summary.Errors = append(summary.Errors, fmt.Sprintf("%q: %s", req.GetName(), status.Convert(err).Message()))
			continue
		}
		_, err = s.store.Create(Product{
			Name: req.GetName(), Category: req.GetCategory(),
			PriceVND: req.GetPriceVnd(), Stock: req.GetStock(),
		})
		if err != nil {
			summary.Failed++
			summary.Errors = append(summary.Errors, err.Error())
			continue
		}
		summary.Created++
	}
}
```

**Bidirectional streaming** - vừa `Recv` vừa `Send`, trả lời ngay từng message:

```go
// ===== 4. Bidirectional streaming =====

func (s *Server) CheckPrices(stream grpc.BidiStreamingServer[catalogv1.CheckPricesRequest, catalogv1.CheckPricesResponse]) error {
	for {
		req, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			return nil // Client quét xong
		}
		if err != nil {
			return err
		}
		resp := &catalogv1.CheckPricesResponse{Id: req.GetId()}
		if p, err := s.store.Get(req.GetId()); err == nil {
			resp.Name, resp.PriceVnd, resp.Found = p.Name, p.PriceVND, true
		}
		// Trả lời NGAY cho từng món, không chờ client gửi hết
		if err := stream.Send(resp); err != nil {
			return err
		}
	}
}
```

Các hàm hỗ trợ - **validate** và **dịch lỗi** (giải thích chi tiết ở mục 7):

```go
// ===== Helpers =====

// validateCreate trả lỗi InvalidArgument kèm chi tiết TỪNG field sai
func validateCreate(name string, price int64, stock int32) error {
	var violations []*errdetails.BadRequest_FieldViolation
	if name == "" {
		violations = append(violations, &errdetails.BadRequest_FieldViolation{
			Field: "name", Description: "không được để trống"})
	}
	if price <= 0 {
		violations = append(violations, &errdetails.BadRequest_FieldViolation{
			Field: "price_vnd", Description: "phải lớn hơn 0"})
	}
	if stock < 0 {
		violations = append(violations, &errdetails.BadRequest_FieldViolation{
			Field: "stock", Description: "không được âm"})
	}
	if len(violations) == 0 {
		return nil
	}
	st := status.New(codes.InvalidArgument, "dữ liệu sản phẩm không hợp lệ")
	// Đính kèm chi tiết có cấu trúc - client đọc được bằng st.Details()
	if withDetails, err := st.WithDetails(&errdetails.BadRequest{FieldViolations: violations}); err == nil {
		st = withDetails
	}
	return st.Err()
}

// toStatus dịch lỗi domain → gRPC status tại "ranh giới" của service
func toStatus(err error) error {
	switch {
	case errors.Is(err, ErrNotFound):
		return status.Error(codes.NotFound, err.Error())
	case errors.Is(err, ErrAlreadyExists):
		return status.Error(codes.AlreadyExists, err.Error())
	case errors.Is(err, context.DeadlineExceeded), errors.Is(err, context.Canceled):
		return status.FromContextError(err).Err()
	default:
		// Không lộ chi tiết nội bộ ra ngoài
		return status.Error(codes.Internal, "lỗi hệ thống")
	}
}

func toProto(p Product) *catalogv1.Product {
	return &catalogv1.Product{
		Id: p.ID, Name: p.Name, Category: p.Category,
		PriceVnd: p.PriceVND, Stock: p.Stock,
	}
}
```

### 5.3. `main.go` của server

File `cmd/catalog-server/main.go` - "lắp ráp" mọi thứ: listener, interceptor, keepalive, health check, reflection, graceful shutdown. Đừng lo nếu chưa hiểu hết - mỗi phần được giải thích ở mục 8-12:

```go
package main

import (
	"context"
	"flag"
	"log/slog"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"

	catalogv1 "grpc-demo/gen/catalog/v1"
	"grpc-demo/internal/catalog"
	"grpc-demo/internal/interceptor"

	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/keepalive"
	"google.golang.org/grpc/reflection"
)

func main() {
	addr := flag.String("addr", ":50051", "địa chỉ lắng nghe")
	slow := flag.Duration("slow", 0, "giả lập DB chậm cho GetProduct (vd 2s)")
	healthcheck := flag.Bool("healthcheck", false, "chỉ kiểm tra sức khỏe server rồi thoát (Docker)")
	flag.Parse()

	if *healthcheck {
		os.Exit(runHealthcheck(*addr))
	}

	log := slog.New(slog.NewTextHandler(os.Stdout, nil))

	// 1. Mở cổng TCP
	lis, err := net.Listen("tcp", *addr)
	if err != nil {
		log.Error("không mở được cổng", "err", err)
		os.Exit(1)
	}

	// 2. Tạo gRPC server với interceptor + keepalive
	srv := grpc.NewServer(
		// Thứ tự: interceptor ĐẦU TIÊN là lớp NGOÀI CÙNG
		grpc.ChainUnaryInterceptor(
			interceptor.UnaryRequestID(),
			interceptor.UnaryLogging(log),
			interceptor.UnaryRecovery(log),
		),
		grpc.ChainStreamInterceptor(
			interceptor.StreamLogging(log),
			interceptor.StreamRecovery(log),
		),
		grpc.KeepaliveParams(keepalive.ServerParameters{
			MaxConnectionIdle: 5 * time.Minute, // Đóng kết nối "ngủ" quá lâu
			Time:              1 * time.Minute, // Ping client nếu 1 phút im lặng
			Timeout:           10 * time.Second,
		}),
		grpc.KeepaliveEnforcementPolicy(keepalive.EnforcementPolicy{
			MinTime:             10 * time.Second, // Client ping dày hơn → bị ngắt (chống spam)
			PermitWithoutStream: true,
		}),
	)

	// 3. Đăng ký service của chúng ta
	svc := catalog.NewServer(catalog.NewStore())
	svc.SlowDown = *slow
	catalogv1.RegisterCatalogServiceServer(srv, svc)

	// 4. Health check chuẩn gRPC (Kubernetes, load balancer dùng)
	hs := health.NewServer()
	hs.SetServingStatus(catalogv1.CatalogService_ServiceDesc.ServiceName, healthpb.HealthCheckResponse_SERVING)
	healthpb.RegisterHealthServer(srv, hs)

	// 5. Reflection: cho grpcurl/Postman "hỏi" server có những service nào
	reflection.Register(srv)

	// 6. Chạy server trong goroutine, main chờ tín hiệu tắt
	go func() {
		log.Info("catalog server đang chạy", "addr", lis.Addr().String())
		if err := srv.Serve(lis); err != nil {
			log.Error("serve lỗi", "err", err)
		}
	}()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	<-ctx.Done()

	// 7. Graceful shutdown: báo NOT_SERVING, chờ các RPC đang chạy xong
	log.Info("nhận tín hiệu tắt, đang dừng...")
	hs.Shutdown()
	done := make(chan struct{})
	go func() {
		srv.GracefulStop() // Không nhận RPC mới, chờ RPC cũ hoàn tất
		close(done)
	}()
	select {
	case <-done:
		log.Info("đã dừng êm đẹp")
	case <-time.After(10 * time.Second):
		log.Warn("quá 10 giây, buộc dừng")
		srv.Stop() // Cắt ngang mọi thứ
	}
}
```

> 💡 `cmd/catalog-server/healthcheck.go` (hàm `runHealthcheck`) có ở mục 14 - dùng cho Docker. Nếu muốn chạy ngay, tạm bỏ 4 dòng `if *healthcheck {...}` hoặc tạo file đó trước.

## 📖 6. Viết client & chạy thử

File `cmd/catalog-client/main.go` gọi lần lượt cả 4 kiểu RPC:

```go
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"time"

	catalogv1 "grpc-demo/gen/catalog/v1"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

func main() {
	addr := flag.String("addr", "localhost:50051", "địa chỉ server")
	flag.Parse()

	// grpc.NewClient KHÔNG kết nối ngay - kết nối được tạo khi có RPC đầu tiên
	conn, err := grpc.NewClient(*addr,
		grpc.WithTransportCredentials(insecure.NewCredentials()), // ⚠️ Chỉ dùng khi dev!
	)
	if err != nil {
		log.Fatal(err)
	}
	defer conn.Close()

	// Client được sinh sẵn - dùng chung, an toàn cho nhiều goroutine
	client := catalogv1.NewCatalogServiceClient(conn)

	// Mỗi lời gọi đều có deadline
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	unary(ctx, client)
	serverStreaming(ctx, client)
	clientStreaming(ctx, client)
	bidiStreaming(ctx, client)
}

// ===== 1. Unary: gọi như gọi hàm =====
func unary(ctx context.Context, client catalogv1.CatalogServiceClient) {
	fmt.Println("== 1. Unary ==")
	resp, err := client.GetProduct(ctx, &catalogv1.GetProductRequest{Id: "SP001"})
	if err != nil {
		log.Fatal(err)
	}
	p := resp.GetProduct()
	fmt.Printf("%s: %s - %d đ (còn %d)\n", p.GetId(), p.GetName(), p.GetPriceVnd(), p.GetStock())

	created, err := client.CreateProduct(ctx, &catalogv1.CreateProductRequest{
		Name: "Bạc xỉu", Category: "do-uong", PriceVnd: 32000, Stock: 40,
	})
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("Đã tạo:", created.GetProduct().GetId(), created.GetProduct().GetName())
}

// ===== 2. Server streaming: nhận cho đến khi io.EOF =====
func serverStreaming(ctx context.Context, client catalogv1.CatalogServiceClient) {
	fmt.Println("== 2. Server streaming ==")
	stream, err := client.ListProducts(ctx, &catalogv1.ListProductsRequest{Category: "do-uong"})
	if err != nil {
		log.Fatal(err)
	}
	for {
		resp, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			break // Server đã gửi hết
		}
		if err != nil {
			log.Fatal(err)
		}
		fmt.Printf("  nhận: %s %s\n", resp.GetProduct().GetId(), resp.GetProduct().GetName())
	}
}

// ===== 3. Client streaming: gửi nhiều, CloseAndRecv lấy kết quả =====
func clientStreaming(ctx context.Context, client catalogv1.CatalogServiceClient) {
	fmt.Println("== 3. Client streaming ==")
	stream, err := client.ImportProducts(ctx)
	if err != nil {
		log.Fatal(err)
	}
	rows := []*catalogv1.ImportProductsRequest{
		{Name: "Xôi gà", Category: "do-an", PriceVnd: 30000, Stock: 20},
		{Name: "Nước cam", Category: "do-uong", PriceVnd: 0, Stock: 10},      // Giá 0 → lỗi
		{Name: "Bánh mì thịt", Category: "do-an", PriceVnd: 25000, Stock: 5}, // Trùng tên
		{Name: "Sữa chua", Category: "do-an", PriceVnd: 15000, Stock: 60},
	}
	for _, r := range rows {
		if err := stream.Send(r); err != nil {
			log.Fatal(err)
		}
	}
	summary, err := stream.CloseAndRecv() // "Tôi gửi xong rồi, cho tôi kết quả"
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("  tạo mới: %d, lỗi: %d\n", summary.GetCreated(), summary.GetFailed())
	for _, e := range summary.GetErrors() {
		fmt.Println("  -", e)
	}
}

// ===== 4. Bidi streaming: một goroutine gửi, một goroutine nhận =====
func bidiStreaming(ctx context.Context, client catalogv1.CatalogServiceClient) {
	fmt.Println("== 4. Bidirectional streaming ==")
	stream, err := client.CheckPrices(ctx)
	if err != nil {
		log.Fatal(err)
	}

	// Goroutine gửi: "thu ngân quét từng món"
	go func() {
		for _, id := range []string{"SP002", "SP999", "SP003"} {
			if err := stream.Send(&catalogv1.CheckPricesRequest{Id: id}); err != nil {
				return
			}
			fmt.Println("  quét:", id)
			time.Sleep(100 * time.Millisecond)
		}
		stream.CloseSend() // Báo server: hết hàng để quét
	}()

	// Goroutine chính nhận: "màn hình hiện giá"
	var total int64
	for {
		resp, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			log.Fatal(err)
		}
		if !resp.GetFound() {
			fmt.Printf("  → %s: không có trong hệ thống\n", resp.GetId())
			continue
		}
		total += resp.GetPriceVnd()
		fmt.Printf("  → %s: %s %d đ\n", resp.GetId(), resp.GetName(), resp.GetPriceVnd())
	}
	fmt.Printf("  Tổng tiền: %d đ\n", total)
}
```

Mở **hai terminal**:

```bash
# Terminal 1
go run ./cmd/catalog-server

# Terminal 2
go run ./cmd/catalog-client
```

```text
// Output (terminal 2 - client):
== 1. Unary ==
SP001: Cà phê sữa đá - 29000 đ (còn 100)
Đã tạo: SP004 Bạc xỉu
== 2. Server streaming ==
  nhận: SP001 Cà phê sữa đá
  nhận: SP002 Trà đào cam sả
  nhận: SP004 Bạc xỉu
== 3. Client streaming ==
  tạo mới: 2, lỗi: 2
  - "Nước cam": dữ liệu sản phẩm không hợp lệ
  - tên "Bánh mì thịt": sản phẩm đã tồn tại
== 4. Bidirectional streaming ==
  quét: SP002
  → SP002: Trà đào cam sả 35000 đ
  quét: SP999
  → SP999: không có trong hệ thống
  quét: SP003
  → SP003: Bánh mì thịt 25000 đ
  Tổng tiền: 60000 đ
```

```text
// Output (terminal 1 - server, sau đó nhấn Ctrl+C):
time=2026-09-26T10:22:50.105Z level=INFO msg="catalog server đang chạy" addr=0.0.0.0:50051
time=2026-09-26T10:22:50.612Z level=INFO msg=unary method=/catalog.v1.CatalogService/GetProduct code=OK duration=3µs request_id=0a498882
time=2026-09-26T10:22:50.613Z level=INFO msg=unary method=/catalog.v1.CatalogService/CreateProduct code=OK duration=12µs request_id=f8c9894d
time=2026-09-26T10:22:50.614Z level=INFO msg=stream method=/catalog.v1.CatalogService/ListProducts code=OK duration=98µs
time=2026-09-26T10:22:50.614Z level=INFO msg=stream method=/catalog.v1.CatalogService/ImportProducts code=OK duration=232µs
time=2026-09-26T10:22:50.917Z level=INFO msg=stream method=/catalog.v1.CatalogService/CheckPrices code=OK duration=302.897ms
time=2026-09-26T10:22:50.920Z level=INFO msg="nhận tín hiệu tắt, đang dừng..."
time=2026-09-26T10:22:50.920Z level=INFO msg="đã dừng êm đẹp"
```

**Những quy tắc vàng khi làm việc với stream**:

| Quy tắc | Giải thích |
|---------|-----------|
| **Một goroutine gửi, một goroutine nhận** | Gọi `Send` và `Recv` **song song** từ 2 goroutine là an toàn. Nhưng **không** được gọi `Send` từ 2 goroutine cùng lúc (hay `Recv` từ 2 goroutine) |
| `io.EOF` = kết thúc **bình thường** | Không phải lỗi. Mọi lỗi khác (`err != nil`) mới là lỗi thật |
| Client streaming: `CloseAndRecv()` | Vừa báo "gửi xong" vừa nhận response |
| Bidi: `CloseSend()` | Báo "tôi không gửi nữa" nhưng **vẫn nhận tiếp** được |
| Server: `return` từ handler = đóng stream | Trả `nil` → client nhận `io.EOF`; trả `err` → client nhận lỗi đó |
| Không sửa message sau khi `Send` | gRPC có thể dùng message "lười" (lazily) sau khi `Send` trả về |
| Luôn có cách **kết thúc** stream | `ctx` có deadline hoặc có thể cancel - nếu không, stream treo mãi, rò goroutine |

> 💡 **`grpc.NewClient` vs `grpc.Dial`**: `grpc.Dial`/`grpc.DialContext` đã **deprecated**. Dùng `grpc.NewClient` - nó **không** kết nối ngay mà kết nối "lười" khi có RPC đầu tiên, và tự kết nối lại khi mất mạng. Tạo **một** `ClientConn` và dùng chung cho cả ứng dụng (như `http.Client` ở Bài 12) - nó an toàn cho nhiều goroutine và tự quản lý kết nối HTTP/2.


## 📖 7. Xử lý lỗi: `status` và `codes` ⭐

### 7.1. Lỗi gRPC = mã lỗi (code) + thông điệp (message) + chi tiết (details)

REST dùng HTTP status (404, 500...). gRPC có bộ **mã lỗi riêng** trong package `google.golang.org/grpc/codes` - giống nhau ở **mọi ngôn ngữ**, nên client Java hiểu đúng lỗi từ server Go.

| Code | Ý nghĩa | HTTP tương đương | Retry? | Ví dụ |
|------|---------|:----------------:|:------:|-------|
| `OK` | Thành công | 200 | - | |
| `InvalidArgument` | Dữ liệu client gửi **sai** (bất kể trạng thái hệ thống) | 400 | ❌ | Email sai định dạng, giá âm |
| `NotFound` | Không tìm thấy | 404 | ❌ | Sản phẩm không tồn tại |
| `AlreadyExists` | Đã tồn tại | 409 | ❌ | Trùng email khi đăng ký |
| `FailedPrecondition` | Hệ thống **không ở trạng thái** cho phép thao tác | 400 | ❌ | Hết hàng, đơn đã hủy thì không giao được |
| `Unauthenticated` | **Chưa xác thực** (thiếu/sai token) | 401 | ❌ | Quên gửi API key |
| `PermissionDenied` | Đã xác thực nhưng **không có quyền** | 403 | ❌ | Nhân viên xóa đơn của quản lý |
| `ResourceExhausted` | Hết tài nguyên / vượt giới hạn | 429 | ⚠️ backoff | Rate limit, message quá lớn |
| `DeadlineExceeded` | Hết thời gian chờ | 504 | ⚠️ nếu idempotent | Service hạ nguồn chậm |
| `Canceled` | Bên gọi đã hủy | 499 | ❌ | Người dùng đóng app |
| `Unavailable` | Service **tạm thời** không phục vụ được | 503 | ✅ | Đang khởi động lại, mất kết nối |
| `Aborted` | Xung đột đồng thời | 409 | ✅ (cả giao dịch) | Optimistic locking thất bại |
| `Unimplemented` | Method chưa được cài đặt | 501 | ❌ | Server cũ chưa có RPC mới |
| `Internal` | Lỗi nội bộ (bug) | 500 | ❌ | Panic, lỗi không lường trước |
| `Unknown` | Lỗi không rõ | 500 | ❌ | Handler trả `error` thường thay vì status |
| `OutOfRange` | Vượt phạm vi hợp lệ | 400 | ❌ | Đọc quá cuối file |
| `DataLoss` | Mất/hỏng dữ liệu không khôi phục được | 500 | ❌ | Upload thiếu byte |

> 💡 **`InvalidArgument` hay `FailedPrecondition`?** Hỏi: "Gửi lại **y hệt** request này vào lúc khác thì có thể thành công không?". Không bao giờ (giá âm) → `InvalidArgument`. Có thể (sau khi kho nhập thêm hàng) → `FailedPrecondition`.

### 7.2. Tạo và đọc lỗi

```go
// ===== Phía server: tạo lỗi =====
return nil, status.Error(codes.NotFound, "không tìm thấy sản phẩm")
return nil, status.Errorf(codes.InvalidArgument, "số lượng %d không hợp lệ", qty)

// Context bị hủy/hết hạn → chuyển thành Canceled/DeadlineExceeded
return nil, status.FromContextError(ctx.Err()).Err()

// ===== Phía client: đọc lỗi =====
code := status.Code(err)            // codes.OK nếu err == nil - rất tiện để so sánh
st, ok := status.FromError(err)     // ok == false nếu err không phải lỗi gRPC
st := status.Convert(err)           // Luôn trả *Status (lỗi thường → codes.Unknown)
st.Code(); st.Message(); st.Details()
```

> ⚠️ **Handler trả `error` thường** (`errors.New`, `fmt.Errorf`) → client nhận `codes.Unknown` **kèm nguyên văn message**. Thử trả `errors.New("pq: connection refused tới 10.0.3.7:5432")`, client nhận được:
>
> ```text
> rpc error: code = Unknown desc = pq: connection refused tới 10.0.3.7:5432
> ```
>
> Vừa sai code (client không biết nên retry hay không), vừa **lộ địa chỉ database nội bộ**! Luôn dịch lỗi ở ranh giới như hàm `toStatus`.

### 7.3. Dịch lỗi domain → gRPC code

Hàm `toStatus` (mục 5.2) là **"ranh giới"** giữa nghiệp vụ và giao tiếp - đúng nguyên tắc "dịch lỗi ở ranh giới" của Bài 16:

```text
store.Get  ──► fmt.Errorf("id %q: %w", id, ErrNotFound)      (lỗi domain, bọc ngữ cảnh)
                              │
toStatus   ──► errors.Is(err, ErrNotFound) → codes.NotFound   (dịch ở ranh giới)
                              │
client     ──► status.Code(err) == codes.NotFound             (quyết định theo code)
```

Package `catalog` không import gRPC ở `store.go` → mai này thêm REST API, bạn viết một hàm `toHTTPStatus` tương tự, không sửa nghiệp vụ.

### 7.4. Chi tiết lỗi có cấu trúc với `errdetails`

Message dạng chữ chỉ để **người** đọc. Để **máy** (ví dụ form trên app) biết field nào sai, đính kèm **details** - các message protobuf chuẩn trong `google.golang.org/genproto/googleapis/rpc/errdetails`:

| Detail | Dùng cho |
|--------|----------|
| `BadRequest` (danh sách `FieldViolation`) | `InvalidArgument` - field nào sai, vì sao |
| `PreconditionFailure` | `FailedPrecondition` - điều kiện nào chưa đạt |
| `RetryInfo` | Bao lâu nữa thì thử lại |
| `QuotaFailure` | `ResourceExhausted` - vượt hạn mức nào |
| `ErrorInfo` | Mã lỗi máy đọc được (`"STOCK_EXHAUSTED"`) + metadata |
| `LocalizedMessage` | Thông điệp theo ngôn ngữ người dùng |

Server đã làm trong `validateCreate` (mục 5.2): `status.New(...)` → `st.WithDetails(&errdetails.BadRequest{...})` → `st.Err()`. Client đọc bằng `st.Details()` + type assertion. File `cmd/catalog-errors/main.go`:

```go
package main

import (
	"context"
	"fmt"
	"log"
	"time"

	catalogv1 "grpc-demo/gen/catalog/v1"

	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
)

func main() {
	conn, err := grpc.NewClient("localhost:50051", grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatal(err)
	}
	defer conn.Close()
	client := catalogv1.NewCatalogServiceClient(conn)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	// 1. NotFound
	_, err = client.GetProduct(ctx, &catalogv1.GetProductRequest{Id: "SP404"})
	explain("GetProduct SP404", err)

	// 2. InvalidArgument + chi tiết từng field
	_, err = client.CreateProduct(ctx, &catalogv1.CreateProductRequest{Name: "", PriceVnd: -1, Stock: -3})
	explain("CreateProduct rỗng", err)

	// 3. AlreadyExists
	_, err = client.CreateProduct(ctx, &catalogv1.CreateProductRequest{Name: "Cà phê sữa đá", PriceVnd: 1000})
	explain("CreateProduct trùng tên", err)
}

func explain(title string, err error) {
	fmt.Println("==", title)
	// status.FromError: lấy code + message từ error trả về của RPC
	st, ok := status.FromError(err)
	if !ok {
		fmt.Println("  không phải lỗi gRPC:", err)
		return
	}
	fmt.Printf("  code=%s message=%q\n", st.Code(), st.Message())

	// Đọc chi tiết có cấu trúc (nếu có)
	for _, d := range st.Details() {
		if br, ok := d.(*errdetails.BadRequest); ok {
			for _, v := range br.GetFieldViolations() {
				fmt.Printf("  - field %s: %s\n", v.GetField(), v.GetDescription())
			}
		}
	}

	// Quyết định hành động DỰA TRÊN CODE, không dựa trên message
	switch st.Code() {
	case codes.NotFound:
		fmt.Println("  → hiển thị 'Sản phẩm không tồn tại'")
	case codes.InvalidArgument:
		fmt.Println("  → tô đỏ các ô nhập sai trên form")
	case codes.AlreadyExists:
		fmt.Println("  → gợi ý người dùng đặt tên khác")
	case codes.Unavailable, codes.DeadlineExceeded:
		fmt.Println("  → có thể thử lại (retry) sau")
	}
}
```

```bash
go run ./cmd/catalog-server      # terminal 1
go run ./cmd/catalog-errors      # terminal 2
```

```text
// Output:
== GetProduct SP404
  code=NotFound message="id \"SP404\": không tìm thấy sản phẩm"
  → hiển thị 'Sản phẩm không tồn tại'
== CreateProduct rỗng
  code=InvalidArgument message="dữ liệu sản phẩm không hợp lệ"
  - field name: không được để trống
  - field price_vnd: phải lớn hơn 0
  - field stock: không được âm
  → tô đỏ các ô nhập sai trên form
== CreateProduct trùng tên
  code=AlreadyExists message="tên \"Cà phê sữa đá\": sản phẩm đã tồn tại"
  → gợi ý người dùng đặt tên khác
```

> ⚠️ **Đừng phân nhánh theo `st.Message()`** (`if strings.Contains(msg, "hết hàng")`) - message có thể đổi bất cứ lúc nào (dịch sang tiếng Anh, sửa lỗi chính tả). Dùng **code**, và nếu cần chi tiết hơn thì dùng `ErrorInfo.Reason`.

## 📖 8. Deadline, cancellation & metadata

### 8.1. Deadline - "Mọi lời gọi đều phải có hạn chót"

Bài 12 đã nói: **không có timeout là có ngày treo**. gRPC mang ý tưởng này đi xa hơn: deadline của client được **gửi kèm request** (header `grpc-timeout`), server nhận nó trong `ctx` và có thể **truyền tiếp** cho các service phía sau.

```text
Client: ctx 1s ──► OrderService (ctx còn ~1s)
                        │ context.WithTimeout(ctx, 300ms) → min(300ms, phần còn lại)
                        └──► InventoryService (ctx còn ~300ms)
                                    │ quá 300ms → ctx.Done() đóng
                                    └── dừng truy vấn DB, trả DeadlineExceeded
```

> 💡 **Ví von**: Bạn đặt đồ ăn và nói "**30 phút** không tới thì tôi hủy". Nhà hàng biết hạn chót đó; shipper cũng biết. Nếu 30 phút trôi qua mà món còn chưa nấu xong - **đừng nấu nữa**, không ai nhận đâu. Không có deadline, nhà hàng sẽ nấu những món mà khách đã bỏ đi từ lâu - lãng phí tài nguyên của cả hệ thống.

**Quy tắc deadline**:

- ✅ Client: **mọi** RPC đều có `context.WithTimeout` (hoặc `WithDeadline`). Stream dài hạn (chat) thì ít nhất phải **hủy được** (`WithCancel`, Ctrl+C)
- ✅ Server: truyền **`ctx` của request** vào mọi lời gọi xuống dưới (DB, service khác) - đừng dùng `context.Background()`
- ✅ Server: công việc dài → kiểm tra `ctx.Done()`/`ctx.Err()` để **dừng sớm**
- ✅ Gọi xuống service khác: `context.WithTimeout(ctx, x)` → deadline là **cái nào đến trước** giữa `x` và deadline của client
- ❌ Không đặt timeout cho server "tổng" rồi quên client - server không biết client đã bỏ đi nếu client không hủy

### 8.2. Metadata - "Header" của gRPC

**Metadata** là cặp key-value đi kèm RPC, tương đương HTTP header. Dùng cho thông tin **ngoài lề** nghiệp vụ: token xác thực, request ID, phiên bản client, ngôn ngữ...

| Loại | Chiều | Tạo | Đọc |
|------|-------|-----|-----|
| **Request metadata** | client → server | `metadata.AppendToOutgoingContext(ctx, "k", "v")` | `metadata.FromIncomingContext(ctx)` hoặc `metadata.ValueFromIncomingContext(ctx, "k")` |
| **Header** | server → client, **trước** response | `grpc.SetHeader(ctx, md)` / `stream.SetHeader(md)` | `grpc.Header(&md)` (unary), `stream.Header()` |
| **Trailer** | server → client, **sau** response | `grpc.SetTrailer(ctx, md)` / `stream.SetTrailer(md)` | `grpc.Trailer(&md)` (unary), `stream.Trailer()` |

- Key **tự động chuyển thành chữ thường** và không được bắt đầu bằng `grpc-` (dành riêng)
- Key kết thúc bằng **`-bin`** chứa dữ liệu nhị phân (tự mã hóa base64)
- **Trailer** hữu ích cho thông tin chỉ biết **ở cuối**: số bản ghi đã stream, thời gian xử lý, checksum. Thực ra code lỗi gRPC cũng được gửi trong trailer!

Demo đầy đủ về deadline, cancel, header/trailer nằm trong chương trình ở mục 9.4.

## 📖 9. Interceptors - "Middleware" của gRPC ⭐

### 9.1. Interceptor là gì?

Ở Bài 12 bạn viết **middleware** cho HTTP: hàm bọc quanh handler để log, bắt panic, kiểm tra token. **Interceptor** là đúng ý tưởng đó cho gRPC. Có 4 loại:

| | Unary | Stream |
|--|-------|--------|
| **Server** | `grpc.UnaryServerInterceptor` | `grpc.StreamServerInterceptor` |
| **Client** | `grpc.UnaryClientInterceptor` | `grpc.StreamClientInterceptor` |

Chữ ký của interceptor **unary phía server**:

```go
func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
	// ... làm gì đó TRƯỚC (đọc metadata, kiểm tra token, bắt đầu đo giờ)
	resp, err := handler(ctx, req) // Gọi handler thật (hoặc interceptor tiếp theo)
	// ... làm gì đó SAU (ghi log, đổi lỗi)
	return resp, err
}
```

- `info.FullMethod` = tên method đầy đủ, ví dụ `/catalog.v1.CatalogService/GetProduct`
- Muốn **chặn** request: `return nil, status.Error(...)` mà **không** gọi `handler`
- Muốn **truyền dữ liệu** xuống handler: `ctx = context.WithValue(ctx, key, v)` rồi `handler(ctx, req)`

Interceptor **stream** nhận `grpc.ServerStream` thay vì `req`. Vì `ServerStream` không có cách "thay context", ta **bọc** nó trong một struct và ghi đè `Context()` (xem `wrappedStream` bên dưới).

### 9.2. Package `interceptor` dùng chung

File `internal/interceptor/interceptor.go` - gồm request ID + header/trailer, logging, recovery, xác thực API key (server) và gắn token, chuyển tiếp request ID (client). Ứng dụng thực tế 1 sẽ dùng lại package này.

```go
// Package interceptor chứa các "middleware" dùng chung cho gRPC server/client
package interceptor

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"log/slog"
	"runtime/debug"
	"strings"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

type ctxKey int

const (
	requestIDKey ctxKey = iota
	clientKey
)

// RequestIDFrom lấy request ID đã được interceptor gắn vào context
func RequestIDFrom(ctx context.Context) string {
	id, _ := ctx.Value(requestIDKey).(string)
	return id
}

// ClientFrom lấy tên client đã xác thực
func ClientFrom(ctx context.Context) string {
	name, _ := ctx.Value(clientKey).(string)
	return name
}

// ========== SERVER: Request ID + header/trailer ==========

// UnaryRequestID đọc "x-request-id" từ metadata (hoặc tự tạo), trả lại trong header
// và gửi thời gian xử lý trong trailer
func UnaryRequestID() grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		id := firstValue(ctx, "x-request-id")
		if id == "" {
			id = newID()
		}
		ctx = context.WithValue(ctx, requestIDKey, id)
		// Header: gửi về client TRƯỚC response
		_ = grpc.SetHeader(ctx, metadata.Pairs("x-request-id", id))

		start := time.Now()
		resp, err := handler(ctx, req)
		// Trailer: gửi về client SAU response - hợp cho thông tin chỉ có ở cuối
		_ = grpc.SetTrailer(ctx, metadata.Pairs("x-server-time", time.Since(start).String()))
		return resp, err
	}
}

// ========== SERVER: Logging ==========

func UnaryLogging(log *slog.Logger) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		start := time.Now()
		resp, err := handler(ctx, req) // Gọi handler thật (hoặc interceptor tiếp theo)
		log.Info("unary",
			"method", info.FullMethod,
			"code", status.Code(err).String(),
			"duration", time.Since(start).Round(time.Microsecond),
			"request_id", RequestIDFrom(ctx),
		)
		return resp, err
	}
}

func StreamLogging(log *slog.Logger) grpc.StreamServerInterceptor {
	return func(srv any, ss grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
		start := time.Now()
		err := handler(srv, ss)
		log.Info("stream",
			"method", info.FullMethod,
			"code", status.Code(err).String(),
			"duration", time.Since(start).Round(time.Microsecond),
		)
		return err
	}
}

// ========== SERVER: Recovery ==========

// UnaryRecovery biến panic thành lỗi codes.Internal thay vì làm sập cả server
func UnaryRecovery(log *slog.Logger) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (resp any, err error) {
		defer func() {
			if r := recover(); r != nil {
				log.Error("panic", "method", info.FullMethod, "panic", r, "stack", string(debug.Stack()))
				err = status.Error(codes.Internal, "lỗi hệ thống") // Không lộ chi tiết panic ra ngoài
			}
		}()
		return handler(ctx, req)
	}
}

func StreamRecovery(log *slog.Logger) grpc.StreamServerInterceptor {
	return func(srv any, ss grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) (err error) {
		defer func() {
			if r := recover(); r != nil {
				log.Error("panic", "method", info.FullMethod, "panic", r)
				err = status.Error(codes.Internal, "lỗi hệ thống")
			}
		}()
		return handler(srv, ss)
	}
}

// ========== SERVER: Xác thực bằng API key ==========

// Auth kiểm tra header "authorization: Bearer <key>".
// keys: API key → tên client. public: các method KHÔNG cần xác thực (health check...)
type Auth struct {
	keys   map[string]string
	public map[string]bool
}

func NewAuth(keys map[string]string, publicMethods ...string) *Auth {
	a := &Auth{keys: keys, public: make(map[string]bool)}
	for _, m := range publicMethods {
		a.public[m] = true
	}
	return a
}

func (a *Auth) check(ctx context.Context, method string) (context.Context, error) {
	if a.public[method] {
		return ctx, nil
	}
	token, ok := strings.CutPrefix(firstValue(ctx, "authorization"), "Bearer ")
	if !ok || token == "" {
		return nil, status.Error(codes.Unauthenticated, "thiếu token (authorization: Bearer ...)")
	}
	for key, client := range a.keys {
		// So sánh thời gian hằng - chống tấn công dò token theo thời gian (Bài 12)
		if subtle.ConstantTimeCompare([]byte(token), []byte(key)) == 1 {
			return context.WithValue(ctx, clientKey, client), nil
		}
	}
	return nil, status.Error(codes.Unauthenticated, "token không hợp lệ")
}

func (a *Auth) Unary() grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		ctx, err := a.check(ctx, info.FullMethod)
		if err != nil {
			return nil, err
		}
		return handler(ctx, req)
	}
}

func (a *Auth) Stream() grpc.StreamServerInterceptor {
	return func(srv any, ss grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
		ctx, err := a.check(ss.Context(), info.FullMethod)
		if err != nil {
			return err
		}
		// ServerStream không có "WithContext" → bọc lại để thay Context()
		return handler(srv, &wrappedStream{ServerStream: ss, ctx: ctx})
	}
}

type wrappedStream struct {
	grpc.ServerStream
	ctx context.Context
}

func (w *wrappedStream) Context() context.Context { return w.ctx }

// ========== CLIENT ==========

// ClientAuth tự gắn token vào MỌI lời gọi đi ra
func ClientAuth(token string) grpc.UnaryClientInterceptor {
	return func(ctx context.Context, method string, req, reply any, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
		ctx = metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer "+token)
		return invoker(ctx, method, req, reply, cc, opts...)
	}
}

// ClientStreamAuth giống ClientAuth nhưng cho các RPC streaming
func ClientStreamAuth(token string) grpc.StreamClientInterceptor {
	return func(ctx context.Context, desc *grpc.StreamDesc, cc *grpc.ClientConn, method string, streamer grpc.Streamer, opts ...grpc.CallOption) (grpc.ClientStream, error) {
		ctx = metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer "+token)
		return streamer(ctx, desc, cc, method, opts...)
	}
}

// ClientPropagateRequestID chuyển tiếp request ID sang service tiếp theo
// → lần theo được một yêu cầu đi qua nhiều service trong log
func ClientPropagateRequestID() grpc.UnaryClientInterceptor {
	return func(ctx context.Context, method string, req, reply any, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
		if id := RequestIDFrom(ctx); id != "" {
			ctx = metadata.AppendToOutgoingContext(ctx, "x-request-id", id)
		}
		return invoker(ctx, method, req, reply, cc, opts...)
	}
}

// ========== Helpers ==========

// firstValue đọc giá trị đầu tiên của một key trong metadata gửi đến
func firstValue(ctx context.Context, key string) string {
	if vals := metadata.ValueFromIncomingContext(ctx, key); len(vals) > 0 {
		return vals[0]
	}
	return ""
}

func newID() string {
	b := make([]byte, 4)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
```

> 💡 **JWT thay cho API key?** Cấu trúc y hệt: trong `check`, thay vòng lặp so sánh key bằng việc **xác minh chữ ký JWT** (thư viện như `github.com/golang-jwt/jwt/v5`), kiểm tra `exp`, rồi đặt `claims.Subject` vào context. Phía client, gRPC còn có sẵn `grpc.WithPerRPCCredentials(...)` - một cách khác để tự gắn token vào mọi RPC (bắt buộc đi kèm TLS).

### 9.3. Chain - Thứ tự interceptor

`grpc.ChainUnaryInterceptor(a, b, c)` chạy theo thứ tự **a → b → c → handler → c → b → a** (giống củ hành, như middleware ở Bài 12):

```text
request ──► RequestID ──► Logging ──► Recovery ──► Auth ──► handler
                                                               │
response ◄── RequestID ◄── Logging ◄── Recovery ◄── Auth ◄─────┘
            (gắn trailer)  (ghi log)  (bắt panic)
```

| Lựa chọn | Lý do |
|----------|-------|
| `RequestID` ngoài cùng | Mọi lớp bên trong (kể cả log) đều thấy request ID |
| `Logging` **trước** `Auth` | Log được cả request **bị từ chối** (phát hiện ai đang dò token) |
| `Recovery` bọc handler và `Auth` | Panic ở đâu bên trong cũng bị bắt |

> ⚠️ **Context chỉ "chảy" vào trong, không "chảy" ra ngoài**: `Auth` gắn tên client vào `ctx` rồi truyền cho `handler`. Nhưng `Logging` nằm **ngoài** `Auth` → biến `ctx` của `Logging` **không** có tên client. Đó là lý do log bên dưới không có trường `client`, còn handler (nằm trong) thì đọc được bằng `interceptor.ClientFrom(ctx)`.

> 💡 Nếu cần interceptor "đủ bộ" cho production (log, auth, rate limit, retry, validator, Prometheus...), tham khảo `github.com/grpc-ecosystem/go-grpc-middleware/v2` - nhưng hãy tự viết vài cái trước để hiểu chúng hoạt động thế nào.

### 9.4. Chạy thử: xác thực, metadata, panic, deadline, cancel

File `cmd/middleware-demo/main.go` - chạy server và client **trong cùng một chương trình** (cổng ngẫu nhiên `127.0.0.1:0`) để dễ quan sát:

```go
package main

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"os"
	"time"

	catalogv1 "grpc-demo/gen/catalog/v1"
	"grpc-demo/internal/catalog"
	"grpc-demo/internal/interceptor"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

// demoServer "cài bug" và "làm chậm" để minh họa recovery và deadline
type demoServer struct {
	*catalog.Server
}

func (d demoServer) GetProduct(ctx context.Context, req *catalogv1.GetProductRequest) (*catalogv1.GetProductResponse, error) {
	switch req.GetId() {
	case "BUG":
		var p *catalogv1.Product
		_ = p.Name // nil pointer → panic!
	case "SLOW":
		select {
		case <-time.After(500 * time.Millisecond):
		case <-ctx.Done():
			fmt.Println("  [server] client đã bỏ đi →", ctx.Err(), "→ dừng xử lý")
			return nil, status.FromContextError(ctx.Err()).Err()
		}
	}
	return d.Server.GetProduct(ctx, req)
}

func main() {
	log := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		ReplaceAttr: func(_ []string, a slog.Attr) slog.Attr {
			if a.Key == slog.TimeKey {
				return slog.Attr{} // Bỏ thời gian cho output gọn
			}
			return a
		},
	}))

	auth := interceptor.NewAuth(
		map[string]string{"pos-secret-01": "may-pos-quay-1"}, // API key → tên client
		"/grpc.health.v1.Health/Check",                       // Method công khai
	)
	srv := grpc.NewServer(
		grpc.ChainUnaryInterceptor(
			interceptor.UnaryRequestID(),   // 1. ngoài cùng: gắn request ID
			interceptor.UnaryLogging(log),  // 2. log MỌI request, kể cả bị từ chối
			interceptor.UnaryRecovery(log), // 3. bắt panic từ các lớp bên trong
			auth.Unary(),                   // 4. trong cùng: xác thực
		),
		grpc.ChainStreamInterceptor(interceptor.StreamLogging(log), auth.Stream()),
	)
	catalogv1.RegisterCatalogServiceServer(srv, demoServer{catalog.NewServer(catalog.NewStore())})

	lis, _ := net.Listen("tcp", "127.0.0.1:0") // Cổng ngẫu nhiên còn trống
	go srv.Serve(lis)
	defer srv.GracefulStop()
	addr := lis.Addr().String()

	// ---------- Client KHÔNG có token ----------
	anon, _ := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	defer anon.Close()
	fmt.Println("1) Gọi không có token:")
	_, err := catalogv1.NewCatalogServiceClient(anon).GetProduct(context.Background(),
		&catalogv1.GetProductRequest{Id: "SP001"})
	fmt.Println("  →", status.Code(err), "|", status.Convert(err).Message())

	// ---------- Client có interceptor tự gắn token ----------
	conn, _ := grpc.NewClient(addr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithChainUnaryInterceptor(interceptor.ClientAuth("pos-secret-01")),
		grpc.WithChainStreamInterceptor(interceptor.ClientStreamAuth("pos-secret-01")),
	)
	defer conn.Close()
	client := catalogv1.NewCatalogServiceClient(conn)

	fmt.Println("2) Có token + metadata + đọc header/trailer:")
	ctx := metadata.AppendToOutgoingContext(context.Background(), "x-request-id", "req-42")
	var header, trailer metadata.MD
	resp, err := client.GetProduct(ctx, &catalogv1.GetProductRequest{Id: "SP001"},
		grpc.Header(&header),   // Nhận header server gửi
		grpc.Trailer(&trailer), // Nhận trailer server gửi
	)
	if err != nil {
		fmt.Println("  lỗi:", err)
		return
	}
	fmt.Println("  →", resp.GetProduct().GetName(),
		"| header x-request-id =", header.Get("x-request-id"),
		"| trailer có x-server-time?", len(trailer.Get("x-server-time")) == 1)

	fmt.Println("3) Handler bị panic:")
	_, err = client.GetProduct(context.Background(), &catalogv1.GetProductRequest{Id: "BUG"})
	fmt.Println("  →", status.Code(err), "| server vẫn sống, gọi tiếp:")
	_, err = client.GetProduct(context.Background(), &catalogv1.GetProductRequest{Id: "SP002"})
	fmt.Println("  → err =", err)

	fmt.Println("4) Deadline 100ms cho thao tác mất 500ms:")
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()
	start := time.Now()
	_, err = client.GetProduct(ctx, &catalogv1.GetProductRequest{Id: "SLOW"})
	fmt.Println("  →", status.Code(err), "sau", time.Since(start).Round(10*time.Millisecond))
	time.Sleep(50 * time.Millisecond) // Chờ log phía server in ra

	fmt.Println("5) Người dùng bấm Hủy sau 50ms:")
	ctx2, cancel2 := context.WithCancel(context.Background())
	time.AfterFunc(50*time.Millisecond, cancel2)
	_, err = client.GetProduct(ctx2, &catalogv1.GetProductRequest{Id: "SLOW"})
	fmt.Println("  →", status.Code(err))
	time.Sleep(50 * time.Millisecond) // Chờ log phía server in ra
}
```

```bash
go run ./cmd/middleware-demo
```

```text
// Output (dòng "level=..." là log của server):
1) Gọi không có token:
level=INFO msg=unary method=/catalog.v1.CatalogService/GetProduct code=Unauthenticated duration=4µs request_id=9818688c
  → Unauthenticated | thiếu token (authorization: Bearer ...)
2) Có token + metadata + đọc header/trailer:
level=INFO msg=unary method=/catalog.v1.CatalogService/GetProduct code=OK duration=3µs request_id=req-42
  → Cà phê sữa đá | header x-request-id = [req-42] | trailer có x-server-time? true
3) Handler bị panic:
level=ERROR msg=panic method=/catalog.v1.CatalogService/GetProduct panic="runtime error: invalid memory address or nil pointer dereference" stack="goroutine 67 [running]:\nruntime/debug.Stack()\n\t/usr/local/go1.24.7/src/runtime/d...
level=INFO msg=unary method=/catalog.v1.CatalogService/GetProduct code=Internal duration=180µs request_id=88e7fad6
  → Internal | server vẫn sống, gọi tiếp:
level=INFO msg=unary method=/catalog.v1.CatalogService/GetProduct code=OK duration=2µs request_id=feee8058
  → err = <nil>
4) Deadline 100ms cho thao tác mất 500ms:
  → DeadlineExceeded sau 100ms
  [server] client đã bỏ đi → context canceled → dừng xử lý
level=INFO msg=unary method=/catalog.v1.CatalogService/GetProduct code=Canceled duration=100.463ms request_id=87e4df07
5) Người dùng bấm Hủy sau 50ms:
  → Canceled
  [server] client đã bỏ đi → context canceled → dừng xử lý
level=INFO msg=unary method=/catalog.v1.CatalogService/GetProduct code=Canceled duration=50.636ms request_id=133d4901
```

**Phân tích**:

1. Không token → `Auth` chặn, handler **không bao giờ** chạy, nhưng `Logging` vẫn ghi lại
2. Request ID `req-42` do client gửi đi xuyên suốt: log server, header trả về. Trailer mang thời gian xử lý
3. Panic bị `Recovery` biến thành `Internal` - log có stack trace đầy đủ cho lập trình viên, client chỉ thấy "lỗi hệ thống". Server **vẫn phục vụ** request tiếp theo. (Không có `Recovery`, **cả tiến trình server sập** - gRPC-go không tự bắt panic như `net/http`!)
4. Client hết hạn sau đúng 100ms, **server cũng dừng ngay** (không làm nốt 400ms còn lại). Phía server thấy `context canceled` vì client gửi tín hiệu hủy (RST_STREAM) tới trước khi đồng hồ deadline của server kịp kêu - cả hai đều có nghĩa "**dừng lại, không ai chờ nữa**"
5. Hủy chủ động → client nhận `Canceled`, server dừng sau 50ms


## 📖 10. Bảo mật & vận hành

### 10.1. TLS - Mã hóa kết nối

Tất cả ví dụ tới giờ dùng `insecure.NewCredentials()` - dữ liệu (kể cả token!) đi **dạng rõ** trên mạng. Chỉ chấp nhận được khi **dev trên localhost**. Trên production: **luôn TLS**.

**Tạo chứng chỉ tự ký (self-signed) cho môi trường dev**:

```bash
mkdir -p certs
openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout certs/server.key -out certs/server.crt \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

openssl x509 -in certs/server.crt -noout -subject -ext subjectAltName
# Output:
# subject=CN = localhost
# X509v3 Subject Alternative Name:
#     DNS:localhost, IP Address:127.0.0.1
```

> ⚠️ **SAN (Subject Alternative Name) là bắt buộc**: Go từ 1.15 **bỏ qua** trường `CN` khi kiểm tra tên máy chủ. Thiếu `-addext "subjectAltName=..."` → lỗi `certificate relies on legacy Common Name field`. Và **đừng commit** `server.key` lên git (thêm `certs/` vào `.gitignore`).

File `cmd/tls-demo/main.go` - một server TLS và ba kiểu client:

```go
package main

import (
	"context"
	"crypto/tls"
	"fmt"
	"log"
	"net"
	"time"

	catalogv1 "grpc-demo/gen/catalog/v1"
	"grpc-demo/internal/catalog"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
)

func main() {
	// ===== Server có TLS =====
	serverCreds, err := credentials.NewServerTLSFromFile("certs/server.crt", "certs/server.key")
	if err != nil {
		log.Fatal(err)
	}
	srv := grpc.NewServer(grpc.Creds(serverCreds))
	catalogv1.RegisterCatalogServiceServer(srv, catalog.NewServer(catalog.NewStore()))
	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		log.Fatal(err)
	}
	go srv.Serve(lis)
	defer srv.Stop()
	_, port, _ := net.SplitHostPort(lis.Addr().String())
	addr := "localhost:" + port // Tên phải khớp SAN trong chứng chỉ

	// ✅ Client tin chứng chỉ tự ký (dev): nạp file .crt làm "CA"
	clientCreds, err := credentials.NewClientTLSFromFile("certs/server.crt", "")
	if err != nil {
		log.Fatal(err)
	}
	try("Client TLS + tin cert tự ký", addr, grpc.WithTransportCredentials(clientCreds))

	// ❌ Client TLS nhưng chỉ tin CA hệ thống → cert tự ký bị từ chối
	try("Client TLS + CA hệ thống", addr,
		grpc.WithTransportCredentials(credentials.NewTLS(&tls.Config{MinVersion: tls.VersionTLS12})))

	// ❌ Client không mã hóa gọi vào server TLS
	try("Client insecure", addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
}

func try(title, addr string, opt grpc.DialOption) {
	conn, err := grpc.NewClient(addr, opt)
	if err != nil {
		log.Fatal(err)
	}
	defer conn.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	resp, err := catalogv1.NewCatalogServiceClient(conn).
		GetProduct(ctx, &catalogv1.GetProductRequest{Id: "SP001"})
	if err != nil {
		st := status.Convert(err)
		fmt.Printf("❌ %s: %s\n   %s\n", title, st.Code(), st.Message())
		return
	}
	fmt.Printf("✅ %s: %s\n", title, resp.GetProduct().GetName())
}
```

```text
// Output (message lỗi dài đã được rút gọn bằng "..."):
✅ Client TLS + tin cert tự ký: Cà phê sữa đá
❌ Client TLS + CA hệ thống: Unavailable
   connection error: desc = "transport: authentication handshake failed: tls: failed to verify certificate: x509: certificate signed by unknown authority ..."
❌ Client insecure: Unavailable
   connection error: desc = "error reading server preface: read tcp 127.0.0.1:37660->127.0.0.1:32919: read: connection reset by peer"
```

**Trên production**:

- Chứng chỉ do **CA thật** cấp (Let's Encrypt cho endpoint public, CA nội bộ cho mạng trong) → client dùng `credentials.NewTLS(&tls.Config{})` là đủ (tin CA hệ thống)
- **mTLS** (mutual TLS): **cả hai** bên trình chứng chỉ - server biết chắc client là service nào. Server đặt `tls.Config{ClientAuth: tls.RequireAndVerifyClientCert, ClientCAs: pool}`, client đặt `Certificates: []tls.Certificate{...}`. Đây là cách phổ biến để xác thực **service-to-service**; service mesh (Istio, Linkerd) làm mTLS tự động cho bạn
- TLS thường được **kết thúc ở load balancer/ingress**; khi đó đoạn LB → service trong mạng nội bộ có thể dùng plaintext hoặc mTLS tùy chính sách bảo mật

### 10.2. Health checking - "Anh còn sống không?"

gRPC có **giao thức health check chuẩn** (`grpc.health.v1.Health`), được Kubernetes, Envoy, các load balancer hiểu sẵn. Server của chúng ta đã đăng ký ở mục 5.3:

```go
hs := health.NewServer()
hs.SetServingStatus("catalog.v1.CatalogService", healthpb.HealthCheckResponse_SERVING)
healthpb.RegisterHealthServer(srv, hs)
// ...
hs.Shutdown() // Khi tắt: mọi service → NOT_SERVING, LB ngừng gửi request mới
```

- Hỏi `service: ""` = sức khỏe **toàn server**; hỏi `service: "catalog.v1.CatalogService"` = sức khỏe **service cụ thể**
- Khi DB mất kết nối, bạn có thể `hs.SetServingStatus(..., NOT_SERVING)` - tương tự `/readyz` ở Bài 16
- Method `Check` (hỏi một lần) và `Watch` (stream - nhận thông báo mỗi khi trạng thái đổi)

### 10.3. Reflection + `grpcurl` - "curl cho gRPC"

Protobuf là nhị phân nên không dùng `curl` được. **`grpcurl`** giải quyết việc đó - nó dùng **reflection** để hỏi server "anh có những service/message nào?" rồi tự chuyển JSON ↔ protobuf.

```bash
go install github.com/fullstorydev/grpcurl/cmd/grpcurl@v1.9.3   # v1.9.4 cần Go 1.25
# hoặc: brew install grpcurl
```

Server phải bật reflection (đã làm ở mục 5.3: `reflection.Register(srv)`):

```bash
grpcurl -plaintext localhost:50051 list
```

```text
// Output:
catalog.v1.CatalogService
grpc.health.v1.Health
grpc.reflection.v1.ServerReflection
grpc.reflection.v1alpha.ServerReflection
```

```bash
grpcurl -plaintext localhost:50051 describe catalog.v1.CatalogService
```

```text
// Output:
catalog.v1.CatalogService is a service:
service CatalogService {
  rpc CheckPrices ( stream .catalog.v1.CheckPricesRequest ) returns ( stream .catalog.v1.CheckPricesResponse );
  rpc CreateProduct ( .catalog.v1.CreateProductRequest ) returns ( .catalog.v1.CreateProductResponse );
  rpc GetProduct ( .catalog.v1.GetProductRequest ) returns ( .catalog.v1.GetProductResponse );
  rpc ImportProducts ( stream .catalog.v1.ImportProductsRequest ) returns ( .catalog.v1.ImportProductsResponse );
  rpc ListProducts ( .catalog.v1.ListProductsRequest ) returns ( stream .catalog.v1.ListProductsResponse );
}
```

**Gọi RPC** (`-d` là request dạng JSON; field viết `snake_case` hay `lowerCamelCase` đều được):

```bash
grpcurl -plaintext -d '{"id":"SP002"}' localhost:50051 catalog.v1.CatalogService/GetProduct
```

```text
// Output:
{
  "product": {
    "id": "SP002",
    "name": "Trà đào cam sả",
    "category": "do-uong",
    "priceVnd": "35000",
    "stock": 50
  }
}
```

```bash
# Lỗi kèm details
grpcurl -plaintext -d '{"name":"","price_vnd":-5}' localhost:50051 catalog.v1.CatalogService/CreateProduct
```

```text
// Output:
ERROR:
  Code: InvalidArgument
  Message: dữ liệu sản phẩm không hợp lệ
  Details:
  1)	{
    	  "@type": "type.googleapis.com/google.rpc.BadRequest",
    	  "fieldViolations": [
    	    {
    	      "field": "name",
    	      "description": "không được để trống"
    	    },
    	    {
    	      "field": "price_vnd",
    	      "description": "phải lớn hơn 0"
    	    }
    	  ]
    	}
```

```bash
# Bidi stream: nhiều object JSON liên tiếp = nhiều message
grpcurl -plaintext -d '{"id":"SP001"} {"id":"SP003"}' localhost:50051 catalog.v1.CatalogService/CheckPrices

# Health check
grpcurl -plaintext -d '{"service":"catalog.v1.CatalogService"}' localhost:50051 grpc.health.v1.Health/Check
# Output: { "status": "SERVING" }

# Gửi metadata (-H) và xem header/trailer trả về (-v): thấy "x-request-id: abc123" trong
# "Response headers received" và "x-server-time: 24.246µs" trong "Response trailers received"
grpcurl -plaintext -H 'x-request-id: abc123' -v -d '{"id":"SP001"}' localhost:50051 catalog.v1.CatalogService/GetProduct
```


> ⚠️ **Reflection trên production?** Nó cho phép bất kỳ ai kết nối được **liệt kê toàn bộ API** của bạn. Nhiều team chỉ bật ở dev/staging (qua biến môi trường), hoặc chỉ cho phép sau xác thực. Không bật reflection thì `grpcurl` vẫn dùng được bằng cách chỉ file `.proto`: `grpcurl -import-path proto -proto catalog/v1/catalog.proto ...`

### 10.4. Keepalive - Giữ kết nối "sống"

Kết nối gRPC là kết nối HTTP/2 **dài hạn**. Các thiết bị mạng ở giữa (NAT, firewall, load balancer) hay **âm thầm cắt** kết nối im lặng quá lâu → RPC tiếp theo treo cho tới khi hết deadline. **Keepalive** gửi gói `PING` định kỳ để phát hiện kết nối chết sớm.

```go
// Server (đã có ở mục 5.3)
grpc.KeepaliveParams(keepalive.ServerParameters{
	MaxConnectionIdle: 5 * time.Minute, // Đóng kết nối không có RPC nào quá 5 phút
	Time:              1 * time.Minute, // Im lặng 1 phút → ping client
	Timeout:           10 * time.Second, // Ping không được trả lời sau 10s → coi như chết
}),
grpc.KeepaliveEnforcementPolicy(keepalive.EnforcementPolicy{
	MinTime:             10 * time.Second, // Client ping dày hơn mức này → server đóng kết nối (GOAWAY)
	PermitWithoutStream: true,             // Cho phép client ping cả khi không có RPC nào
}),

// Client
grpc.WithKeepaliveParams(keepalive.ClientParameters{
	Time:                30 * time.Second, // PHẢI >= MinTime của server
	Timeout:             10 * time.Second,
	PermitWithoutStream: true,
}),
```

> ⚠️ Client ping **dày hơn** `MinTime` của server → server gửi `GOAWAY` với lý do `too_many_pings` và đóng kết nối. Thống nhất số liệu này giữa các team.

> 💡 `MaxConnectionAge` (server) buộc client **kết nối lại định kỳ** - hữu ích khi scale thêm server: client cũ sẽ dần được phân bổ sang server mới.

### 10.5. Load balancing, service discovery & retry

**Vấn đề**: HTTP/2 dùng **một** kết nối lâu dài cho nhiều RPC. Nếu bạn đặt một load balancer **tầng 4 (TCP)** trước 3 bản sao service, client kết nối **một lần** → **mọi** RPC dồn vào **một** bản sao! gRPC cần cân bằng tải **theo từng RPC**:

| Cách | Mô tả |
|------|-------|
| **Client-side LB** | Client biết danh sách địa chỉ (từ DNS, Consul, etcd, Kubernetes headless Service) và tự chia RPC. gRPC-go có sẵn policy `pick_first` (mặc định) và `round_robin` |
| **Proxy tầng 7 (L7)** | Envoy, NGINX, Traefik, cloud LB hiểu HTTP/2 → chia theo từng RPC. Client chỉ cần một địa chỉ |
| **Service mesh** | Istio/Linkerd đặt proxy cạnh mỗi service - LB, mTLS, retry tự động |

**Service discovery** qua **resolver**: phần đầu của địa chỉ quyết định cách tìm server:

```go
grpc.NewClient("dns:///orders.internal:50051", ...)      // Hỏi DNS, nhận NHIỀU địa chỉ IP (mặc định)
grpc.NewClient("passthrough:///10.0.0.5:50051", ...)     // Dùng nguyên địa chỉ, không phân giải
grpc.NewClient("unix:///var/run/app.sock", ...)          // Unix socket
// Trên Kubernetes: "dns:///catalog.default.svc.cluster.local:50051" với headless Service (clusterIP: None)
```

File `cmd/lb-demo/main.go` - 3 bản sao, so sánh `pick_first` và `round_robin` (dùng resolver "thủ công" thay cho DNS để chạy offline). Khối import được lược bỏ; ngoài các package đã quen, file cần `google.golang.org/grpc/resolver` và `google.golang.org/grpc/resolver/manual`:

```go
package main

// (lược bỏ khối import - xem ghi chú ở trên)

// startBackend chạy một bản sao (replica) của service, trả lời kèm header x-backend
func startBackend(name string) string {
	tag := func(ctx context.Context, req any, _ *grpc.UnaryServerInfo, h grpc.UnaryHandler) (any, error) {
		_ = grpc.SetHeader(ctx, metadata.Pairs("x-backend", name))
		return h(ctx, req)
	}
	srv := grpc.NewServer(grpc.UnaryInterceptor(tag))
	catalogv1.RegisterCatalogServiceServer(srv, catalog.NewServer(catalog.NewStore()))
	lis, _ := net.Listen("tcp", "127.0.0.1:0")
	go srv.Serve(lis)
	return lis.Addr().String()
}

func main() {
	addrs := []resolver.Address{
		{Addr: startBackend("replica-A")},
		{Addr: startBackend("replica-B")},
		{Addr: startBackend("replica-C")},
	}

	for _, policy := range []string{"pick_first", "round_robin"} {
		// Resolver "thủ công" thay cho DNS/Consul/Kubernetes: trả về danh sách địa chỉ
		r := manual.NewBuilderWithScheme("demo")
		r.InitialState(resolver.State{Addresses: addrs})

		conn, err := grpc.NewClient("demo:///catalog",
			grpc.WithResolvers(r),
			grpc.WithTransportCredentials(insecure.NewCredentials()),
			grpc.WithDefaultServiceConfig(`{"loadBalancingConfig": [{"`+policy+`": {}}]}`),
		)
		if err != nil {
			panic(err)
		}
		client := catalogv1.NewCatalogServiceClient(conn)
		fmt.Printf("%-12s:", policy)
		for range 6 {
			var h metadata.MD
			_, err := client.GetProduct(context.Background(),
				&catalogv1.GetProductRequest{Id: "SP001"}, grpc.Header(&h))
			if err != nil {
				panic(err)
			}
			fmt.Print(" ", h.Get("x-backend")[0])
		}
		fmt.Println()
		conn.Close()
	}
}
```

```text
// Output:
pick_first  : replica-A replica-A replica-A replica-A replica-A replica-A
round_robin : replica-C replica-C replica-A replica-B replica-C replica-A
```

`pick_first` dồn mọi thứ vào một bản sao; `round_robin` chia đều (vài RPC đầu dồn vào bản sao **kết nối xong trước** - các bản sao khác đang bắt tay).

**Retry tự động qua service config**: gRPC-go có sẵn cơ chế thử lại - bạn khai báo bằng JSON, **không** phải tự viết vòng lặp như Bài 12:

```go
const serviceConfig = `{
  "methodConfig": [{
    "name": [{"service": "catalog.v1.CatalogService", "method": "GetProduct"}],
    "timeout": "2s",
    "retryPolicy": {
      "maxAttempts": 4,
      "initialBackoff": "0.1s",
      "maxBackoff": "1s",
      "backoffMultiplier": 2,
      "retryableStatusCodes": ["UNAVAILABLE"]
    }
  }]
}`

conn, err := grpc.NewClient(addr,
	grpc.WithTransportCredentials(insecure.NewCredentials()),
	grpc.WithDefaultServiceConfig(serviceConfig),
)
```

Thử với server "ốm" trả `Unavailable` 2 lần đầu: client nhận **thành công**, server bị gọi **3 lần** - code gọi RPC không cần sửa gì. Chỉ đưa vào `retryableStatusCodes` những lỗi **tạm thời**, và chỉ cho method **idempotent** (nguyên tắc y hệt Bài 12).

## 📖 11. Testing với `bufconn` ⭐

Test gRPC thế nào cho **nhanh**, **không mở cổng mạng**, mà vẫn đi qua **đủ** tầng protobuf, status code, interceptor? Dùng **`bufconn`** - một "mạng giả" trong bộ nhớ: server `Serve` trên một listener ảo, client "quay số" vào chính listener đó.

> 💡 **Ví von**: `httptest.NewServer` ở Bài 12 vẫn mở một cổng thật trên localhost. `bufconn` còn "ảo" hơn: hai đầu nói chuyện qua một **ống nước trong bộ nhớ** - không có cổng, không xung đột cổng khi chạy test song song, không bị firewall chặn.

File `internal/catalog/server_test.go`:

```go
package catalog_test

import (
	"context"
	"errors"
	"io"
	"net"
	"testing"
	"time"

	catalogv1 "grpc-demo/gen/catalog/v1"
	"grpc-demo/internal/catalog"

	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"
)

// newTestClient dựng server THẬT trên "mạng giả" trong bộ nhớ (bufconn)
// → test đi qua đủ: protobuf, interceptor, status code... nhưng không mở cổng nào
func newTestClient(t *testing.T) catalogv1.CatalogServiceClient {
	t.Helper()
	lis := bufconn.Listen(1024 * 1024) // Buffer 1 MB

	srv := grpc.NewServer()
	catalogv1.RegisterCatalogServiceServer(srv, catalog.NewServer(catalog.NewStore()))
	go srv.Serve(lis)
	t.Cleanup(srv.Stop)

	conn, err := grpc.NewClient("passthrough:///bufnet",
		// Thay vì quay số TCP, nối thẳng vào bufconn
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
			return lis.DialContext(ctx)
		}),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { conn.Close() })
	return catalogv1.NewCatalogServiceClient(conn)
}

func TestGetProduct(t *testing.T) {
	client := newTestClient(t)

	tests := []struct {
		name     string
		id       string
		wantCode codes.Code
		wantName string
	}{
		{"tìm thấy", "SP001", codes.OK, "Cà phê sữa đá"},
		{"không tồn tại", "SP999", codes.NotFound, ""},
		{"thiếu id", "", codes.InvalidArgument, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), time.Second)
			defer cancel()

			resp, err := client.GetProduct(ctx, &catalogv1.GetProductRequest{Id: tt.id})
			// status.Code(nil) == codes.OK → so sánh gọn cho cả thành công lẫn lỗi
			if got := status.Code(err); got != tt.wantCode {
				t.Fatalf("code = %v, muốn %v (err: %v)", got, tt.wantCode, err)
			}
			if got := resp.GetProduct().GetName(); got != tt.wantName {
				t.Errorf("name = %q, muốn %q", got, tt.wantName)
			}
		})
	}
}

func TestCreateProductValidation(t *testing.T) {
	client := newTestClient(t)

	_, err := client.CreateProduct(context.Background(), &catalogv1.CreateProductRequest{Name: "", PriceVnd: 0})
	st := status.Convert(err)
	if st.Code() != codes.InvalidArgument {
		t.Fatalf("code = %v, muốn InvalidArgument", st.Code())
	}
	// Kiểm tra cả chi tiết lỗi
	var fields []string
	for _, d := range st.Details() {
		if br, ok := d.(*errdetails.BadRequest); ok {
			for _, v := range br.GetFieldViolations() {
				fields = append(fields, v.GetField())
			}
		}
	}
	if len(fields) != 2 || fields[0] != "name" || fields[1] != "price_vnd" {
		t.Errorf("field vi phạm = %v, muốn [name price_vnd]", fields)
	}
}

func TestListProductsStream(t *testing.T) {
	client := newTestClient(t)

	stream, err := client.ListProducts(context.Background(), &catalogv1.ListProductsRequest{Category: "do-uong"})
	if err != nil {
		t.Fatal(err)
	}
	var ids []string
	for {
		resp, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			t.Fatal(err)
		}
		ids = append(ids, resp.GetProduct().GetId())
	}
	if len(ids) != 2 {
		t.Errorf("nhận %v, muốn 2 sản phẩm đồ uống", ids)
	}
}
```

Interceptor chỉ là **một hàm** → test trực tiếp, không cần server. File `internal/interceptor/interceptor_test.go`:

```go
package interceptor

import (
	"context"
	"testing"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

// Interceptor chỉ là một hàm → test trực tiếp, không cần server
func TestAuthUnary(t *testing.T) {
	auth := NewAuth(map[string]string{"k1": "app-1"}, "/grpc.health.v1.Health/Check")
	intercept := auth.Unary()

	tests := []struct {
		name       string
		method     string
		authHeader string // rỗng = không gửi
		wantCode   codes.Code
		wantClient string
	}{
		{"đúng token", "/shop.v1.X/Get", "Bearer k1", codes.OK, "app-1"},
		{"sai token", "/shop.v1.X/Get", "Bearer k2", codes.Unauthenticated, ""},
		{"thiếu Bearer", "/shop.v1.X/Get", "k1", codes.Unauthenticated, ""},
		{"không gửi", "/shop.v1.X/Get", "", codes.Unauthenticated, ""},
		{"method công khai", "/grpc.health.v1.Health/Check", "", codes.OK, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			if tt.authHeader != "" {
				// Giả lập metadata client gửi đến
				ctx = metadata.NewIncomingContext(ctx, metadata.Pairs("authorization", tt.authHeader))
			}
			var gotClient string
			handler := func(ctx context.Context, req any) (any, error) {
				gotClient = ClientFrom(ctx) // Handler thấy được client đã xác thực
				return "ok", nil
			}
			_, err := intercept(ctx, nil, &grpc.UnaryServerInfo{FullMethod: tt.method}, handler)
			if status.Code(err) != tt.wantCode {
				t.Fatalf("code = %v, muốn %v", status.Code(err), tt.wantCode)
			}
			if gotClient != tt.wantClient {
				t.Errorf("client = %q, muốn %q", gotClient, tt.wantClient)
			}
		})
	}
}
```

```bash
go test -race -v ./internal/...
```

```text
// Output (rút gọn):
=== RUN   TestGetProduct
=== RUN   TestGetProduct/tìm_thấy
=== RUN   TestGetProduct/không_tồn_tại
=== RUN   TestGetProduct/thiếu_id
--- PASS: TestGetProduct (0.01s)
    --- PASS: TestGetProduct/tìm_thấy (0.01s)
    --- PASS: TestGetProduct/không_tồn_tại (0.00s)
    --- PASS: TestGetProduct/thiếu_id (0.00s)
=== RUN   TestCreateProductValidation
--- PASS: TestCreateProductValidation (0.01s)
=== RUN   TestListProductsStream
--- PASS: TestListProductsStream (0.00s)
PASS
ok  	grpc-demo/internal/catalog	1.041s
--- PASS: TestAuthUnary (0.00s)
    ...
PASS
ok  	grpc-demo/internal/interceptor	1.036s
```

**Mẹo test gRPC**:

- `newTestClient` là **helper dùng chung** - mỗi test có server **riêng**, dữ liệu **sạch**, dọn dẹp bằng `t.Cleanup`
- Muốn test cả interceptor: truyền `grpc.ChainUnaryInterceptor(...)` vào `grpc.NewServer` trong helper
- Code **gọi** service khác (như `OrderService` gọi `InventoryService`) phụ thuộc vào **interface** `inventoryv1.InventoryServiceClient` → trong test, viết một **fake** cài đặt interface đó (Bài 16), không cần server thật
- `status.Code(err)` trả `codes.OK` khi `err == nil` → so sánh một dòng cho cả trường hợp thành công lẫn lỗi

## 📖 12. Graceful stop - Tắt server không làm rơi request

`catalog-server` (mục 5.3) đã làm đúng quy trình của Bài 16, phiên bản gRPC:

| Bước | Code | Tác dụng |
|------|------|----------|
| 1 | `signal.NotifyContext(..., os.Interrupt, syscall.SIGTERM)` | Bắt Ctrl+C / `docker stop` / Kubernetes |
| 2 | `hs.Shutdown()` | Health → `NOT_SERVING`: load balancer ngừng gửi request mới |
| 3 | `srv.GracefulStop()` | Đóng listener, **không nhận RPC mới**, chờ các RPC đang chạy **hoàn tất** |
| 4 | `time.After(10s)` → `srv.Stop()` | Quá hạn thì **cắt ngang** (stream dài hạn như chat sẽ không bao giờ tự kết thúc!) |

Thử: chạy server với DB "chậm" 2 giây, gửi một request, rồi nhấn Ctrl+C **khi request đang xử lý**:

```bash
go run ./cmd/catalog-server -slow 2s
```

```text
// Output (server):
time=2026-09-26T10:21:53.558Z level=INFO msg="catalog server đang chạy" addr=0.0.0.0:50051
time=2026-09-26T10:21:54.558Z level=INFO msg="nhận tín hiệu tắt, đang dừng..."
time=2026-09-26T10:21:56.072Z level=INFO msg=unary method=/catalog.v1.CatalogService/GetProduct code=OK duration=2.000353s request_id=381dd5e7
time=2026-09-26T10:21:56.073Z level=INFO msg=stream method=/grpc.reflection.v1.ServerReflection/ServerReflectionInfo code=OK duration=2.005194s
time=2026-09-26T10:21:56.074Z level=INFO msg="đã dừng êm đẹp"
```

Request đang chạy **vẫn hoàn tất** (`code=OK` sau 2 giây) và client nhận đủ kết quả; request **mới** gửi tới sau Ctrl+C bị từ chối ngay (`connection refused`) → client/LB chuyển sang bản sao khác.

## 📖 13. grpc-gateway - Một service, cả gRPC lẫn REST

Nhớ lại: trình duyệt không gọi gRPC trực tiếp được. **grpc-gateway** sinh ra một **reverse proxy** HTTP/JSON → gRPC từ **chú thích** trong file `.proto`. Bạn viết service **một lần**, có cả hai.

```text
curl / trình duyệt ── POST /v1/todos (JSON) ──► Gateway (:8081) ── gRPC ──► TodoService (:50052)
grpcurl / service khác ───────────────────── gRPC ────────────────────────► TodoService (:50052)
```

**Bước 1**: Lấy file chú thích của Google (`google/api/annotations.proto` và `google/api/http.proto`) từ repo [github.com/googleapis/googleapis](https://github.com/googleapis/googleapis) và đặt vào `third_party/google/api/`. (Nếu dùng Buf Schema Registry, có thể thay bằng `deps: [buf.build/googleapis/googleapis]` trong `buf.yaml` rồi chạy `buf dep update`.)

**Bước 2**: Cài plugin và thư viện (ghim version):

```bash
go install github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-grpc-gateway@v2.28.0
go get github.com/grpc-ecosystem/grpc-gateway/v2@v2.28.0
```

**Bước 3**: Viết `.proto` có chú thích HTTP - `proto/todo/v1/todo.proto` (gợi nhớ Todo API của Bài 10):

```protobuf
syntax = "proto3";

package todo.v1;

import "google/api/annotations.proto";

option go_package = "grpc-demo/gen/todo/v1;todov1";

service TodoService {
  rpc CreateTodo(CreateTodoRequest) returns (CreateTodoResponse) {
    // POST /v1/todos, body JSON → CreateTodoRequest
    option (google.api.http) = {
      post: "/v1/todos"
      body: "*"
    };
  }
  rpc GetTodo(GetTodoRequest) returns (GetTodoResponse) {
    // {id} trong URL → field id của GetTodoRequest
    option (google.api.http) = {get: "/v1/todos/{id}"};
  }
}

message Todo {
  int64 id = 1;
  string title = 2;
  bool done = 3;
}

message CreateTodoRequest {
  string title = 1;
}

message CreateTodoResponse {
  Todo todo = 1;
}

message GetTodoRequest {
  int64 id = 1;
}

message GetTodoResponse {
  Todo todo = 1;
}
```

`make generate` (plugin `protoc-gen-grpc-gateway` đã có trong `buf.gen.yaml`) sinh thêm file `gen/todo/v1/todo.pb.gw.go`.

**Bước 4**: `cmd/todo-gateway/main.go` - chạy gRPC server và gateway:

```go
package main

import (
	"context"
	"log"
	"net"
	"net/http"
	"strings"
	"sync"

	todov1 "grpc-demo/gen/todo/v1"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
)

// todoServer: service gRPC bình thường - KHÔNG biết gì về HTTP/JSON
type todoServer struct {
	todov1.UnimplementedTodoServiceServer
	mu    sync.Mutex
	todos map[int64]*todov1.Todo
	next  int64
}

func (s *todoServer) CreateTodo(_ context.Context, req *todov1.CreateTodoRequest) (*todov1.CreateTodoResponse, error) {
	if strings.TrimSpace(req.GetTitle()) == "" {
		return nil, status.Error(codes.InvalidArgument, "title không được để trống")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.next++
	t := &todov1.Todo{Id: s.next, Title: req.GetTitle()}
	s.todos[t.Id] = t
	return &todov1.CreateTodoResponse{Todo: t}, nil
}

func (s *todoServer) GetTodo(_ context.Context, req *todov1.GetTodoRequest) (*todov1.GetTodoResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	t, ok := s.todos[req.GetId()]
	if !ok {
		return nil, status.Errorf(codes.NotFound, "todo %d không tồn tại", req.GetId())
	}
	return &todov1.GetTodoResponse{Todo: t}, nil
}

func main() {
	// 1. gRPC server ở cổng 50052
	grpcSrv := grpc.NewServer()
	todov1.RegisterTodoServiceServer(grpcSrv, &todoServer{todos: map[int64]*todov1.Todo{}})
	lis, err := net.Listen("tcp", ":50052")
	if err != nil {
		log.Fatal(err)
	}
	go grpcSrv.Serve(lis)

	// 2. Gateway: HTTP/JSON (cổng 8081) → dịch → gọi gRPC (cổng 50052)
	gwMux := runtime.NewServeMux()
	err = todov1.RegisterTodoServiceHandlerFromEndpoint(context.Background(), gwMux, "localhost:50052",
		[]grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())})
	if err != nil {
		log.Fatal(err)
	}
	log.Println("gRPC :50052 | REST :8081")
	log.Fatal(http.ListenAndServe(":8081", gwMux))
}
```

```bash
go run ./cmd/todo-gateway
curl -s -X POST localhost:8081/v1/todos -d '{"title":"Học gRPC"}'
curl -s localhost:8081/v1/todos/1
curl -s -i localhost:8081/v1/todos/99
curl -s -X POST localhost:8081/v1/todos -d '{"title":"  "}'
```

```text
// Output:
{"todo":{"id":"1","title":"Học gRPC","done":false}}
{"todo":{"id":"1","title":"Học gRPC","done":false}}
HTTP/1.1 404 Not Found
Content-Type: application/json
Date: Sat, 26 Sep 2026 10:15:17 GMT
Content-Length: 62

{"code":5,"message":"todo 99 không tồn tại","details":[]}
{"code":3,"message":"title không được để trống","details":[]}
```

**Điều thú vị**:

- `codes.NotFound` tự thành **HTTP 404**, `codes.InvalidArgument` thành **400** (bảng ở mục 7.1)
- `{id}` trong URL tự điền vào field `id` của `GetTodoRequest`; `body: "*"` nghĩa là toàn bộ body JSON → request message
- JSON theo chuẩn `protojson`: `int64` thành chuỗi `"1"`
- Cùng lúc đó, service vẫn nói gRPC "thuần" ở cổng 50052: `grpcurl -plaintext -import-path proto -import-path third_party -proto todo/v1/todo.proto -d '{"id":1}' localhost:50052 todo.v1.TodoService/GetTodo`
- grpc-gateway còn có plugin `protoc-gen-openapiv2` sinh **tài liệu Swagger/OpenAPI** từ cùng file `.proto`

> 💡 **Các lựa chọn khác**: **ConnectRPC** (`connectrpc.com/connect`) - một thư viện nói được cả gRPC, gRPC-Web và giao thức Connect (JSON qua HTTP/1.1, gọi được bằng `curl`) trên `net/http` chuẩn; **gRPC-Web** + Envoy cho frontend gọi trực tiếp. Nếu bắt đầu dự án mới cần phục vụ cả trình duyệt, ConnectRPC rất đáng cân nhắc.

## 📖 14. gRPC trong Docker

Dockerfile multi-stage, image `distroless` và Docker Compose bạn **đã học ở [Bài 17](./17-docker.md)**. Với gRPC chỉ có vài điểm khác: **cổng** (thường 50051), và **health check** - image `distroless` không có shell, không có `curl`, mà health check gRPC lại cần một **client gRPC**.

**Mẹo**: cho chính binary server một chế độ `-healthcheck` - gọi `Health/Check` vào bản thân rồi thoát với mã 0/1. File `cmd/catalog-server/healthcheck.go`:

```go
package main

import (
	"context"
	"fmt"
	"net"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
)

// runHealthcheck gọi Health/Check vào chính server đang chạy trong container.
// Trả về exit code: 0 = khỏe, 1 = không khỏe → dùng cho Docker HEALTHCHECK
func runHealthcheck(addr string) int {
	_, port, err := net.SplitHostPort(addr)
	if err != nil {
		fmt.Println("địa chỉ sai:", err)
		return 1
	}
	conn, err := grpc.NewClient("127.0.0.1:"+port, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		fmt.Println(err)
		return 1
	}
	defer conn.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	resp, err := healthpb.NewHealthClient(conn).Check(ctx, &healthpb.HealthCheckRequest{})
	if err != nil {
		fmt.Println("không khỏe:", err)
		return 1
	}
	fmt.Println("trạng thái:", resp.GetStatus())
	if resp.GetStatus() != healthpb.HealthCheckResponse_SERVING {
		return 1
	}
	return 0
}
```

`Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1
# ===== Giai đoạn 1: build =====
FROM golang:1.24-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/catalog-server ./cmd/catalog-server

# ===== Giai đoạn 2: image chạy =====
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/catalog-server /catalog-server
USER nonroot:nonroot
EXPOSE 50051
# Dạng exec ["..."] - distroless KHÔNG có /bin/sh nên dạng shell sẽ không chạy được
HEALTHCHECK --interval=5s --timeout=3s --start-period=2s --retries=3 \
  CMD ["/catalog-server", "-healthcheck"]
ENTRYPOINT ["/catalog-server"]
```

```bash
docker build -t catalog-server:dev .
docker images catalog-server:dev --format '{{.Repository}}:{{.Tag}} {{.Size}}'
# Output: catalog-server:dev 21.6MB
docker run -d --name catalog -p 50051:50051 catalog-server:dev
docker ps --filter name=catalog --format '{{.Names}}  {{.Status}}'
# Output: catalog  Up 9 seconds (healthy)

grpcurl -plaintext -d '{"id":"SP003"}' localhost:50051 catalog.v1.CatalogService/GetProduct   # Gọi từ máy host
docker stop catalog     # Gửi SIGTERM → GracefulStop
docker logs catalog | tail -2
# Output:
# time=... level=INFO msg="nhận tín hiệu tắt, đang dừng..."
# time=... level=INFO msg="đã dừng êm đẹp"
```

> ⚠️ **Health check phải ở dạng exec** `CMD ["/catalog-server", "-healthcheck"]`. Dạng shell (`CMD /catalog-server -healthcheck`, hay `docker run --health-cmd="..."`) chạy qua `/bin/sh` - mà distroless **không có** shell. Container sẽ mãi ở trạng thái `health: starting`/`unhealthy` với lỗi: `exec: "/bin/sh": stat /bin/sh: no such file or directory`.

**Trên Kubernetes** (1.24+ bật sẵn, GA từ 1.27) không cần mẹo trên - kubelet tự gọi giao thức health gRPC:

```yaml
livenessProbe:
  grpc:
    port: 50051
readinessProbe:
  grpc:
    port: 50051
    service: catalog.v1.CatalogService   # Tùy chọn: hỏi sức khỏe service cụ thể
```

**Docker Compose** cho nhiều service gRPC (ứng dụng thực tế 1 ở dưới): một `Dockerfile.service` dùng chung, chọn service bằng build arg:

```dockerfile
# syntax=docker/dockerfile:1
# Dockerfile dùng chung cho nhiều service: chọn service bằng build arg SERVICE
FROM golang:1.24-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
ARG SERVICE
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/app ./cmd/${SERVICE}

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/app /app
USER nonroot:nonroot
ENTRYPOINT ["/app"]
```

`compose.yaml` - các container gọi nhau bằng **tên service** (`inventory:50061`), không phải `localhost`:

```yaml
services:
  inventory:
    build:
      context: .
      dockerfile: Dockerfile.service
      args: { SERVICE: inventory-server }
    environment:
      INVENTORY_KEY_FOR_ORDER: ${INVENTORY_KEY_FOR_ORDER:-order-svc-key}
    # Không mở cổng ra ngoài: chỉ order gọi được (mạng nội bộ của compose)

  order:
    build:
      context: .
      dockerfile: Dockerfile.service
      args: { SERVICE: order-server }
    command: ["-inventory", "inventory:50061"] # Gọi bằng TÊN service, không phải localhost
    ports: ["50060:50060"]
    environment:
      INVENTORY_KEY_FOR_ORDER: ${INVENTORY_KEY_FOR_ORDER:-order-svc-key}
      ORDER_KEY_FOR_WEB: ${ORDER_KEY_FOR_WEB:-web-shop-key}
    depends_on: [inventory]
```

```bash
docker compose up -d --build
docker compose ps --format '{{.Service}} {{.Status}} {{.Ports}}'
go run ./cmd/order-client            # Client chạy trên máy host, gọi vào cổng 50060
```

```text
// Output:
inventory Up 2 seconds
order Up 2 seconds 0.0.0.0:50060->50060/tcp
✅ Đơn hợp lệ → DH-0001, tổng 83000 đ, giữ hàng GIU-0001
❌ Hết hàng   → FailedPrecondition: không đủ hàng TRA-DAO: còn 2, cần 3
❌ Sai mã     → NotFound: không có sản phẩm PIZZA
```

### 💡 Tips quan trọng

- ✅ **Contract-first**: thiết kế `.proto` trước, review như review code; mỗi RPC có `XxxRequest`/`XxxResponse` riêng; package có version (`shop.v1`)
- ✅ **Không bao giờ** đổi/dùng lại field number; xóa field thì `reserved`; chạy `buf lint` + `buf breaking` trong CI
- ✅ **Ghim version** gRPC, protobuf, plugin, buf - commit hoặc sinh lại `gen/` giống hệt nhau trên mọi máy
- ✅ **Một `grpc.ClientConn` dùng chung**, tạo bằng `grpc.NewClient`, đóng khi tắt ứng dụng
- ✅ **Mọi RPC có deadline**; server truyền `ctx` của request xuống mọi lời gọi phía sau và dừng khi `ctx.Done()`
- ✅ Trả lỗi bằng `status.Error(codes.X, ...)`, dịch lỗi domain ở ranh giới, **không lộ** lỗi nội bộ; client phân nhánh theo **code**
- ✅ Interceptor cho những thứ "cắt ngang": request ID, log, recovery (**bắt buộc** - gRPC không tự bắt panic), auth
- ✅ TLS trên production, health check chuẩn, graceful stop có giới hạn thời gian
- ✅ Test bằng `bufconn` + table-driven; phụ thuộc vào **interface client** để dễ fake
- ⚠️ Stream: một goroutine `Send`, một goroutine `Recv`; luôn có đường kết thúc (deadline/cancel/`io.EOF`)
- ⚠️ Message mặc định tối đa **4 MB** khi nhận - dữ liệu lớn thì **stream theo chunk**, đừng tăng giới hạn tùy tiện


## 🌍 Ứng dụng thực tế

Bốn ứng dụng dưới đây dùng lại các file `.proto` trong thư mục `proto/` (đã sinh code bằng `make generate`) và package `internal/interceptor` ở mục 9.

> 💡 **Để bài gọn, code Go trong phần này lược bỏ khối `import`**. VS Code (gopls) tự thêm import khi bạn lưu file. Nếu cần tự viết: `xxxv1` là `grpc-demo/gen/xxx/v1` (ví dụ `inventoryv1 "grpc-demo/gen/inventory/v1"`), `interceptor` là `grpc-demo/internal/interceptor`, `grpc`/`codes`/`status`/`metadata` là `google.golang.org/grpc/...`, `insecure` là `google.golang.org/grpc/credentials/insecure`, `timestamppb` là `google.golang.org/protobuf/types/known/timestamppb`; còn lại là thư viện chuẩn.

### Ứng dụng 1: Microservice đặt hàng - OrderService gọi InventoryService ⭐

**Bài toán**: Web bán hàng gọi `OrderService.PlaceOrder`. Để tạo đơn, `OrderService` phải gọi `InventoryService.ReserveStock` để giữ hàng và lấy giá. Yêu cầu:

- Mỗi tầng **xác thực** bằng API key riêng: web → order (`web-shop-key`), order → inventory (`order-svc-key`)
- Gọi inventory có **deadline 300ms** - kho chậm thì báo "thử lại sau" chứ không treo cả hệ thống
- **Request ID** đi xuyên qua cả hai service để lần theo log
- Lỗi của kho (hết hàng, sai mã) được **dịch** thành lỗi phù hợp cho client

```text
order-client ──(Bearer web-shop-key, x-request-id: web-1)──► OrderService :50060
                                                                   │ ctx timeout 300ms
                                                                   │ (Bearer order-svc-key, x-request-id: web-1)
                                                                   ▼
                                                            InventoryService :50061
```

**`proto/inventory/v1/inventory.proto`**:

```protobuf
syntax = "proto3";

package inventory.v1;

option go_package = "grpc-demo/gen/inventory/v1;inventoryv1";

service InventoryService {
  // Giữ hàng cho một đơn: đủ hàng thì trừ kho và trả về đơn giá
  rpc ReserveStock(ReserveStockRequest) returns (ReserveStockResponse);
}

message StockItem {
  string sku = 1;
  int32 quantity = 2;
}

message ReserveStockRequest {
  string order_id = 1;
  repeated StockItem items = 2;
}

message ReservedItem {
  string sku = 1;
  int32 quantity = 2;
  int64 unit_price_vnd = 3;
}

message ReserveStockResponse {
  string reservation_id = 1;
  repeated ReservedItem items = 2;
}
```

**`proto/order/v1/order.proto`**:

```protobuf
syntax = "proto3";

package order.v1;

option go_package = "grpc-demo/gen/order/v1;orderv1";

service OrderService {
  rpc PlaceOrder(PlaceOrderRequest) returns (PlaceOrderResponse);
}

message OrderItem {
  string sku = 1;
  int32 quantity = 2;
}

message PlaceOrderRequest {
  string customer_id = 1;
  repeated OrderItem items = 2;
}

message PlaceOrderResponse {
  string order_id = 1;
  int64 total_vnd = 2;
  string reservation_id = 3;
}
```

**`cmd/inventory-server/main.go`** - kiểm tra **tất cả** món trước rồi mới trừ kho (tất cả hoặc không gì cả):

```go
package main

// (lược bỏ khối import - xem ghi chú ở trên)

type item struct {
	priceVND int64
	stock    int32
}

type inventoryServer struct {
	inventoryv1.UnimplementedInventoryServiceServer
	log   *slog.Logger
	delay time.Duration

	mu     sync.Mutex
	items  map[string]*item
	nextID int
}

func (s *inventoryServer) ReserveStock(ctx context.Context, req *inventoryv1.ReserveStockRequest) (*inventoryv1.ReserveStockResponse, error) {
	if len(req.GetItems()) == 0 {
		return nil, status.Error(codes.InvalidArgument, "đơn không có sản phẩm nào")
	}
	if s.delay > 0 { // Giả lập kho đang quá tải
		select {
		case <-time.After(s.delay):
		case <-ctx.Done():
			s.log.Warn("bỏ dở vì người gọi đã hủy", "err", ctx.Err(), "request_id", interceptor.RequestIDFrom(ctx))
			return nil, status.FromContextError(ctx.Err()).Err()
		}
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	// Bước 1: kiểm tra TẤT CẢ trước - thiếu một món thì không trừ món nào
	for _, it := range req.GetItems() {
		stock, ok := s.items[it.GetSku()]
		if !ok {
			return nil, status.Errorf(codes.NotFound, "không có sản phẩm %s", it.GetSku())
		}
		if it.GetQuantity() <= 0 {
			return nil, status.Errorf(codes.InvalidArgument, "số lượng %s phải > 0", it.GetSku())
		}
		if stock.stock < it.GetQuantity() {
			return nil, status.Errorf(codes.FailedPrecondition,
				"không đủ hàng %s: còn %d, cần %d", it.GetSku(), stock.stock, it.GetQuantity())
		}
	}
	// Bước 2: trừ kho
	resp := &inventoryv1.ReserveStockResponse{}
	for _, it := range req.GetItems() {
		stock := s.items[it.GetSku()]
		stock.stock -= it.GetQuantity()
		resp.Items = append(resp.Items, &inventoryv1.ReservedItem{
			Sku: it.GetSku(), Quantity: it.GetQuantity(), UnitPriceVnd: stock.priceVND,
		})
	}
	s.nextID++
	resp.ReservationId = fmt.Sprintf("GIU-%04d", s.nextID)
	s.log.Info("đã giữ hàng", "order_id", req.GetOrderId(), "reservation", resp.ReservationId,
		"caller", interceptor.ClientFrom(ctx), "request_id", interceptor.RequestIDFrom(ctx))
	return resp, nil
}

func main() {
	addr := flag.String("addr", ":50061", "địa chỉ lắng nghe")
	delay := flag.Duration("delay", 0, "giả lập xử lý chậm")
	flag.Parse()
	log := slog.New(slog.NewTextHandler(os.Stdout, nil)).With("svc", "inventory")

	// API key của các service được phép gọi (thực tế: đọc từ secret/biến môi trường - Bài 16)
	auth := interceptor.NewAuth(map[string]string{
		cmp.Or(os.Getenv("INVENTORY_KEY_FOR_ORDER"), "order-svc-key"): "order-service",
	})
	srv := grpc.NewServer(grpc.ChainUnaryInterceptor(
		interceptor.UnaryRequestID(),
		interceptor.UnaryLogging(log),
		interceptor.UnaryRecovery(log),
		auth.Unary(),
	))
	inventoryv1.RegisterInventoryServiceServer(srv, &inventoryServer{
		log: log, delay: *delay,
		items: map[string]*item{
			"CF-SUA-DA": {priceVND: 29000, stock: 10},
			"TRA-DAO":   {priceVND: 35000, stock: 2},
			"BANH-MI":   {priceVND: 25000, stock: 5},
		},
	})

	lis, err := net.Listen("tcp", *addr)
	if err != nil {
		log.Error("listen", "err", err)
		os.Exit(1)
	}
	log.Info("inventory service đang chạy", "addr", *addr, "delay", *delay)
	if err := srv.Serve(lis); err != nil {
		log.Error("serve", "err", err)
	}
}
```

**`cmd/order-server/main.go`** - vừa là **server** (cho web) vừa là **client** (của inventory):

```go
package main

// (lược bỏ khối import - xem ghi chú ở trên)

type orderServer struct {
	orderv1.UnimplementedOrderServiceServer
	log       *slog.Logger
	inventory inventoryv1.InventoryServiceClient // Phụ thuộc là INTERFACE → dễ test với fake
	seq       atomic.Int64
}

func (s *orderServer) PlaceOrder(ctx context.Context, req *orderv1.PlaceOrderRequest) (*orderv1.PlaceOrderResponse, error) {
	if req.GetCustomerId() == "" || len(req.GetItems()) == 0 {
		return nil, status.Error(codes.InvalidArgument, "cần customer_id và ít nhất 1 sản phẩm")
	}
	orderID := fmt.Sprintf("DH-%04d", s.seq.Add(1))

	// Deadline cho lời gọi xuống inventory: tối đa 300ms,
	// và KHÔNG vượt quá deadline còn lại của client gọi mình (vì ctx con kế thừa ctx cha)
	invCtx, cancel := context.WithTimeout(ctx, 300*time.Millisecond)
	defer cancel()

	items := make([]*inventoryv1.StockItem, 0, len(req.GetItems()))
	for _, it := range req.GetItems() {
		items = append(items, &inventoryv1.StockItem{Sku: it.GetSku(), Quantity: it.GetQuantity()})
	}
	res, err := s.inventory.ReserveStock(invCtx, &inventoryv1.ReserveStockRequest{OrderId: orderID, Items: items})
	if err != nil {
		return nil, s.mapInventoryError(ctx, err)
	}

	var total int64
	for _, it := range res.GetItems() {
		total += it.GetUnitPriceVnd() * int64(it.GetQuantity())
	}
	s.log.Info("tạo đơn thành công", "order_id", orderID, "total_vnd", total,
		"customer", req.GetCustomerId(), "client", interceptor.ClientFrom(ctx),
		"request_id", interceptor.RequestIDFrom(ctx))
	return &orderv1.PlaceOrderResponse{OrderId: orderID, TotalVnd: total, ReservationId: res.GetReservationId()}, nil
}

// mapInventoryError: lỗi của service "hạ nguồn" → lỗi phù hợp cho client của MÌNH
func (s *orderServer) mapInventoryError(ctx context.Context, err error) error {
	st := status.Convert(err)
	switch st.Code() {
	case codes.NotFound, codes.FailedPrecondition, codes.InvalidArgument:
		return status.Error(st.Code(), st.Message()) // Lỗi nghiệp vụ: báo nguyên văn cho client
	case codes.DeadlineExceeded, codes.Unavailable:
		s.log.Warn("inventory không phản hồi kịp", "code", st.Code().String(),
			"request_id", interceptor.RequestIDFrom(ctx))
		return status.Error(codes.Unavailable, "hệ thống kho đang bận, vui lòng thử lại")
	default:
		s.log.Error("inventory lỗi", "err", err)
		return status.Error(codes.Internal, "lỗi hệ thống") // Không lộ lỗi nội bộ
	}
}

func main() {
	addr := flag.String("addr", ":50060", "địa chỉ lắng nghe")
	invAddr := flag.String("inventory", "localhost:50061", "địa chỉ inventory service")
	flag.Parse()
	log := slog.New(slog.NewTextHandler(os.Stdout, nil)).With("svc", "order")

	// Kết nối tới inventory: tạo MỘT LẦN, dùng chung cho mọi request
	invConn, err := grpc.NewClient(*invAddr,
		grpc.WithTransportCredentials(insecure.NewCredentials()), // Production: TLS/mTLS
		grpc.WithChainUnaryInterceptor(
			interceptor.ClientPropagateRequestID(), // Chuyển tiếp x-request-id
			interceptor.ClientAuth(cmp.Or(os.Getenv("INVENTORY_KEY_FOR_ORDER"), "order-svc-key")),
		),
	)
	if err != nil {
		log.Error("kết nối inventory", "err", err)
		os.Exit(1)
	}
	defer invConn.Close()

	auth := interceptor.NewAuth(map[string]string{
		cmp.Or(os.Getenv("ORDER_KEY_FOR_WEB"), "web-shop-key"): "web-shop",
	})
	srv := grpc.NewServer(grpc.ChainUnaryInterceptor(
		interceptor.UnaryRequestID(),
		interceptor.UnaryLogging(log),
		interceptor.UnaryRecovery(log),
		auth.Unary(),
	))
	orderv1.RegisterOrderServiceServer(srv, &orderServer{
		log: log, inventory: inventoryv1.NewInventoryServiceClient(invConn),
	})

	lis, err := net.Listen("tcp", *addr)
	if err != nil {
		log.Error("listen", "err", err)
		os.Exit(1)
	}
	log.Info("order service đang chạy", "addr", *addr, "inventory", *invAddr)
	if err := srv.Serve(lis); err != nil {
		log.Error("serve", "err", err)
	}
}
```

**`cmd/order-client/main.go`** - giả lập web gọi vào:

```go
package main

// (lược bỏ khối import - xem ghi chú ở trên)

func main() {
	addr := flag.String("addr", "localhost:50060", "địa chỉ order service")
	token := flag.String("token", "web-shop-key", "API key")
	flag.Parse()

	conn, err := grpc.NewClient(*addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatal(err)
	}
	defer conn.Close()
	client := orderv1.NewOrderServiceClient(conn)

	orders := []struct {
		title string
		items []*orderv1.OrderItem
	}{
		{"Đơn hợp lệ", []*orderv1.OrderItem{{Sku: "CF-SUA-DA", Quantity: 2}, {Sku: "BANH-MI", Quantity: 1}}},
		{"Hết hàng", []*orderv1.OrderItem{{Sku: "TRA-DAO", Quantity: 3}}},
		{"Sai mã", []*orderv1.OrderItem{{Sku: "PIZZA", Quantity: 1}}},
	}
	for i, o := range orders {
		// Deadline tổng cho cả chuỗi order → inventory: 1 giây
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		ctx = metadata.AppendToOutgoingContext(ctx,
			"authorization", "Bearer "+*token,
			"x-request-id", fmt.Sprintf("web-%d", i+1),
		)
		resp, err := client.PlaceOrder(ctx, &orderv1.PlaceOrderRequest{CustomerId: "KH-01", Items: o.items})
		cancel()
		if err != nil {
			st := status.Convert(err)
			fmt.Printf("❌ %-10s → %s: %s\n", o.title, st.Code(), st.Message())
			continue
		}
		fmt.Printf("✅ %-10s → %s, tổng %d đ, giữ hàng %s\n", o.title, resp.GetOrderId(), resp.GetTotalVnd(), resp.GetReservationId())
	}
}
```

**Chạy thử** với 3 terminal:

```bash
go run ./cmd/inventory-server       # Terminal 1
go run ./cmd/order-server           # Terminal 2
go run ./cmd/order-client           # Terminal 3
go run ./cmd/order-client -token hacker
```

```text
// Output (terminal 3):
✅ Đơn hợp lệ → DH-0001, tổng 83000 đ, giữ hàng GIU-0001
❌ Hết hàng   → FailedPrecondition: không đủ hàng TRA-DAO: còn 2, cần 3
❌ Sai mã     → NotFound: không có sản phẩm PIZZA
❌ Đơn hợp lệ → Unauthenticated: token không hợp lệ
❌ Hết hàng   → Unauthenticated: token không hợp lệ
❌ Sai mã     → Unauthenticated: token không hợp lệ
```

Log của hai service - cùng `request_id=web-1` xuất hiện ở **cả hai nơi**, và inventory biết người gọi là `order-service`:

```text
// Output (terminal 2 - order):
level=INFO msg="order service đang chạy" svc=order addr=:50060 inventory=localhost:50061
level=INFO msg="tạo đơn thành công" svc=order order_id=DH-0001 total_vnd=83000 customer=KH-01 client=web-shop request_id=web-1
level=INFO msg=unary svc=order method=/order.v1.OrderService/PlaceOrder code=OK duration=5.163ms request_id=web-1
level=INFO msg=unary svc=order method=/order.v1.OrderService/PlaceOrder code=FailedPrecondition duration=503µs request_id=web-2
level=INFO msg=unary svc=order method=/order.v1.OrderService/PlaceOrder code=NotFound duration=415µs request_id=web-3
level=INFO msg=unary svc=order method=/order.v1.OrderService/PlaceOrder code=Unauthenticated duration=2µs request_id=web-1
...

// Output (terminal 1 - inventory):
level=INFO msg="inventory service đang chạy" svc=inventory addr=:50061 delay=0s
level=INFO msg="đã giữ hàng" svc=inventory order_id=DH-0001 reservation=GIU-0001 caller=order-service request_id=web-1
level=INFO msg=unary svc=inventory method=/inventory.v1.InventoryService/ReserveStock code=OK duration=69µs request_id=web-1
level=INFO msg=unary svc=inventory method=/inventory.v1.InventoryService/ReserveStock code=FailedPrecondition duration=6µs request_id=web-2
level=INFO msg=unary svc=inventory method=/inventory.v1.InventoryService/ReserveStock code=NotFound duration=4µs request_id=web-3
```

(Đã bỏ phần `time=...` ở đầu mỗi dòng cho gọn.)

**Kho bị chậm**: tắt inventory, chạy lại với độ trễ 1 giây, rồi gọi lại client:

```bash
go run ./cmd/inventory-server -delay 1s    # Terminal 1
go run ./cmd/order-client                  # Terminal 3
```

```text
// Output (terminal 3):
❌ Đơn hợp lệ → Unavailable: hệ thống kho đang bận, vui lòng thử lại
❌ Hết hàng   → Unavailable: hệ thống kho đang bận, vui lòng thử lại
❌ Sai mã     → Unavailable: hệ thống kho đang bận, vui lòng thử lại

// Output (terminal 2 - order):
level=WARN msg="inventory không phản hồi kịp" svc=order code=DeadlineExceeded request_id=web-1
level=INFO msg=unary svc=order method=/order.v1.OrderService/PlaceOrder code=Unavailable duration=301.18ms request_id=web-1
...

// Output (terminal 1 - inventory):
level=WARN msg="bỏ dở vì người gọi đã hủy" svc=inventory err="context canceled" request_id=web-1
level=INFO msg=unary svc=inventory method=/inventory.v1.InventoryService/ReserveStock code=Canceled duration=299.654ms request_id=web-1
level=WARN msg="bỏ dở vì người gọi đã hủy" svc=inventory err="context deadline exceeded" request_id=web-2
level=INFO msg=unary svc=inventory method=/inventory.v1.InventoryService/ReserveStock code=DeadlineExceeded duration=300.869ms request_id=web-2
...
```

**Điểm then chốt**:

- Mỗi đơn chỉ chờ **~300ms** rồi trả lỗi rõ ràng, thay vì treo 1 giây (hay mãi mãi)
- Inventory **cũng dừng** sau 300ms (deadline được truyền qua mạng) - không tốn công giữ hàng cho đơn mà không ai chờ. Nó thấy `context canceled` hoặc `context deadline exceeded` tùy tín hiệu nào tới trước
- `DeadlineExceeded` của **kho** được dịch thành `Unavailable` cho **client** - client không cần biết bên trong có bao nhiêu service; `Unavailable` bảo họ "thử lại được"
- ⚠️ **Lưu ý về tính nhất quán**: nếu inventory **đã trừ kho** nhưng response về trễ hơn 300ms, order báo lỗi trong khi hàng đã bị giữ! Hệ thống thật xử lý bằng **idempotency key** (`order_id` gửi kèm - gọi lại không trừ lần hai), **hết hạn giữ hàng** (reservation tự hủy sau 15 phút nếu không xác nhận), hoặc pattern **Saga**. Đây là bài toán kinh điển của microservices - bạn sẽ gặp lại khi học sâu hơn

### Ứng dụng 2: Phòng chat realtime - Bidirectional streaming

**Bài toán**: Nhiều người vào cùng một phòng, ai gõ gì thì mọi người thấy ngay. Mỗi client giữ **một stream hai chiều** suốt phiên: gửi tin nhắn lên và nhận tin của người khác xuống **cùng lúc**.

**`proto/chat/v1/chat.proto`**:

```protobuf
syntax = "proto3";

package chat.v1;

import "google/protobuf/timestamp.proto";

option go_package = "grpc-demo/gen/chat/v1;chatv1";

service ChatService {
  // Bidirectional streaming: mỗi client giữ MỘT stream suốt phiên chat
  rpc Chat(stream ChatRequest) returns (stream ChatResponse);
}

message ChatRequest {
  string room = 1; // Message đầu tiên: tham gia phòng
  string user = 2;
  string text = 3;
}

message ChatResponse {
  string user = 1;
  string text = 2;
  google.protobuf.Timestamp sent_at = 3;
  bool system = 4; // true = thông báo hệ thống (vào/rời phòng)
}
```

**`cmd/chat-server/main.go`** - mỗi thành viên có một **hộp thư** (`outbox` - buffered channel). Phát tin = bỏ vào hộp thư của từng người; mỗi stream có **đúng một** goroutine lấy thư ra và `Send`:

```go
package main

// (lược bỏ khối import - xem ghi chú ở trên)

// member = một người đang kết nối. Mọi tin gửi cho họ đi qua channel "outbox"
type member struct {
	user   string
	outbox chan *chatv1.ChatResponse
}

type chatServer struct {
	chatv1.UnimplementedChatServiceServer
	mu    sync.Mutex
	rooms map[string]map[*member]bool // phòng → tập thành viên
}

func (s *chatServer) join(room string, m *member) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.rooms[room] == nil {
		s.rooms[room] = make(map[*member]bool)
	}
	s.rooms[room][m] = true
}

func (s *chatServer) leave(room string, m *member) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.rooms[room], m)
	if len(s.rooms[room]) == 0 {
		delete(s.rooms, room)
	}
}

// broadcast gửi tin cho mọi người trong phòng - KHÔNG BAO GIỜ bị chặn
func (s *chatServer) broadcast(room string, msg *chatv1.ChatResponse) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for m := range s.rooms[room] {
		select {
		case m.outbox <- msg:
		default:
			// Người này đọc quá chậm, outbox đầy → bỏ tin, không để 1 người làm chậm cả phòng
			log.Printf("bỏ tin gửi %s (mạng chậm)", m.user)
		}
	}
}

func (s *chatServer) Chat(stream grpc.BidiStreamingServer[chatv1.ChatRequest, chatv1.ChatResponse]) error {
	// 1. Tin nhắn đầu tiên = "xin vào phòng"
	first, err := stream.Recv()
	if err != nil {
		return err
	}
	room, user := first.GetRoom(), first.GetUser()
	if room == "" || user == "" {
		return status.Error(codes.InvalidArgument, "tin đầu tiên phải có room và user")
	}
	m := &member{user: user, outbox: make(chan *chatv1.ChatResponse, 32)}
	s.join(room, m)
	log.Printf("%s vào phòng %s", user, room)
	s.broadcast(room, system(user+" đã vào phòng"))

	// 2. Goroutine NHẬN: đọc tin từ client và phát cho cả phòng
	recvErr := make(chan error, 1)
	go func() {
		for {
			in, err := stream.Recv()
			if err != nil {
				recvErr <- err
				return
			}
			s.broadcast(room, &chatv1.ChatResponse{User: user, Text: in.GetText(), SentAt: timestamppb.Now()})
		}
	}()

	// 3. Goroutine hiện tại GỬI: chỉ MỘT goroutine được gọi stream.Send
	defer func() {
		s.leave(room, m)
		s.broadcast(room, system(user+" đã rời phòng"))
		log.Printf("%s rời phòng %s", user, room)
	}()
	for {
		select {
		case msg := <-m.outbox:
			if err := stream.Send(msg); err != nil {
				return err
			}
		case err := <-recvErr:
			if errors.Is(err, io.EOF) {
				return nil // Client chủ động thoát
			}
			return err
		case <-stream.Context().Done(): // Mất kết nối / server tắt
			return stream.Context().Err()
		}
	}
}

func system(text string) *chatv1.ChatResponse {
	return &chatv1.ChatResponse{User: "hệ thống", Text: text, SentAt: timestamppb.Now(), System: true}
}

func main() {
	lis, err := net.Listen("tcp", ":50070")
	if err != nil {
		log.Fatal(err)
	}
	srv := grpc.NewServer()
	chatv1.RegisterChatServiceServer(srv, &chatServer{rooms: make(map[string]map[*member]bool)})
	log.Println("chat server :50070")
	log.Fatal(srv.Serve(lis))
}
```

**`cmd/chat-client/main.go`** - một goroutine in tin nhận được, goroutine chính đọc bàn phím:

```go
package main

// (lược bỏ khối import - xem ghi chú ở trên)

func main() {
	user := flag.String("user", "khach", "tên hiển thị")
	room := flag.String("room", "go-vietnam", "phòng chat")
	flag.Parse()

	conn, err := grpc.NewClient("localhost:50070", grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatal(err)
	}
	defer conn.Close()

	// Ctrl+C → hủy context → stream đóng
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	// Chat là stream dài hạn → KHÔNG đặt timeout ngắn cho cả stream
	stream, err := chatv1.NewChatServiceClient(conn).Chat(ctx)
	if err != nil {
		log.Fatal(err)
	}
	// Tin đầu tiên: xin vào phòng
	if err := stream.Send(&chatv1.ChatRequest{Room: *room, User: *user}); err != nil {
		log.Fatal(err)
	}

	// Goroutine NHẬN: in mọi tin từ server
	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			msg, err := stream.Recv()
			if errors.Is(err, io.EOF) {
				return
			}
			if err != nil {
				fmt.Println("mất kết nối:", err)
				return
			}
			t := msg.GetSentAt().AsTime().Local().Format(time.TimeOnly)
			if msg.GetSystem() {
				fmt.Printf("[%s] *** %s\n", t, msg.GetText())
			} else {
				fmt.Printf("[%s] %s: %s\n", t, msg.GetUser(), msg.GetText())
			}
		}
	}()

	// Goroutine chính GỬI: đọc từng dòng bàn phím
	sc := bufio.NewScanner(os.Stdin)
	for sc.Scan() {
		if err := stream.Send(&chatv1.ChatRequest{Text: sc.Text()}); err != nil {
			break
		}
	}
	stream.CloseSend() // Hết input (Ctrl+D) → báo server mình rời đi
	<-done
}
```

**Chạy thử** với 3 terminal:

```bash
go run ./cmd/chat-server                  # Terminal 1
go run ./cmd/chat-client -user an         # Terminal 2 - gõ tin nhắn, Enter để gửi, Ctrl+D để thoát
go run ./cmd/chat-client -user binh       # Terminal 3
```

```text
// Output (terminal 2 - an):
[10:17:25] *** an đã vào phòng
[10:17:25] *** binh đã vào phòng
[10:17:26] an: Chào mọi người 👋
[10:17:26] binh: Chào An! Bài gRPC hay quá
[10:17:27] an: Mình đi ăn trưa nhé

// Output (terminal 3 - binh):
[10:17:25] *** binh đã vào phòng
[10:17:26] an: Chào mọi người 👋
[10:17:26] binh: Chào An! Bài gRPC hay quá
[10:17:27] an: Mình đi ăn trưa nhé
[10:17:27] *** an đã rời phòng
[10:17:28] binh: Còn ai không?

// Output (terminal 1 - server):
2026/09/26 10:17:24 chat server :50070
2026/09/26 10:17:25 an vào phòng go-vietnam
2026/09/26 10:17:25 binh vào phòng go-vietnam
2026/09/26 10:17:27 an rời phòng go-vietnam
2026/09/26 10:17:29 binh rời phòng go-vietnam
```

**Thiết kế đáng học**:

- **Không gọi `stream.Send` từ nhiều goroutine**: người A gửi tin không trực tiếp `Send` vào stream của người B - chỉ bỏ vào `outbox` của B. Goroutine của B tự lấy ra gửi → mỗi stream chỉ có **một** người gửi
- **Người chậm không làm chậm cả phòng**: `broadcast` dùng `select` + `default` - outbox đầy (mạng của ai đó quá chậm) thì bỏ tin của riêng người đó, thay vì khóa `mu` và chờ. (Hệ thống thật có thể ngắt kết nối người đó, hoặc lưu tin vào DB để họ tải lại)
- **Dọn dẹp bằng `defer`**: thoát bình thường (`io.EOF`), mất mạng hay server tắt (`ctx.Done()`) đều rời phòng và thông báo cho người khác
- Server có **nhiều bản sao** thì sao? Người ở bản sao A không thấy tin của người ở bản sao B → cần một "bus" chung như **Redis Pub/Sub**, **NATS** - xem bài tập 6

### Ứng dụng 3: Upload file lớn theo chunk - Client streaming + tiến độ

**Bài toán**: Upload file video vài trăm MB. Một message gRPC mặc định nhận tối đa **4 MB** - không thể gửi cả file trong một request. Giải pháp: chia **chunk 64 KB** và gửi bằng client streaming; client hiển thị **tiến độ**; server kiểm tra kích thước, tính **SHA-256**, chỉ lưu file khi nhận **đủ**.

**`proto/storage/v1/storage.proto`** - dùng `oneof` để message đầu tiên là thông tin file, các message sau là dữ liệu:

```protobuf
syntax = "proto3";

package storage.v1;

option go_package = "grpc-demo/gen/storage/v1;storagev1";

service StorageService {
  // Client streaming: message đầu là thông tin file, các message sau là từng chunk
  rpc Upload(stream UploadRequest) returns (UploadResponse);
}

message FileInfo {
  string name = 1;
  int64 size = 2; // Tổng số byte - để server kiểm tra và client tính % tiến độ
}

message UploadRequest {
  oneof data {
    FileInfo info = 1;
    bytes chunk = 2;
  }
}

message UploadResponse {
  string name = 1;
  int64 size = 2;
  string sha256 = 3;
  int32 chunks = 4;
}
```

**`cmd/upload-server/main.go`**:

```go
package main

// (lược bỏ khối import - xem ghi chú ở trên)

const maxFileSize = 100 << 20 // 100 MB

type storageServer struct {
	storagev1.UnimplementedStorageServiceServer
	dir string
}

func (s *storageServer) Upload(stream grpc.ClientStreamingServer[storagev1.UploadRequest, storagev1.UploadResponse]) error {
	// 1. Message đầu tiên PHẢI là thông tin file
	first, err := stream.Recv()
	if err != nil {
		return err
	}
	info := first.GetInfo()
	if info == nil {
		return status.Error(codes.InvalidArgument, "message đầu tiên phải là FileInfo")
	}
	if info.GetSize() <= 0 || info.GetSize() > maxFileSize {
		return status.Errorf(codes.InvalidArgument, "kích thước %d không hợp lệ (tối đa %d)", info.GetSize(), maxFileSize)
	}
	// Không tin tên file của client: bỏ mọi đường dẫn như "../../etc/passwd"
	name := filepath.Base(info.GetName())
	if name == "." || name == "/" {
		return status.Error(codes.InvalidArgument, "tên file không hợp lệ")
	}

	// 2. Ghi vào file tạm; xong xuôi mới đổi tên → không bao giờ có file "dở dang"
	tmp, err := os.CreateTemp(s.dir, name+".*.part")
	if err != nil {
		return status.Error(codes.Internal, "không tạo được file")
	}
	defer os.Remove(tmp.Name()) // Nếu thành công thì file tạm đã được rename → Remove không làm gì
	defer tmp.Close()

	hash := sha256.New()
	w := io.MultiWriter(tmp, hash) // Vừa ghi đĩa vừa tính checksum
	var received int64
	var chunks int32

	// 3. Nhận từng chunk cho đến io.EOF
	for {
		req, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			log.Printf("upload %s bị gián đoạn: %v", name, err)
			return err // Client hủy / mất mạng → defer xóa file tạm
		}
		chunk := req.GetChunk()
		received += int64(len(chunk))
		if received > info.GetSize() {
			return status.Error(codes.InvalidArgument, "nhận nhiều hơn kích thước đã khai báo")
		}
		if _, err := w.Write(chunk); err != nil {
			return status.Error(codes.Internal, "lỗi ghi file")
		}
		chunks++
	}
	if received != info.GetSize() {
		return status.Errorf(codes.DataLoss, "thiếu dữ liệu: nhận %d/%d byte", received, info.GetSize())
	}

	// 4. Đóng và đổi tên file tạm thành file thật
	if err := tmp.Close(); err != nil {
		return status.Error(codes.Internal, "lỗi ghi file")
	}
	if err := os.Rename(tmp.Name(), filepath.Join(s.dir, name)); err != nil {
		return status.Error(codes.Internal, "lỗi lưu file")
	}
	sum := hex.EncodeToString(hash.Sum(nil))
	log.Printf("đã nhận %s: %d byte, %d chunk, sha256=%s…", name, received, chunks, sum[:12])
	return stream.SendAndClose(&storagev1.UploadResponse{Name: name, Size: received, Sha256: sum, Chunks: chunks})
}

func main() {
	dir := flag.String("dir", "uploads", "thư mục lưu file")
	flag.Parse()
	if err := os.MkdirAll(*dir, 0o755); err != nil {
		log.Fatal(err)
	}
	lis, err := net.Listen("tcp", ":50080")
	if err != nil {
		log.Fatal(err)
	}
	srv := grpc.NewServer()
	storagev1.RegisterStorageServiceServer(srv, &storageServer{dir: *dir})
	log.Println("storage server :50080, lưu vào", *dir)
	log.Fatal(srv.Serve(lis))
}
```

**`cmd/upload-client/main.go`**:

```go
package main

// (lược bỏ khối import - xem ghi chú ở trên)

const chunkSize = 64 * 1024 // 64 KB - nhỏ hơn rất nhiều giới hạn 4 MB/message mặc định

func main() {
	path := flag.String("file", "", "file cần upload")
	flag.Parse()

	f, err := os.Open(*path)
	if err != nil {
		log.Fatal(err)
	}
	defer f.Close()
	st, err := f.Stat()
	if err != nil {
		log.Fatal(err)
	}

	conn, err := grpc.NewClient("localhost:50080", grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatal(err)
	}
	defer conn.Close()

	// Upload lớn: deadline rộng rãi hơn, nhưng VẪN phải có
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	stream, err := storagev1.NewStorageServiceClient(conn).Upload(ctx)
	if err != nil {
		log.Fatal(err)
	}

	// 1. Gửi thông tin file trước
	err = stream.Send(&storagev1.UploadRequest{
		Data: &storagev1.UploadRequest_Info{Info: &storagev1.FileInfo{Name: filepath.Base(*path), Size: st.Size()}},
	})
	if err != nil {
		log.Fatal(err)
	}

	// 2. Đọc file theo từng khúc, vừa gửi vừa tính sha256 để đối chiếu
	hash := sha256.New()
	r := io.TeeReader(f, hash)
	var sent int64
	lastPct := -1
	start := time.Now()
	for {
		// Mỗi chunk một buffer MỚI: gRPC cấm sửa message sau khi đã Send
		buf := make([]byte, chunkSize)
		n, err := io.ReadFull(r, buf)
		if n > 0 {
			if err := stream.Send(&storagev1.UploadRequest{
				Data: &storagev1.UploadRequest_Chunk{Chunk: buf[:n]},
			}); err != nil {
				// Server đã trả lỗi và đóng stream → lấy lỗi thật bằng CloseAndRecv
				_, err = stream.CloseAndRecv()
				log.Fatal("upload thất bại: ", err)
			}
			sent += int64(n)
			// In tiến độ mỗi khi qua mốc 20%
			if pct := int(sent * 100 / st.Size()); pct/20 != lastPct/20 {
				lastPct = pct
				fmt.Printf("  %3d%% [%-20s] %d/%d byte\n", pct, bar(pct), sent, st.Size())
			}
		}
		if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
			break // Hết file (khúc cuối có thể nhỏ hơn chunkSize)
		}
		if err != nil {
			log.Fatal(err)
		}
	}

	// 3. Báo gửi xong và nhận kết quả
	resp, err := stream.CloseAndRecv()
	if err != nil {
		log.Fatal("upload thất bại: ", err)
	}
	local := hex.EncodeToString(hash.Sum(nil))
	fmt.Printf("Xong sau %v: %s (%d byte, %d chunk)\n", time.Since(start).Round(time.Millisecond),
		resp.GetName(), resp.GetSize(), resp.GetChunks())
	fmt.Println("Checksum khớp?", local == resp.GetSha256())
}

func bar(pct int) string {
	b := make([]byte, pct/5)
	for i := range b {
		b[i] = '#'
	}
	return string(b)
}
```

**Chạy thử**:

```bash
go run ./cmd/upload-server                    # Terminal 1
head -c 5000000 /dev/urandom > video-demo.mp4 # Terminal 2: tạo file ~5 MB để thử
go run ./cmd/upload-client -file video-demo.mp4
sha256sum video-demo.mp4 uploads/video-demo.mp4
```

```text
// Output (terminal 2):
   20% [####                ] 1048576/5000000 byte
   40% [########            ] 2031616/5000000 byte
   60% [############        ] 3014656/5000000 byte
   81% [################    ] 4063232/5000000 byte
  100% [####################] 5000000/5000000 byte
Xong sau 46ms: video-demo.mp4 (5000000 byte, 77 chunk)
Checksum khớp? true
7c274a32c6ff8ac87c3611e8b613acbfc1031bd00415e33a0b64a4826a7c1a32  video-demo.mp4
7c274a32c6ff8ac87c3611e8b613acbfc1031bd00415e33a0b64a4826a7c1a32  uploads/video-demo.mp4

// Output (terminal 1):
2026/09/26 10:18:17 storage server :50080, lưu vào uploads
2026/09/26 10:18:17 đã nhận video-demo.mp4: 5000000 byte, 77 chunk, sha256=7c274a32c6ff…
```

**Upload bị ngắt giữa chừng** (nhấn Ctrl+C trên client khi đang gửi file 90 MB):

```text
// Output (terminal 1):
2026/09/26 10:18:30 upload big.iso bị gián đoạn: rpc error: code = Canceled desc = context canceled
```

Thư mục `uploads/` **không** có file dở dang - file tạm `.part` đã bị `defer os.Remove` xóa. Gửi file rỗng thì server từ chối ngay:

```text
upload thất bại: rpc error: code = InvalidArgument desc = kích thước 0 không hợp lệ (tối đa 104857600)
```

**Điểm đáng chú ý**:

- **Không tin client**: tên file qua `filepath.Base` (chống `../../etc/passwd` - Bài 12), giới hạn kích thước, kiểm tra số byte nhận **đúng bằng** số khai báo
- **Ghi file tạm rồi `Rename`** → người khác không bao giờ thấy file dở dang (rename trong cùng thư mục là thao tác nguyên tử)
- **`io.MultiWriter`** vừa ghi đĩa vừa tính hash trong **một lần** đọc; phía client dùng `io.TeeReader` tương tự
- **Mỗi chunk một buffer mới**: tái sử dụng `buf` sau `Send` là vi phạm quy tắc "không sửa message sau khi gửi"
- `Send` lỗi phía client thường chỉ là `io.EOF` - lỗi **thật** (ví dụ `InvalidArgument` từ server) lấy bằng `CloseAndRecv()`
- Client streaming chỉ trả response **ở cuối**. Muốn server **xác nhận từng phần** (để upload tiếp tục được sau khi mất mạng - *resumable upload*), dùng **bidi streaming**: server gửi lại "đã nhận tới byte X" - xem bài tập 4

### Ứng dụng 4: Bảng giá chứng khoán - Server streaming

**Bài toán**: Màn hình bảng giá đăng ký theo dõi vài mã cổ phiếu; server **đẩy** giá mới liên tục. Client đóng màn hình thì server phải **dừng** ngay, không rò goroutine.

**`proto/ticker/v1/ticker.proto`**:

```protobuf
syntax = "proto3";

package ticker.v1;

option go_package = "grpc-demo/gen/ticker/v1;tickerv1";

service TickerService {
  // Server streaming: đăng ký một lần, nhận giá liên tục
  rpc Watch(WatchRequest) returns (stream WatchResponse);
}

message WatchRequest {
  repeated string symbols = 1;
}

message WatchResponse {
  string symbol = 1;
  int64 price_vnd = 2;
  int64 change_vnd = 3;
}
```

**`cmd/ticker-demo/main.go`** (server và client trong một chương trình cho gọn):

```go
package main

// (lược bỏ khối import - xem ghi chú ở trên)

type tickerServer struct {
	tickerv1.UnimplementedTickerServiceServer
}

var basePrices = map[string]int64{"VNM": 61500, "FPT": 128000, "VCB": 89700}

func (tickerServer) Watch(req *tickerv1.WatchRequest, stream grpc.ServerStreamingServer[tickerv1.WatchResponse]) error {
	// Kiểm tra đầu vào TRƯỚC khi bắt đầu stream
	prices := map[string]int64{}
	for _, s := range req.GetSymbols() {
		p, ok := basePrices[s]
		if !ok {
			return status.Errorf(codes.InvalidArgument, "mã %q không tồn tại", s)
		}
		prices[s] = p
	}
	rng := rand.New(rand.NewPCG(1, 2)) // Seed cố định để output lặp lại được
	tick := time.NewTicker(200 * time.Millisecond)
	defer tick.Stop()
	for {
		select {
		case <-stream.Context().Done(): // Client tắt app / hủy → dừng, không rò goroutine
			fmt.Println("  [server] client ngừng theo dõi:", stream.Context().Err())
			return nil
		case <-tick.C:
			for _, s := range req.GetSymbols() {
				change := (rng.Int64N(21) - 10) * 100 // -1000..+1000 đ
				prices[s] += change
				err := stream.Send(&tickerv1.WatchResponse{Symbol: s, PriceVnd: prices[s], ChangeVnd: change})
				if err != nil {
					return err
				}
			}
		}
	}
}

func main() {
	srv := grpc.NewServer()
	tickerv1.RegisterTickerServiceServer(srv, tickerServer{})
	lis, _ := net.Listen("tcp", "127.0.0.1:0")
	go srv.Serve(lis)
	defer srv.GracefulStop()

	conn, _ := grpc.NewClient(lis.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	defer conn.Close()
	client := tickerv1.NewTickerServiceClient(conn)

	// Mã sai → lỗi trả về ở lần Recv đầu tiên
	bad, _ := client.Watch(context.Background(), &tickerv1.WatchRequest{Symbols: []string{"XYZ"}})
	_, err := bad.Recv()
	fmt.Println("Theo dõi XYZ:", status.Code(err), "-", status.Convert(err).Message())

	// Theo dõi 2 mã, nhận 6 cập nhật rồi tự hủy
	ctx, cancel := context.WithCancel(context.Background())
	stream, err := client.Watch(ctx, &tickerv1.WatchRequest{Symbols: []string{"VNM", "FPT"}})
	if err != nil {
		panic(err)
	}
	for range 6 {
		u, err := stream.Recv()
		if err != nil {
			panic(err)
		}
		arrow := "▲"
		if u.GetChangeVnd() < 0 {
			arrow = "▼"
		}
		fmt.Printf("%s %7d đ %s %+d\n", u.GetSymbol(), u.GetPriceVnd(), arrow, u.GetChangeVnd())
	}
	cancel() // Đóng màn hình bảng giá
	time.Sleep(300 * time.Millisecond)
}
```

```bash
go run ./cmd/ticker-demo
```

```text
// Output:
Theo dõi XYZ: InvalidArgument - mã "XYZ" không tồn tại
VNM   62100 đ ▲ +600
FPT  128200 đ ▲ +200
VNM   62700 đ ▲ +600
FPT  128800 đ ▲ +600
VNM   62100 đ ▼ -600
FPT  127800 đ ▼ -1000
  [server] client ngừng theo dõi: context canceled
```

**Điểm đáng chú ý**:

- Với server streaming, lỗi kiểm tra đầu vào **không** trả về ở lúc gọi `client.Watch(...)` mà ở lần **`Recv()` đầu tiên** - nhớ kiểm tra lỗi ở đó
- `select` trên `stream.Context().Done()` là **bắt buộc** cho stream vô hạn - nếu không, server cứ `time.Ticker` mãi và chỉ phát hiện client bỏ đi khi `Send` lỗi
- `time.NewTicker` + `defer tick.Stop()` (Bài 8) - không dùng `time.Tick` trong hàm có thể return
- Thực tế: giá đến từ Kafka/NATS hoặc sàn giao dịch; mỗi stream **đăng ký** vào một "hub" phát tin (giống `broadcast` của phòng chat)

## ⚠️ Lỗi thường gặp

### Lỗi 1: Đổi hoặc dùng lại field number

```protobuf
// ❌ Trước: string phone = 4;  Sau khi xóa phone, dùng lại số 4:
Tier tier = 4;   // Client cũ gửi phone (chuỗi) → server mới đọc thành tier → dữ liệu rác
```

✅ Xóa field thì thêm `reserved 4; reserved "phone";`. Chạy `buf breaking` trong CI.

### Lỗi 2: Không đặt deadline

```go
// ❌ Server bên kia treo → goroutine này treo mãi, tích tụ tới khi hết bộ nhớ
resp, err := client.GetProduct(context.Background(), req)

// ✅
ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
defer cancel()
resp, err := client.GetProduct(ctx, req)
```

### Lỗi 3: Trả `error` thường thay vì `status`

```go
return nil, fmt.Errorf("query failed: %w", err)   // ❌ Client nhận codes.Unknown + lộ chi tiết nội bộ
return nil, status.Error(codes.Internal, "lỗi hệ thống") // ✅ (và log err đầy đủ ở server)
```

### Lỗi 4: Tạo `ClientConn` mới cho mỗi request

```go
// ❌ Mỗi request: bắt tay TCP + TLS + HTTP/2 lại từ đầu, rò kết nối nếu quên Close
func handler(...) { conn, _ := grpc.NewClient(addr, ...); client := pb.NewXClient(conn); ... }
```

✅ Tạo **một** `ClientConn` khi khởi động (như `invConn` trong ứng dụng 1), truyền client vào qua constructor (DI - Bài 16).

### Lỗi 5: Gọi `stream.Send` từ nhiều goroutine

```go
// ❌ Data race / hỏng stream: 2 goroutine cùng Send
for _, m := range members { go m.stream.Send(msg) }
```

✅ Mỗi stream một goroutine gửi, người khác gửi qua channel (như `outbox` trong phòng chat). Chạy `go test -race` để bắt lỗi này.

### Lỗi 6: Quên `io.EOF` hoặc coi nó là lỗi

```go
resp, err := stream.Recv()
if err != nil { log.Fatal(err) }  // ❌ io.EOF (kết thúc bình thường) cũng làm chương trình chết
```

✅ `if errors.Is(err, io.EOF) { break }` **trước**, rồi mới xử lý `err != nil`.

### Lỗi 7: Không có recovery interceptor

Handler gRPC panic → **cả tiến trình server sập** (khác với `net/http` tự bắt panic cho từng request). ✅ Luôn có `UnaryRecovery` + `StreamRecovery`.

### Lỗi 8: Dùng `encoding/json` cho message protobuf

```go
json.Marshal(customer) // ❌ oneof sai định dạng, enum thành số, bỏ qua quy ước protobuf
protojson.Marshal(customer) // ✅
```

Tương tự: dùng `proto.Equal`, `proto.Clone` thay vì `==`, `reflect.DeepEqual`, hay copy struct bằng `*msg`.

### Lỗi 9: Gửi dữ liệu lớn trong một message

```go
// ❌ Gửi tên sản phẩm 8 MB trong một request
_, err := client.CreateProduct(ctx, &catalogv1.CreateProductRequest{Name: strings.Repeat("x", 8<<20), PriceVnd: 1})
fmt.Println(err)
// Output: rpc error: code = ResourceExhausted desc = grpc: received message larger than max (8388615 vs. 4194304)
```

✅ Dữ liệu lớn → **stream theo chunk** (ứng dụng 3). Chỉ tăng `grpc.MaxRecvMsgSize` khi thật sự cần và có giới hạn rõ ràng.

### Lỗi 10: `insecure` trên production, hoặc cert thiếu SAN

`insecure.NewCredentials()` chỉ dùng trên localhost. Chứng chỉ tự tạo phải có `subjectAltName` khớp tên/IP mà client dùng để kết nối.

### Lỗi 11: Chạy `go get ...@latest` / `go mod tidy` bừa bãi

Bản gRPC mới có thể yêu cầu Go mới hơn → `go.mod` bị nâng `go` directive, CI dùng Go cũ bị hỏng. ✅ `go get` với version cụ thể, đặt `GOTOOLCHAIN=local` khi cần kiểm soát.

### Lỗi 12: Load balancer tầng 4 trước gRPC

Mọi RPC dồn vào một backend vì chỉ có một kết nối HTTP/2 lâu dài. ✅ Dùng client-side `round_robin` + DNS/headless Service, hoặc proxy tầng 7 (Envoy...).


## 🏋️ Bài tập

### Bài tập 1: Hoàn thiện CatalogService (⭐ Dễ)

- Thêm RPC `UpdateProduct` và `DeleteProduct` vào `catalog.proto` (mỗi RPC có `Request`/`Response` riêng), chạy `buf lint` cho sạch
- `DeleteProduct` với id không tồn tại trả `NotFound`; cập nhật giá âm trả `InvalidArgument` kèm `BadRequest`
- Gọi thử bằng `grpcurl`, viết test table-driven bằng `bufconn`

### Bài tập 2: Tiến hóa API an toàn (⭐ Dễ)

- Commit `catalog.proto` lên nhánh `main`. Thêm field `optional string description = 6;` và `repeated string tags = 7;` vào `Product` → `buf breaking` phải **pass**
- Thử xóa field `stock` → `buf breaking` báo lỗi. Sửa lại cho đúng bằng `reserved`
- Chạy client **cũ** (build trước khi thêm field) với server **mới** - chứng minh client cũ vẫn chạy bình thường

### Bài tập 3: Interceptor rate limit & metrics (⭐⭐ Trung bình)

- Viết `UnaryRateLimit` dùng `golang.org/x/time/rate` (Bài 14): mỗi **client** (lấy từ `ClientFrom(ctx)`) tối đa 5 request/giây, vượt thì trả `ResourceExhausted` kèm `errdetails.RetryInfo`
- Viết interceptor đếm số request theo `method` và `code` bằng `expvar` (Bài 16)
- Đặt các interceptor vào chain đúng thứ tự (rate limit phải nằm **sau** auth - vì sao?) và viết test không cần server như `TestAuthUnary`

### Bài tập 4: Upload có thể tiếp tục (⭐⭐ Trung bình)

- Chuyển `Upload` thành **bidi streaming**: sau mỗi 1 MB, server gửi lại `UploadProgress{received_bytes}`
- Thêm RPC `GetUploadStatus(upload_id)` trả số byte đã nhận; client bị ngắt giữa chừng có thể gọi lại và **gửi tiếp từ byte đó** (dùng `f.Seek`)
- Kiểm tra checksum cuối cùng vẫn khớp

### Bài tập 5: Triển khai hệ thống đặt hàng bằng Docker Compose + TLS (⭐⭐⭐ Khó)

- Tạo CA riêng bằng `openssl`, cấp chứng chỉ cho `order` và `inventory` (SAN = tên service trong compose)
- Bật **mTLS** giữa order ↔ inventory: inventory chỉ chấp nhận client có chứng chỉ do CA của bạn ký; bỏ API key cho đoạn này, lấy tên service từ chứng chỉ (`peer.FromContext` → `credentials.TLSInfo`)
- Thêm health check chuẩn cho cả hai service, cấu hình `healthcheck` trong `compose.yaml` và `depends_on: condition: service_healthy`
- Viết `OrderService` test với **fake** `InventoryServiceClient` (không cần server): kiểm tra việc dịch `DeadlineExceeded` → `Unavailable`

### Bài tập 6: Chat nhiều server (⭐⭐⭐ Khó)

- Chạy 2 bản sao `chat-server` (cổng 50070 và 50071). Người ở hai server khác nhau phải thấy tin của nhau: dùng NATS (`github.com/nats-io/nats.go`) hoặc Redis Pub/Sub làm "bus" chung - mỗi server publish tin của người dùng mình, subscribe tin của phòng
- Client kết nối qua `round_robin` với cả 2 địa chỉ; khi một server tắt (`GracefulStop` có giới hạn thời gian), client **tự kết nối lại** và vào lại phòng
- Lưu 50 tin gần nhất mỗi phòng; người mới vào nhận lại lịch sử bằng một RPC **server streaming** `History`

## ✅ Checklist hoàn thành

- [ ] Giải thích được RPC là gì, gRPC khác REST ở đâu, khi nào nên và không nên dùng gRPC
- [ ] Viết được file `.proto` với message, enum (có `_UNSPECIFIED = 0`), `repeated`, `map`, `oneof`, `optional`, message lồng nhau, well-known types
- [ ] Hiểu vì sao không được đổi/dùng lại field number và biết dùng `reserved`
- [ ] Cài `protoc`, `protoc-gen-go`, `protoc-gen-go-grpc`, `buf` với version được ghim; sinh code bằng cả `protoc` và `buf generate`
- [ ] Chạy `buf lint` và `buf breaking` thành công
- [ ] Viết server + client cho đủ 4 kiểu RPC: unary, server streaming, client streaming, bidi streaming
- [ ] Trả lỗi bằng `status`/`codes`, đính kèm `errdetails.BadRequest`, dịch lỗi domain ở ranh giới
- [ ] Mọi RPC có deadline; server dừng sớm khi `ctx.Done()`; truyền deadline sang service khác
- [ ] Gửi/đọc metadata, header và trailer
- [ ] Viết interceptor unary & stream: request ID, logging, recovery, auth; hiểu thứ tự chain
- [ ] Chạy server TLS với chứng chỉ tự ký; biết mTLS dùng khi nào
- [ ] Bật health check, reflection và dùng thành thạo `grpcurl`
- [ ] Cấu hình keepalive, `round_robin`, retry policy qua service config
- [ ] Test service bằng `bufconn` + table-driven, `go test -race` sạch
- [ ] Graceful stop có giới hạn thời gian
- [ ] Chạy grpc-gateway: gọi cùng một service bằng `curl` (REST) và `grpcurl` (gRPC)
- [ ] Đóng gói server gRPC bằng Docker với health check dạng exec
- [ ] Chạy được cả 4 ứng dụng thực tế
- [ ] Hoàn thành ít nhất 4 bài tập

## 🎓 Tổng kết & Lộ trình học tiếp

🎉 **Chúc mừng!** Đây là bài cuối cùng của khóa học. Từ `Hello, World` ở Bài 1, giờ bạn đã có thể xây dựng các **microservice** giao tiếp với nhau bằng gRPC: hợp đồng chặt chẽ, streaming, deadline xuyên service, xác thực, test đầy đủ và đóng gói bằng Docker.

**Những gì bạn mang theo từ bài này**:

| Ý tưởng | Ở REST (Bài 12, 16) | Ở gRPC (Bài 18) |
|---------|--------------------|-----------------|
| Hợp đồng API | JSON "ngầm hiểu", OpenAPI tùy chọn | File `.proto` bắt buộc + sinh code |
| Timeout | `http.Client{Timeout}`, `context` | Deadline tự truyền qua các service |
| Middleware | `func(http.Handler) http.Handler` | Interceptor unary/stream |
| Lỗi | HTTP status + JSON lỗi tự định nghĩa | `status` + `codes` + `errdetails` chuẩn |
| Test | `httptest` | `bufconn` |
| Health | `/healthz`, `/readyz` | `grpc.health.v1.Health` |
| Graceful shutdown | `srv.Shutdown(ctx)` | `hs.Shutdown()` + `srv.GracefulStop()` |

### 🗺️ Lộ trình tiếp theo

| Chủ đề | Học gì | Bắt đầu từ |
|--------|--------|-----------|
| **ConnectRPC** | gRPC + gRPC-Web + JSON trên `net/http` chuẩn, gọi được từ trình duyệt | [connectrpc.com](https://connectrpc.com/docs/go/getting-started) |
| **Message queue & event** | Giao tiếp bất đồng bộ, Saga, outbox pattern - giải bài toán nhất quán ở ứng dụng 1 | NATS, Kafka (`github.com/segmentio/kafka-go`), RabbitMQ |
| **Observability** | Tracing phân tán xuyên các service gRPC, metrics, log tập trung | OpenTelemetry Go (`otelgrpc` - gắn vào gRPC bằng stats handler) |
| **Kubernetes** | Deploy nhiều service, gRPC probe, headless Service cho `round_robin`, HPA | `kind`/`minikube`, Helm |
| **Service mesh** | mTLS tự động, retry, circuit breaker, traffic splitting | Istio, Linkerd, Envoy |
| **Thiết kế API** | Chuẩn thiết kế API kiểu Google: phân trang, `FieldMask`, long-running operations | [google.aip.dev](https://google.aip.dev), [protobuf.dev](https://protobuf.dev) |
| **Bảo mật** | OAuth2/OIDC, JWT, mTLS với SPIFFE/SPIRE | `golang.org/x/oauth2`, OWASP API Security Top 10 |

### 📚 Tài liệu nên đọc

- 🌐 [grpc.io/docs/languages/go](https://grpc.io/docs/languages/go/) - tài liệu chính thức, có Quick start và Basics tutorial
- 🌐 [github.com/grpc/grpc-go/tree/master/examples](https://github.com/grpc/grpc-go/tree/master/examples) - ví dụ cho **mọi** tính năng: keepalive, retry, load balancing, auth, health...
- 🌐 [protobuf.dev](https://protobuf.dev) - Language Guide (proto3), Style Guide, "Proto Best Practices"
- 🌐 [buf.build/docs](https://buf.build/docs) - lint rules, breaking change rules
- 🌐 [grpc-ecosystem.github.io/grpc-gateway](https://grpc-ecosystem.github.io/grpc-gateway/)
- 📖 *gRPC: Up and Running* - Kasun Indrasiri & Danesh Kuruppu (O'Reilly)

### 💪 Cách tiến bộ nhanh nhất

1. **Chuyển một phần dự án thật sang gRPC**: ví dụ tách phần "gửi thông báo" của Bookmark API (Bài 16) thành một service gRPC riêng
2. **Đọc file `.proto` của các dự án lớn**: Kubernetes CRI, etcd, Envoy xDS, Google Cloud APIs - học cách người ta thiết kế API
3. **Đo đạc**: benchmark cùng một API bằng REST/JSON và gRPC (Bài 16 - `testing.B`), so sánh độ trễ và số byte
4. **Tự viết lại** các interceptor trong bài mà không nhìn code - rồi so sánh với `go-grpc-middleware`

**Quay về trang chính**: [README](./README.md)

---

💡 **Lời khuyên cuối cùng**:

- **Hợp đồng là trên hết** - thiết kế `.proto` cẩn thận, tiến hóa có kỷ luật với `reserved` và `buf breaking`
- **Mọi lời gọi đều có hạn chót** - deadline ở client, `ctx` truyền xuyên suốt ở server
- **Lỗi có mã** - `codes` đúng giúp client biết nên thử lại, sửa input hay báo người dùng
- **Stream cần kỷ luật** - một goroutine gửi, một goroutine nhận, luôn có đường kết thúc
- **Test trong bộ nhớ** - `bufconn` nhanh, sạch, không phụ thuộc cổng mạng
- **Đơn giản trước** - không phải mọi thứ đều cần gRPC; REST vẫn là lựa chọn tốt cho API công khai

**Chúc bạn trở thành một Gopher xuất sắc! 🐹🚀**
