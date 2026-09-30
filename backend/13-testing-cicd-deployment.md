# 📚 Bài 13: Testing, CI/CD & Deployment

## 🎯 Mục tiêu bài học

- Hiểu **test pyramid** và **testing trophy**, biết mỗi loại test (unit, integration, contract, e2e, load) trả lời câu hỏi gì
- Phân biệt rạch ròi **test doubles**: dummy, **stub**, **fake**, **spy**, **mock** — và viết được chúng bằng Go và Python
- Viết **integration test với database thật** (demo chạy được bằng SQLite, giới thiệu **Testcontainers** cho PostgreSQL)
- Biết **contract testing** là gì và vì sao nó quan trọng khi có nhiều service
- Viết **load test bằng k6** và đọc được kết quả (p95, error rate)
- Dựng **pipeline CI trên GitHub Actions** cho Go và Python: lint → test → build → scan → đóng gói image
- Nắm 4 **chiến lược deploy**: recreate, rolling, blue-green, canary — và khi nào dùng cái nào
- Tách **deploy** khỏi **release** bằng **feature flag** (tự viết một flag evaluator nhỏ)
- Chạy **migration database** an toàn trong CD theo mô hình **expand/contract**, biết cách **rollback**
- Hiểu **môi trường** (dev/staging/prod), **12-factor app**
- Đọc/viết được YAML **Kubernetes** cơ bản (Deployment, Service, Ingress, ConfigMap, Secret, probes, HPA), một đoạn **Terraform**
- Có **bản đồ dịch vụ cloud** (AWS/GCP) và **ý thức về chi phí**

> 💡 **Bài này nằm ở đâu trong khóa?** Các bài trước dạy bạn **xây** backend. Bài này dạy cách **đưa nó ra thế giới** mà không làm sập: kiểm chứng code đúng (testing), tự động hóa việc kiểm chứng và đóng gói (CI), đưa lên production một cách an toàn (CD & deployment). Phần Docker đã có ở [Go - Bài 17: Docker](../golang/17-docker.md); phần graceful shutdown, config, health check ở [Go - Bài 16](../golang/16-production-ready.md) và [Python - Bài 16](../python/16-production-ready.md) — bài này **không lặp lại** mà xây tiếp trên đó.

## 📖 1. Vì sao phải test và tự động hóa?

### 1.1. Chi phí của một con bug

Một con bug được phát hiện càng muộn thì càng đắt:

| Phát hiện ở đâu | Ai phát hiện | Chi phí sửa (tương đối) |
|---|---|---|
| Khi đang gõ code (IDE, compiler, linter) | Bạn | 1 |
| Unit test chạy trên máy | Bạn | 2 |
| CI trên pull request | Bạn + reviewer | 5 |
| Staging / QA | Tester | 20 |
| Production | **Khách hàng** | 100+ (mất tiền, mất uy tín, thức đêm) |

> 💡 **Ví von**: test giống như **kiểm tra xe trước khi chạy Tết về quê**. Mất 30 phút kiểm tra lốp, phanh, dầu ở nhà rẻ hơn rất nhiều so với việc xe hỏng giữa đèo Hải Vân lúc 2 giờ sáng. CI giống như **trạm đăng kiểm tự động**: xe nào (commit nào) cũng phải qua, không ai được "đi cửa sau".

### 1.2. Vòng đời từ commit đến production

```mermaid
flowchart LR
    DEV["Dev viết code<br/>+ test"] --> PR["Pull request"]
    PR --> CI["CI: lint, test,<br/>build, scan"]
    CI -->|"xanh + review"| MERGE["Merge vào main"]
    MERGE --> IMG["Build image<br/>gắn tag commit SHA"]
    IMG --> STG["Deploy staging<br/>+ smoke test"]
    STG --> PROD["Deploy production<br/>canary / rolling"]
    PROD --> MON["Monitor<br/>metrics, logs, alerts"]
    MON -->|"lỗi"| RB["Rollback /<br/>tắt feature flag"]
```

- **CI (Continuous Integration)**: mỗi thay đổi được **tích hợp** vào nhánh chính thường xuyên (mỗi ngày nhiều lần), và **tự động kiểm chứng** (build + test). Mục tiêu: nhánh `main` luôn ở trạng thái "xanh".
- **Continuous Delivery**: mọi commit trên `main` đều **có thể** deploy lên production bằng một nút bấm.
- **Continuous Deployment**: mọi commit qua được pipeline **tự động** lên production, không cần bấm.

!!! note "DORA metrics — đo độ khỏe của quy trình giao phần mềm"
    Nghiên cứu DORA (Google) dùng 4 chỉ số: **deployment frequency** (deploy bao lâu một lần), **lead time for changes** (từ commit đến production mất bao lâu), **change failure rate** (bao nhiêu % deploy gây sự cố), **time to restore** (mất bao lâu để khôi phục). Team giỏi deploy **nhiều lần mỗi ngày** với tỉ lệ lỗi **thấp** — tốc độ và độ ổn định **không** đối nghịch nhau, vì deploy nhỏ và thường xuyên thì dễ kiểm soát hơn deploy to và hiếm.

## 📖 2. Test pyramid và testing trophy

### 2.1. Các loại test

| Loại | Kiểm tra gì | Tốc độ | Độ tin cậy mang lại | Ví dụ |
|---|---|---|---|---|
| **Static** | Lỗi cú pháp, kiểu, style | Tức thì | Thấp–vừa | `go vet`, `staticcheck`, `ruff`, `mypy` |
| **Unit** | Một hàm / một class, cô lập khỏi I/O | ms | Vừa | Tính phí ship, validate đơn hàng |
| **Integration** | Code + một hệ thống thật (DB, Redis, HTTP) | 10ms–giây | Cao | Repository với PostgreSQL thật |
| **Contract** | Hai service có "nói cùng ngôn ngữ" không | ms–giây | Cao với hệ nhiều service | Consumer mong đợi field `total` là số |
| **End-to-end (E2E)** | Cả hệ thống như người dùng thật | Giây–phút | Rất cao nhưng **dễ flaky** | Đăng ký → đặt hàng → thanh toán |
| **Load / performance** | Chịu tải bao nhiêu, độ trễ ra sao | Phút–giờ | Về hiệu năng | 500 req/s trong 10 phút, p95 < 300ms |

### 2.2. Test pyramid (Mike Cohn)

```mermaid
flowchart TB
    E2E["E2E<br/>ít, chậm, đắt"]
    INT["Integration<br/>vừa phải"]
    UNIT["Unit<br/>rất nhiều, nhanh, rẻ"]
    E2E --- INT --- UNIT
    style E2E fill:#f8d7da,stroke:#842029
    style INT fill:#fff3cd,stroke:#997404
    style UNIT fill:#d1e7dd,stroke:#0f5132
```

Ý tưởng: **đáy rộng** gồm rất nhiều unit test nhanh; lên cao số lượng giảm dần vì test càng lớn càng chậm, càng dễ vỡ, càng khó tìm nguyên nhân khi đỏ.

### 2.3. Testing trophy (Kent C. Dodds)

```mermaid
flowchart TB
    T1["E2E - vài luồng quan trọng"]
    T2["INTEGRATION - phần lớn nhất"]
    T3["Unit - logic thuần phức tạp"]
    T4["Static - linter, type checker"]
    T1 --- T2 --- T3 --- T4
    style T2 fill:#d1e7dd,stroke:#0f5132
```

Testing trophy nhấn mạnh **integration test** vì: *"Viết test. Không quá nhiều. Chủ yếu là integration."* Với backend, phần lớn bug nằm ở **chỗ nối** (câu SQL sai, mapping JSON sai, transaction thiếu) — thứ mà unit test với mock không bắt được.

!!! tip "Nên theo cái nào?"
    Với backend hiện đại, một chiến lược thực dụng:

    - **Unit test** cho logic nghiệp vụ thuần (tính giá, khuyến mãi, state machine đơn hàng) — nhiều, nhanh.
    - **Integration test** cho mỗi repository/adapter với **DB thật**, và cho mỗi HTTP handler (qua `httptest` / `TestClient`) — đây là "xương sống".
    - **Contract test** khi có nhiều service/team.
    - **E2E** chỉ cho 3–10 luồng **kiếm ra tiền** (đăng ký, đặt hàng, thanh toán).

    Đừng cãi nhau về hình dạng — hãy hỏi: *"Nếu test này xanh, tôi tự tin deploy đến mức nào? Và nó tốn bao lâu?"*

### 2.4. Đặc điểm của một test tốt (F.I.R.S.T)

| Chữ | Nghĩa | Vi phạm thường gặp |
|---|---|---|
| **F**ast | Chạy nhanh để chạy thường xuyên | Test gọi API thật qua Internet, `sleep(5)` |
| **I**ndependent | Không phụ thuộc thứ tự / test khác | Test B dùng dữ liệu test A tạo ra |
| **R**epeatable | Chạy ở đâu cũng ra cùng kết quả | Phụ thuộc giờ hệ thống, múi giờ, random không seed |
| **S**elf-validating | Tự báo pass/fail, không cần người đọc log | Test chỉ `print` kết quả |
| **T**imely | Viết cùng lúc với code (hoặc trước — TDD) | "Để sau viết test" → không bao giờ viết |

Cấu trúc một test nên theo **Arrange – Act – Assert** (Chuẩn bị – Hành động – Kiểm tra), như các ví dụ bên dưới.

## 📖 3. Unit test và Test doubles

### 3.1. Test double là gì?

Khi test `OrderService`, ta **không muốn** trừ tiền thẻ thật hay gửi SMS thật. Ta thay các phụ thuộc bằng **test double** — "diễn viên đóng thế" (stunt double) trong phim.

| Loại | Làm gì | Ví von | Khi nào dùng |
|---|---|---|---|
| **Dummy** | Chỉ để lấp chỗ tham số, không bao giờ được dùng | Ghế trống giữ chỗ | Tham số bắt buộc nhưng không liên quan |
| **Stub** | Trả về câu trả lời **đóng hộp** | Tổng đài tự động: bấm 1 luôn nghe cùng một câu | Điều khiển **đầu vào gián tiếp** (payment trả lỗi) |
| **Fake** | Cài đặt **thật nhưng đơn giản** | Sân tập lái thay cho đường phố | DB trong RAM, queue trong RAM |
| **Spy** | Ghi lại **đã bị gọi thế nào** để kiểm tra sau | Camera hành trình | Kiểm tra **đầu ra gián tiếp** (đã gửi email chưa) |
| **Mock** | Được lập trình sẵn **kỳ vọng**, gọi sai là fail | Giám khảo cầm sẵn đáp án | Khi **cách gọi** chính là hành vi cần test |

```mermaid
classDiagram
    class OrderService {
        +Place(id, userID, amount)
    }
    class PaymentGateway {
        <<interface>>
        +Charge(userID, amount)
    }
    class OrderRepo {
        <<interface>>
        +Save(order)
        +Get(id)
    }
    class Notifier {
        <<interface>>
        +Notify(userID, msg)
    }
    OrderService --> PaymentGateway
    OrderService --> OrderRepo
    OrderService --> Notifier
    PaymentGateway <|.. StubPayment : test
    PaymentGateway <|.. MockPayment : test
    OrderRepo <|.. FakeRepo : test
    Notifier <|.. SpySMS : test
    PaymentGateway <|.. VNPayClient : production
    OrderRepo <|.. PostgresRepo : production
```

Điều kiện để thay được: service phụ thuộc vào **interface/protocol**, không phụ thuộc trực tiếp vào class cụ thể (**Dependency Inversion** — sẽ gặp lại ở [Bài 14](./14-architecture-microservices.md) dưới tên *ports & adapters*).

### 3.2. Code cần test

Một service đặt hàng: validate số tiền → trừ tiền → lưu đơn → gửi thông báo. Nếu thanh toán lỗi thì lưu đơn với trạng thái `PAYMENT_FAILED` và **không** gửi thông báo.

=== "Go"

    ```go
    // order.go — module shop/order
    package order

    import (
    	"errors"
    	"fmt"
    )

    type Order struct {
    	ID     string
    	UserID string
    	Amount int64 // VND
    	Status string
    }

    // Các "cổng" ra bên ngoài — định nghĩa bằng interface để test thay được.
    type PaymentGateway interface {
    	Charge(userID string, amount int64) (txID string, err error)
    }

    type OrderRepo interface {
    	Save(o Order) error
    	Get(id string) (Order, bool)
    }

    type Notifier interface {
    	Notify(userID, msg string) error
    }

    var ErrInvalidAmount = errors.New("số tiền không hợp lệ")

    type Service struct {
    	pay    PaymentGateway
    	repo   OrderRepo
    	notify Notifier
    }

    func NewService(p PaymentGateway, r OrderRepo, n Notifier) *Service {
    	return &Service{pay: p, repo: r, notify: n}
    }

    func (s *Service) Place(id, userID string, amount int64) (Order, error) {
    	if amount <= 0 || amount > 50_000_000 {
    		return Order{}, ErrInvalidAmount
    	}
    	o := Order{ID: id, UserID: userID, Amount: amount, Status: "PENDING"}
    	if _, err := s.pay.Charge(userID, amount); err != nil {
    		o.Status = "PAYMENT_FAILED"
    		_ = s.repo.Save(o)
    		return o, fmt.Errorf("thanh toán: %w", err)
    	}
    	o.Status = "PAID"
    	if err := s.repo.Save(o); err != nil {
    		return Order{}, err
    	}
    	_ = s.notify.Notify(userID, fmt.Sprintf("Đơn %s đã thanh toán %d đ", id, amount))
    	return o, nil
    }
    ```

=== "Python"

    ```python
    # order.py
    from dataclasses import dataclass
    from typing import Protocol


    @dataclass
    class Order:
        id: str
        user_id: str
        amount: int  # VND
        status: str = "PENDING"


    class PaymentGateway(Protocol):
        def charge(self, user_id: str, amount: int) -> str: ...


    class OrderRepo(Protocol):
        def save(self, order: Order) -> None: ...
        def get(self, order_id: str) -> Order | None: ...


    class Notifier(Protocol):
        def notify(self, user_id: str, msg: str) -> None: ...


    class InvalidAmount(ValueError):
        pass


    class PaymentError(Exception):
        pass


    class OrderService:
        def __init__(self, pay: PaymentGateway, repo: OrderRepo, notifier: Notifier):
            self.pay, self.repo, self.notifier = pay, repo, notifier

        def place(self, order_id: str, user_id: str, amount: int) -> Order:
            if amount <= 0 or amount > 50_000_000:
                raise InvalidAmount(amount)
            order = Order(order_id, user_id, amount)
            try:
                self.pay.charge(user_id, amount)
            except PaymentError:
                order.status = "PAYMENT_FAILED"
                self.repo.save(order)
                raise
            order.status = "PAID"
            self.repo.save(order)
            self.notifier.notify(user_id, f"Đơn {order_id} đã thanh toán {amount} đ")
            return order
    ```

### 3.3. Test với stub, fake, spy, mock

=== "Go"

    ```go
    // order_test.go
    package order

    import (
    	"errors"
    	"testing"
    )

    // STUB: trả về câu trả lời "đóng hộp", không quan tâm được gọi thế nào.
    type stubPayment struct{ err error }

    func (s stubPayment) Charge(string, int64) (string, error) { return "tx-1", s.err }

    // FAKE: bản cài đặt thật nhưng đơn giản (map trong RAM thay cho DB).
    type fakeRepo struct{ data map[string]Order }

    func newFakeRepo() *fakeRepo { return &fakeRepo{data: map[string]Order{}} }
    func (f *fakeRepo) Save(o Order) error { f.data[o.ID] = o; return nil }
    func (f *fakeRepo) Get(id string) (Order, bool) {
    	o, ok := f.data[id]
    	return o, ok
    }

    // SPY: ghi lại mọi lần được gọi để kiểm tra SAU khi chạy.
    type spyNotifier struct{ msgs []string }

    func (s *spyNotifier) Notify(_ string, msg string) error {
    	s.msgs = append(s.msgs, msg)
    	return nil
    }

    // MOCK: biết TRƯỚC mình phải được gọi thế nào, sai là báo lỗi.
    type mockPayment struct {
    	t          *testing.T
    	wantUser   string
    	wantAmount int64
    	calls      int
    }

    func (m *mockPayment) Charge(user string, amount int64) (string, error) {
    	m.calls++
    	if user != m.wantUser || amount != m.wantAmount {
    		m.t.Errorf("Charge(%q, %d), muốn (%q, %d)", user, amount, m.wantUser, m.wantAmount)
    	}
    	return "tx-mock", nil
    }
    func (m *mockPayment) verify() {
    	if m.calls != 1 {
    		m.t.Errorf("Charge được gọi %d lần, muốn đúng 1 lần", m.calls)
    	}
    }

    func TestPlace_Success(t *testing.T) {
    	repo, spy := newFakeRepo(), &spyNotifier{}
    	svc := NewService(stubPayment{}, repo, spy)

    	_, err := svc.Place("o1", "u1", 150_000)

    	if err != nil {
    		t.Fatalf("lỗi không mong đợi: %v", err)
    	}
    	if got, _ := repo.Get("o1"); got.Status != "PAID" {
    		t.Errorf("status = %q, muốn PAID", got.Status)
    	}
    	if len(spy.msgs) != 1 || spy.msgs[0] != "Đơn o1 đã thanh toán 150000 đ" {
    		t.Errorf("thông báo = %v", spy.msgs)
    	}
    }

    func TestPlace_PaymentFails(t *testing.T) {
    	repo, spy := newFakeRepo(), &spyNotifier{}
    	svc := NewService(stubPayment{err: errors.New("thẻ bị từ chối")}, repo, spy)

    	_, err := svc.Place("o2", "u1", 99_000)

    	if err == nil {
    		t.Fatal("muốn có lỗi")
    	}
    	if got, _ := repo.Get("o2"); got.Status != "PAYMENT_FAILED" {
    		t.Errorf("status = %q, muốn PAYMENT_FAILED", got.Status)
    	}
    	if len(spy.msgs) != 0 {
    		t.Errorf("không được gửi thông báo khi thanh toán lỗi, nhận %v", spy.msgs)
    	}
    }

    func TestPlace_ChargesExactAmount(t *testing.T) {
    	mock := &mockPayment{t: t, wantUser: "u9", wantAmount: 250_000}
    	svc := NewService(mock, newFakeRepo(), &spyNotifier{})

    	if _, err := svc.Place("o3", "u9", 250_000); err != nil {
    		t.Fatal(err)
    	}
    	mock.verify()
    }

    func TestPlace_InvalidAmount(t *testing.T) {
    	cases := []struct {
    		name   string
    		amount int64
    	}{
    		{"số âm", -1},
    		{"bằng 0", 0},
    		{"vượt hạn mức", 50_000_001},
    	}
    	for _, tc := range cases {
    		t.Run(tc.name, func(t *testing.T) {
    			svc := NewService(stubPayment{}, newFakeRepo(), &spyNotifier{})
    			_, err := svc.Place("x", "u1", tc.amount)
    			if !errors.Is(err, ErrInvalidAmount) {
    				t.Errorf("err = %v, muốn ErrInvalidAmount", err)
    			}
    		})
    	}
    }
    ```

    Chạy:

    ```bash
    go test -v ./...
    ```

    ```text
    // Output:
    === RUN   TestPlace_Success
    --- PASS: TestPlace_Success (0.00s)
    === RUN   TestPlace_PaymentFails
    --- PASS: TestPlace_PaymentFails (0.00s)
    === RUN   TestPlace_ChargesExactAmount
    --- PASS: TestPlace_ChargesExactAmount (0.00s)
    === RUN   TestPlace_InvalidAmount
    === RUN   TestPlace_InvalidAmount/số_âm
    === RUN   TestPlace_InvalidAmount/bằng_0
    === RUN   TestPlace_InvalidAmount/vượt_hạn_mức
    --- PASS: TestPlace_InvalidAmount (0.00s)
        --- PASS: TestPlace_InvalidAmount/số_âm (0.00s)
        --- PASS: TestPlace_InvalidAmount/bằng_0 (0.00s)
        --- PASS: TestPlace_InvalidAmount/vượt_hạn_mức (0.00s)
    PASS
    ok  	shop/order	0.007s
    ```

=== "Python"

    ```python
    # test_order.py
    import unittest
    from unittest.mock import Mock

    from order import InvalidAmount, Order, OrderService, PaymentError


    class StubPayment:  # STUB: câu trả lời đóng hộp
        def __init__(self, error: Exception | None = None):
            self.error = error

        def charge(self, user_id, amount):
            if self.error:
                raise self.error
            return "tx-1"


    class FakeRepo:  # FAKE: cài đặt thật nhưng đơn giản (dict thay DB)
        def __init__(self):
            self.data: dict[str, Order] = {}

        def save(self, order):
            self.data[order.id] = order

        def get(self, order_id):
            return self.data.get(order_id)


    class SpyNotifier:  # SPY: ghi lại các lần gọi
        def __init__(self):
            self.msgs: list[str] = []

        def notify(self, user_id, msg):
            self.msgs.append(msg)


    class PlaceOrderTest(unittest.TestCase):
        def test_success(self):
            repo, spy = FakeRepo(), SpyNotifier()
            svc = OrderService(StubPayment(), repo, spy)

            svc.place("o1", "u1", 150_000)

            self.assertEqual(repo.get("o1").status, "PAID")
            self.assertEqual(spy.msgs, ["Đơn o1 đã thanh toán 150000 đ"])

        def test_payment_fails(self):
            repo, spy = FakeRepo(), SpyNotifier()
            svc = OrderService(StubPayment(PaymentError("thẻ bị từ chối")), repo, spy)

            with self.assertRaises(PaymentError):
                svc.place("o2", "u1", 99_000)

            self.assertEqual(repo.get("o2").status, "PAYMENT_FAILED")
            self.assertEqual(spy.msgs, [])

        def test_charges_exact_amount(self):
            # MOCK: unittest.mock tạo đối tượng ghi nhận lời gọi + kiểm tra kỳ vọng
            pay = Mock()
            pay.charge.return_value = "tx-mock"
            svc = OrderService(pay, FakeRepo(), SpyNotifier())

            svc.place("o3", "u9", 250_000)

            pay.charge.assert_called_once_with("u9", 250_000)

        def test_invalid_amount(self):
            svc = OrderService(StubPayment(), FakeRepo(), SpyNotifier())
            for amount in (-1, 0, 50_000_001):
                with self.subTest(amount=amount):
                    with self.assertRaises(InvalidAmount):
                        svc.place("x", "u1", amount)


    if __name__ == "__main__":
        unittest.main()
    ```

    Chạy:

    ```bash
    python -m unittest -v test_order
    ```

    ```text
    # Output:
    test_charges_exact_amount (test_order.PlaceOrderTest.test_charges_exact_amount) ... ok
    test_invalid_amount (test_order.PlaceOrderTest.test_invalid_amount) ... ok
    test_payment_fails (test_order.PlaceOrderTest.test_payment_fails) ... ok
    test_success (test_order.PlaceOrderTest.test_success) ... ok

    ----------------------------------------------------------------------
    Ran 4 tests in 0.001s

    OK
    ```

**Phân tích**:

- `TestPlace_Success` dùng **stub** (thanh toán luôn OK), **fake** (repo là map) và **spy** (ghi lại tin nhắn). Ta kiểm tra **trạng thái** (đơn là `PAID`) và **đầu ra gián tiếp** (đúng 1 tin nhắn).
- `TestPlace_PaymentFails` dùng stub trả lỗi để đi vào nhánh lỗi — nhánh mà trong đời thật rất khó tái hiện (phải có thẻ bị từ chối!).
- `TestPlace_ChargesExactAmount` dùng **mock**: điều quan trọng là **gọi Charge đúng 1 lần với đúng số tiền** — trừ tiền 2 lần là thảm họa.
- `TestPlace_InvalidAmount` là **table-driven test** (Go) / `subTest` (Python): thêm case mới chỉ cần thêm 1 dòng.

!!! tip "pytest"
    Trong dự án Python thật, **pytest** phổ biến hơn `unittest` (xem [Python - Bài 16](../python/16-production-ready.md)). Cùng test trên viết kiểu pytest gọn hơn: hàm `def test_success():` với `assert repo.get("o1").status == "PAID"`, dùng `@pytest.mark.parametrize("amount", [-1, 0, 50_000_001])` thay cho `subTest`, và **fixture** thay cho `setUp`. Ví dụ ở đây dùng `unittest` để chạy được mà không cần cài gì.

!!! warning "Đừng mock quá tay"
    - Test mà **toàn mock** thường chỉ kiểm tra "code gọi đúng thứ tự các hàm tôi vừa viết" — đổi cách cài đặt (refactor) là test vỡ dù hành vi không đổi. Ưu tiên **fake** và kiểm tra **trạng thái/kết quả** hơn là kiểm tra **lời gọi**.
    - **Đừng mock thứ bạn không sở hữu** (thư viện HTTP, driver DB): hãy bọc nó trong một interface **của bạn** (`PaymentGateway`), mock interface đó, và dùng **integration test** cho lớp bọc.
    - Nếu một class cần 7 mock để test → đó là **tín hiệu thiết kế**: class làm quá nhiều việc.

### 3.4. Test HTTP handler

Handler cũng nên test mà không cần mở port thật: Go có `net/http/httptest`, FastAPI có `TestClient`, Flask có `app.test_client()`. Cách làm đã có ở [Go - Bài 16](../golang/16-production-ready.md) và [Python - Bài 16](../python/16-production-ready.md). Các điều nên kiểm tra ở tầng handler:

- Status code đúng cho từng trường hợp (201, 400, 401, 404, 409, 422)
- Format lỗi thống nhất (xem [Bài 3: Thiết kế API](./03-api-design.md))
- Header quan trọng (`Content-Type`, `Location`, `Cache-Control`)
- Phân quyền: user A không đọc được tài nguyên của user B (xem [Bài 12](./12-security.md))

## 📖 4. Integration test với database thật

### 4.1. Vì sao không mock database?

Mock DB **không** bắt được: câu SQL sai cú pháp, sai tên cột, thiếu index unique, lỗi transaction, khác biệt kiểu dữ liệu (`NULL`, timezone, collation), migration hỏng. Đây lại chính là những lỗi hay gặp nhất ở backend.

```mermaid
flowchart LR
    subgraph UNIT["Unit test"]
        S1["OrderService"] --> F1["FakeRepo<br/>map trong RAM"]
    end
    subgraph INTEG["Integration test"]
        R2["PostgresRepo<br/>code SQL thật"] --> D2[("DB thật<br/>trong container")]
    end
```

Nguyên tắc: **service** test bằng fake repo (nhanh), **repo** test bằng DB thật (chính xác). Hai loại bổ sung cho nhau.

### 4.2. Demo chạy được với SQLite

Để chạy được ngay trên máy không cần Docker, ta dùng **SQLite** (Go: driver thuần Go `modernc.org/sqlite`; Python: `sqlite3` có sẵn). Điểm quan trọng là **cấu trúc**: mỗi test một DB riêng, tự tạo schema, tự dọn.

=== "Go"

    ```go
    // store.go — module shop/store (go get modernc.org/sqlite)
    package store

    import (
    	"database/sql"
    	"errors"
    	"strings"

    	_ "modernc.org/sqlite"
    )

    var ErrEmailTaken = errors.New("email đã được dùng")

    const schema = `
    CREATE TABLE IF NOT EXISTS users (
        id    INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        name  TEXT NOT NULL
    );`

    type UserRepo struct{ db *sql.DB }

    func Open(dsn string) (*UserRepo, error) {
    	db, err := sql.Open("sqlite", dsn)
    	if err != nil {
    		return nil, err
    	}
    	if _, err := db.Exec(schema); err != nil { // "migration" tối giản
    		return nil, err
    	}
    	return &UserRepo{db: db}, nil
    }

    func (r *UserRepo) Close() error { return r.db.Close() }

    func (r *UserRepo) Create(email, name string) (int64, error) {
    	res, err := r.db.Exec(`INSERT INTO users(email, name) VALUES (?, ?)`,
    		strings.ToLower(email), name)
    	if err != nil {
    		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
    			return 0, ErrEmailTaken
    		}
    		return 0, err
    	}
    	return res.LastInsertId()
    }

    func (r *UserRepo) FindByEmail(email string) (string, error) {
    	var name string
    	err := r.db.QueryRow(`SELECT name FROM users WHERE email = ?`,
    		strings.ToLower(email)).Scan(&name)
    	return name, err
    }
    ```

    ```go
    // store_test.go
    package store

    import (
    	"database/sql"
    	"errors"
    	"path/filepath"
    	"testing"
    )

    // Mỗi test một DB file riêng trong thư mục tạm → test độc lập, chạy song song được.
    func newTestRepo(t *testing.T) *UserRepo {
    	t.Helper()
    	dsn := filepath.Join(t.TempDir(), "test.db")
    	repo, err := Open(dsn)
    	if err != nil {
    		t.Fatalf("mở DB: %v", err)
    	}
    	t.Cleanup(func() { repo.Close() })
    	return repo
    }

    func TestCreateAndFind(t *testing.T) {
    	t.Parallel()
    	repo := newTestRepo(t)

    	if _, err := repo.Create("An@Example.com", "An"); err != nil {
    		t.Fatal(err)
    	}
    	name, err := repo.FindByEmail("an@example.com")
    	if err != nil || name != "An" {
    		t.Fatalf("FindByEmail = %q, %v", name, err)
    	}
    }

    func TestDuplicateEmail(t *testing.T) {
    	t.Parallel()
    	repo := newTestRepo(t)

    	repo.Create("binh@example.com", "Bình")
    	_, err := repo.Create("BINH@example.com", "Bình 2") // khác hoa/thường vẫn trùng

    	if !errors.Is(err, ErrEmailTaken) {
    		t.Fatalf("err = %v, muốn ErrEmailTaken", err)
    	}
    }

    func TestNotFound(t *testing.T) {
    	t.Parallel()
    	repo := newTestRepo(t)

    	_, err := repo.FindByEmail("ghost@example.com")
    	if !errors.Is(err, sql.ErrNoRows) {
    		t.Fatalf("err = %v, muốn sql.ErrNoRows", err)
    	}
    }
    ```

    ```text
    // Output (go test -v ./...), thứ tự dòng có thể khác vì chạy song song:
    === RUN   TestCreateAndFind
    === PAUSE TestCreateAndFind
    === RUN   TestDuplicateEmail
    === PAUSE TestDuplicateEmail
    === RUN   TestNotFound
    === PAUSE TestNotFound
    === CONT  TestCreateAndFind
    === CONT  TestNotFound
    === CONT  TestDuplicateEmail
    --- PASS: TestNotFound (0.01s)
    --- PASS: TestCreateAndFind (0.01s)
    --- PASS: TestDuplicateEmail (0.01s)
    PASS
    ok  	shop/store	0.015s
    ```

=== "Python"

    ```python
    # store.py
    import sqlite3

    SCHEMA = """
    CREATE TABLE IF NOT EXISTS users (
        id    INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        name  TEXT NOT NULL
    );
    """


    class EmailTaken(Exception):
        pass


    class UserRepo:
        def __init__(self, dsn: str):
            self.db = sqlite3.connect(dsn)
            self.db.executescript(SCHEMA)  # "migration" tối giản

        def close(self):
            self.db.close()

        def create(self, email: str, name: str) -> int:
            try:
                with self.db:  # tự commit / rollback
                    cur = self.db.execute(
                        "INSERT INTO users(email, name) VALUES (?, ?)", (email.lower(), name)
                    )
                return cur.lastrowid
            except sqlite3.IntegrityError as e:
                raise EmailTaken(email) from e

        def find_by_email(self, email: str) -> str | None:
            row = self.db.execute(
                "SELECT name FROM users WHERE email = ?", (email.lower(),)
            ).fetchone()
            return row[0] if row else None
    ```

    ```python
    # test_store.py
    import os
    import tempfile
    import unittest

    from store import EmailTaken, UserRepo


    class UserRepoIntegrationTest(unittest.TestCase):
        def setUp(self):
            # Mỗi test một file DB riêng → độc lập, không phụ thuộc thứ tự
            self.tmp = tempfile.TemporaryDirectory()
            self.repo = UserRepo(os.path.join(self.tmp.name, "test.db"))

        def tearDown(self):
            self.repo.close()
            self.tmp.cleanup()

        def test_create_and_find(self):
            self.repo.create("An@Example.com", "An")
            self.assertEqual(self.repo.find_by_email("an@example.com"), "An")

        def test_duplicate_email(self):
            self.repo.create("binh@example.com", "Bình")
            with self.assertRaises(EmailTaken):
                self.repo.create("BINH@example.com", "Bình 2")

        def test_not_found(self):
            self.assertIsNone(self.repo.find_by_email("ghost@example.com"))


    if __name__ == "__main__":
        unittest.main()
    ```

    ```text
    # Output (python -m unittest -v test_store):
    test_create_and_find (test_store.UserRepoIntegrationTest.test_create_and_find) ... ok
    test_duplicate_email (test_store.UserRepoIntegrationTest.test_duplicate_email) ... ok
    test_not_found (test_store.UserRepoIntegrationTest.test_not_found) ... ok

    ----------------------------------------------------------------------
    Ran 3 tests in 0.066s

    OK
    ```

Test `TestDuplicateEmail` bắt được một bug mà mock **không bao giờ** bắt được: nếu quên `UNIQUE` trong schema hoặc quên `lower()` email, test đỏ ngay.

### 4.3. Testcontainers — DB thật, giống production

SQLite tiện nhưng **không giống** PostgreSQL (kiểu dữ liệu, locking, `ON CONFLICT`, JSONB...). Test trên SQLite xanh không có nghĩa PostgreSQL cũng xanh. Giải pháp chuẩn hiện nay là **Testcontainers**: thư viện khởi động container Docker **từ trong code test**, đợi sẵn sàng, đưa bạn connection string, và tự xóa khi test xong.

```mermaid
sequenceDiagram
    participant T as Test
    participant TC as Testcontainers
    participant D as Docker
    participant PG as Postgres 16
    T->>TC: Run postgres module
    TC->>D: docker run postgres:16 (port ngẫu nhiên)
    D->>PG: khởi động
    TC->>PG: đợi "ready to accept connections"
    TC-->>T: connection string
    T->>PG: chạy migration + test
    T->>TC: Terminate (cleanup)
    TC->>D: xóa container
```

=== "Go"

    ```go
    // Cần Docker. go get github.com/testcontainers/testcontainers-go/modules/postgres
    func newPostgres(t *testing.T) string {
    	t.Helper()
    	ctx := context.Background()
    	pg, err := postgres.Run(ctx, "postgres:16-alpine",
    		postgres.WithDatabase("shop"),
    		postgres.WithUsername("test"),
    		postgres.WithPassword("test"),
    		postgres.BasicWaitStrategies(),
    	)
    	if err != nil {
    		t.Fatal(err)
    	}
    	t.Cleanup(func() { _ = pg.Terminate(ctx) })
    	dsn, err := pg.ConnectionString(ctx, "sslmode=disable")
    	if err != nil {
    		t.Fatal(err)
    	}
    	return dsn // đưa vào Open(dsn) + chạy migration
    }
    ```

=== "Python"

    ```python
    # Cần Docker. pip install "testcontainers[postgres]" pytest psycopg
    import pytest
    from testcontainers.postgres import PostgresContainer


    @pytest.fixture(scope="session")
    def pg_url():
        with PostgresContainer("postgres:16-alpine", driver="psycopg") as pg:
            yield pg.get_connection_url()  # chạy migration rồi đưa cho test
    ```

!!! tip "Làm integration test nhanh"
    - Khởi động container **một lần cho cả package/session**, không phải mỗi test.
    - Cô lập dữ liệu giữa các test bằng cách: mỗi test chạy trong **transaction rồi rollback**, hoặc `TRUNCATE` các bảng, hoặc mỗi test một **schema/database** riêng (`CREATE DATABASE test_123 TEMPLATE shop_template` rất nhanh).
    - Chạy **đúng migration** dùng cho production để tạo schema — vừa test code, vừa test luôn migration.
    - Dùng **cùng phiên bản** PostgreSQL/Redis với production.

## 📖 5. Contract testing

### 5.1. Vấn đề

Service `order` gọi service `payment`. Team payment đổi field `amount` thành `amount_vnd`. Unit test của cả hai team đều xanh (mỗi bên mock bên kia theo **hiểu biết cũ**). Deploy → production vỡ.

E2E test bắt được, nhưng phải dựng cả hệ thống, chạy chậm và flaky. **Contract test** nằm giữa: kiểm tra **hợp đồng** (request/response) giữa hai bên một cách độc lập.

### 5.2. Consumer-driven contract (Pact)

```mermaid
sequenceDiagram
    participant C as Consumer order-service
    participant B as Pact Broker
    participant P as Provider payment-service
    C->>C: Test với mock provider,<br/>ghi lại kỳ vọng thành contract
    C->>B: Publish contract v1.4
    P->>B: Lấy các contract của mọi consumer
    P->>P: Replay request thật vào provider,<br/>so response với contract
    P->>B: Publish kết quả verify
    Note over C,P: CI hỏi broker "can-i-deploy?"<br/>trước khi deploy bất kỳ bên nào
```

Một contract (rút gọn) trông như thế này:

```json
{
  "consumer": { "name": "order-service" },
  "provider": { "name": "payment-service" },
  "interactions": [{
    "description": "tạo giao dịch thanh toán",
    "request":  { "method": "POST", "path": "/v1/charges",
                  "body": { "order_id": "o1", "amount": 150000 } },
    "response": { "status": 201,
                  "body": { "charge_id": "ch_123", "status": "SUCCEEDED" } }
  }]
}
```

Consumer chỉ khai báo **những field nó thật sự dùng** → provider được tự do thêm field mới, nhưng xóa/đổi tên field mà consumer dùng thì CI của provider **đỏ** trước khi kịp deploy.

### 5.3. Các cách nhẹ hơn

| Cách | Phù hợp khi |
|---|---|
| **Schema-first**: OpenAPI spec trong repo, CI kiểm tra response khớp spec, dùng `oasdiff` phát hiện thay đổi phá vỡ | REST API, ít team |
| **Protobuf + `buf breaking`**: CI chặn thay đổi không tương thích (xóa field, đổi số thứ tự) — xem [Go - Bài 18: gRPC](../golang/18-grpc.md) | gRPC |
| **Schema Registry** (Avro/Protobuf) với chế độ compatibility `BACKWARD` | Event qua Kafka (xem [Bài 9](./09-message-queues.md)) |
| **Pact** | Nhiều team, nhiều consumer, REST hoặc message |

!!! tip "Quy tắc tiến hóa API không phá vỡ"
    Được: **thêm** field tùy chọn, **thêm** endpoint, **thêm** giá trị enum (nếu client xử lý giá trị lạ). Không được (phải lên version mới): **xóa/đổi tên** field, **đổi kiểu**, biến field tùy chọn thành **bắt buộc** trong request. Nguyên lý Postel: *"Nghiêm khắc với cái mình gửi đi, rộng lượng với cái mình nhận vào."*

## 📖 6. End-to-end test

E2E test chạy **như người dùng thật** trên một môi trường đầy đủ (staging hoặc môi trường tạm dựng bằng `docker compose`): gọi API public → kiểm tra kết quả cuối (đơn hàng có trong DB, email nằm trong hộp thư giả lập MailHog...).

Nên và không nên:

- ✅ Chỉ cho các **luồng kiếm tiền / sống còn**: đăng ký, đăng nhập, đặt hàng, thanh toán, hoàn tiền.
- ✅ Dùng làm **smoke test** sau mỗi lần deploy: 5–10 request kiểm tra hệ thống "còn thở".
- ❌ Không dùng E2E để test từng validation rule — việc đó của unit/integration test.
- ❌ Không `sleep(3)` chờ xử lý bất đồng bộ — hãy **poll với timeout** ("thử lại mỗi 200ms, tối đa 10 giây").

!!! warning "Flaky test — kẻ thù của CI"
    **Flaky test** là test lúc xanh lúc đỏ dù code không đổi. Nguyên nhân: phụ thuộc thời gian, thứ tự, mạng, dữ liệu dùng chung, race condition. Hậu quả nghiêm trọng hơn bạn nghĩ: team quen bấm "re-run" → đến khi test đỏ **thật** cũng không ai tin. Chính sách tốt: phát hiện flaky → **cách ly** (quarantine) ngay, tạo ticket, sửa trong tuần. Go có `go test -race -count=10` để lôi flaky ra ánh sáng.

## 📖 7. Load testing với k6

### 7.1. Các kiểu test hiệu năng

| Kiểu | Hình dạng tải | Trả lời câu hỏi |
|---|---|---|
| **Load test** | Tải bình thường–cao điểm, giữ ổn định | Ở tải mong đợi, p95 có đạt SLO không? |
| **Stress test** | Tăng dần đến khi gãy | Giới hạn ở đâu? Gãy thế nào (từ chối lịch sự hay sập)? |
| **Spike test** | Tăng vọt đột ngột | Flash sale 0h có chịu nổi? Autoscale kịp không? |
| **Soak test** | Tải vừa, kéo dài nhiều giờ | Có rò rỉ bộ nhớ, đầy connection pool, đầy đĩa không? |

```text
 VUs
 400 |                ██████
     |                ██████
 100 |    ██████████████████████
     |  ██████████████████████████
   0 +--------------------------------> phút
     0   1   2   3   4   5   6   7   8
       ramp   giữ     spike    ramp-down
```

### 7.2. Script k6

[k6](https://k6.io) viết kịch bản bằng JavaScript, chạy bằng một binary Go, nhẹ và dễ đưa vào CI.

```javascript
// load-test.js — chạy: k6 run load-test.js
import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE_URL || "http://localhost:8080";

export const options = {
  stages: [
    { duration: "1m", target: 100 }, // ramp-up lên 100 user ảo
    { duration: "3m", target: 100 }, // giữ
    { duration: "30s", target: 400 }, // spike
    { duration: "1m", target: 400 },
    { duration: "1m", target: 0 },   // ramp-down
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],                  // < 1% lỗi
    http_req_duration: ["p(95)<300", "p(99)<800"],   // SLO độ trễ (ms)
    "checks{flow:order}": ["rate>0.99"],
  },
};

export default function () {
  // 80% xem sản phẩm, 20% đặt hàng — mô phỏng hành vi thật
  if (Math.random() < 0.8) {
    const res = http.get(`${BASE}/products?page=1`, { tags: { flow: "browse" } });
    check(res, { "browse 200": (r) => r.status === 200 });
  } else {
    const payload = JSON.stringify({ product_id: "p1", quantity: 1 });
    const res = http.post(`${BASE}/orders`, payload, {
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `${__VU}-${__ITER}`,
      },
      tags: { flow: "order" },
    });
    check(res, { "order 201": (r) => r.status === 201 }, { flow: "order" });
  }
  sleep(1); // "think time" — người thật không bấm liên tục
}
```

```text
Output (ví dụ):
     ✓ browse 200
     ✗ order 201
      ↳  98% — ✓ 11760 / ✗ 240

   ✗ checks{flow:order}...........: 98.00%  11760 out of 12000   ← dưới ngưỡng 99%
   ✓ http_req_duration.............: avg=84ms  min=3ms  med=41ms  max=2.1s  p(95)=270ms p(99)=690ms
   ✓ http_req_failed...............: 0.41%  245 out of 59000
     http_reqs.....................: 59000  196.6/s
     vus_max.......................: 400

ERRO[0450] thresholds on metrics 'checks{flow:order}' have been crossed
```

Ở ví dụ trên, 2% request đặt hàng không trả 201 → threshold `rate>0.99` bị vi phạm → k6 thoát với **exit code khác 0** → bước CI chạy k6 sẽ **đỏ**. Việc tiếp theo là tìm xem 240 request đó trả về gì (409? 500? timeout?).

**Đọc kết quả thế nào?**

- Nhìn **p95/p99**, không nhìn `avg` (trung bình che giấu đuôi chậm — xem [Bài 11](./11-observability-reliability.md)).
- `thresholds` biến load test thành **pass/fail tự động** → đưa được vào pipeline (ví dụ chạy hàng đêm với staging).
- Khi p95 xấu đi, mở **dashboard và trace** cùng khoảng thời gian: CPU? DB connection pool? lock? GC? Load test mà không có observability chỉ cho bạn biết "chậm", không cho biết "vì sao".

!!! warning "Load test đúng cách"
    - **Không** load test production khi chưa báo trước (và chưa có sự đồng ý) — bạn có thể tự DDoS chính mình, hoặc làm bên thứ ba (cổng thanh toán, SMS) tính tiền.
    - Máy chạy k6 phải đủ mạnh; nếu máy **tạo tải** bị nghẽn CPU, số liệu sai.
    - Dữ liệu test phải **giống thật** về kích thước: bảng 100 dòng thì query nào cũng nhanh.
    - Thận trọng với cache: 1000 user cùng xem 1 sản phẩm → 100% cache hit → kết quả đẹp giả tạo.

## 📖 8. CI với GitHub Actions

### 8.1. Pipeline CI điển hình

```mermaid
flowchart LR
    A["Checkout"] --> B["Lint<br/>+ format check"]
    B --> C["Unit +<br/>integration test"]
    C --> D["Build binary /<br/>package"]
    D --> E["Scan lỗ hổng<br/>dependency + image"]
    E --> F{"Nhánh main?"}
    F -->|"Không - PR"| G["Báo kết quả<br/>lên PR"]
    F -->|"Có"| H["Build + push image<br/>tag = commit SHA"]
    H --> I["Trigger CD"]
```

Nguyên tắc:

- **Nhanh**: mục tiêu < 10 phút. Cache dependency, chạy song song các job, test chậm tách ra chạy riêng.
- **Fail sớm**: bước rẻ (lint) chạy trước bước đắt (build image).
- **Tái lập được**: pin phiên bản tool, dùng lockfile (`go.sum`, `uv.lock` / `requirements.txt` có hash).
- **Branch protection**: `main` chỉ nhận merge khi CI xanh + có review.
- **Build một lần, deploy nhiều nơi**: image build ở CI được **dùng lại nguyên xi** cho staging và production (xem mục 12).

### 8.2. Workflow cho Go

```yaml
# .github/workflows/ci-go.yml
name: ci-go

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:              # PR mới push commit → hủy lần chạy cũ
  group: ci-go-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version-file: go.mod
      - uses: golangci/golangci-lint-action@v8
        with:
          version: latest

  test:
    runs-on: ubuntu-latest
    services:             # PostgreSQL thật cho integration test
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: shop
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U test"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    env:
      DATABASE_URL: postgres://test:test@localhost:5432/shop?sslmode=disable
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version-file: go.mod   # tự cache module
      - run: go vet ./...
      - run: go test -race -coverprofile=cover.out ./...
      - run: go tool cover -func=cover.out | tail -1

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version-file: go.mod
      - run: go install golang.org/x/vuln/cmd/govulncheck@latest
      - run: govulncheck ./...

  image:
    needs: [lint, test, security]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write       # để push lên GitHub Container Registry
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
      - name: Scan image
        uses: aquasecurity/trivy-action@0.28.0
        with:
          image-ref: ghcr.io/${{ github.repository }}:${{ github.sha }}
          severity: CRITICAL,HIGH
          exit-code: "1"      # có lỗ hổng nghiêm trọng → pipeline đỏ
```

Dockerfile multi-stage cho Go đã có ở [Go - Bài 17](../golang/17-docker.md).

### 8.3. Workflow cho Python

```yaml
# .github/workflows/ci-python.yml
name: ci-python

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ["3.11", "3.12"]   # test trên nhiều phiên bản
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python-version }}
          cache: pip
      - run: pip install -r requirements.txt -r requirements-dev.txt
      - name: Lint + format
        run: |
          ruff check .
          ruff format --check .
      - name: Type check
        run: mypy src
      - name: Test
        run: pytest -q --cov=src --cov-report=term-missing
      - name: Dependency audit
        run: pip-audit -r requirements.txt

  image:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          push: true
          tags: ghcr.io/${{ github.repository }}-api:${{ github.sha }}
```

!!! tip "Bảo mật pipeline (nối tiếp Bài 12)"
    - `permissions:` tối thiểu cho `GITHUB_TOKEN` (mặc định chỉ `contents: read`, job nào cần push image mới cấp `packages: write`).
    - Pin action theo **commit SHA** (`actions/checkout@<sha>`) cho action bên thứ ba — tag có thể bị dời sang code độc.
    - Secret chỉ dùng trong job cần nó; **không** dùng `pull_request_target` + checkout code của PR từ fork (lỗ hổng kinh điển).
    - Deploy lên cloud bằng **OIDC** (GitHub đổi token tạm với AWS/GCP) thay vì lưu access key dài hạn trong secrets.
    - Bật **Dependabot/Renovate** để cập nhật dependency tự động. Xem thêm [Bài 12 - chuỗi cung ứng](./12-security.md).

### 8.4. Coverage — bao nhiêu là đủ?

Coverage đo **dòng code được chạy qua**, không đo **chất lượng assert**. Test `svc.Place(...)` không assert gì vẫn cho 100% coverage của hàm đó. Dùng coverage để **tìm vùng chưa test** (nhánh lỗi, edge case), không dùng làm KPI cứng. Mức 70–80% cho code nghiệp vụ là hợp lý; ép 100% thường sinh ra test vô nghĩa.

## 📖 9. Chiến lược deploy

Tình huống: v1 đang chạy trên 4 instance, cần lên v2. Có 4 cách chính.

### 9.1. Recreate — tắt hết rồi bật lại

```mermaid
flowchart LR
    T1["Bước 1<br/>v1 v1 v1 v1"] -->|"tắt hết"| T2["Bước 2 - DOWNTIME<br/>không còn instance nào"]
    T2 -->|"bật bản mới"| T3["Bước 3<br/>v2 v2 v2 v2"]
    style T2 fill:#f8d7da,stroke:#842029
```

Đơn giản, không bao giờ có 2 phiên bản chạy cùng lúc — nhưng **có downtime**. Dùng cho: môi trường dev, job nội bộ, hoặc khi v1 và v2 **không thể** cùng tồn tại (ví dụ đổi schema không tương thích — mà ta nên tránh).

### 9.2. Rolling update — thay dần từng instance

```mermaid
flowchart LR
    S0["v1 v1 v1 v1"] --> S1["v2 v1 v1 v1"] --> S2["v2 v2 v1 v1"] --> S3["v2 v2 v2 v1"] --> S4["v2 v2 v2 v2"]
```

Mặc định của Kubernetes Deployment. Không downtime, không tốn thêm nhiều tài nguyên. Nhược điểm: trong lúc rolling, **v1 và v2 cùng phục vụ** → API và schema DB phải **tương thích ngược**; rollback cũng phải rolling (vài phút).

### 9.3. Blue-green — hai môi trường, chuyển công tắc

```mermaid
flowchart TB
    U["Người dùng"] --> LB["Load balancer / router"]
    LB -->|"100% traffic"| BLUE["BLUE - v1<br/>đang chạy"]
    LB -.->|"0% - chờ"| GREEN["GREEN - v2<br/>đã deploy, đã smoke test"]
    BLUE --> DB[("Database dùng chung")]
    GREEN --> DB
```

Deploy v2 lên môi trường "green" song song, smoke test thoải mái, rồi **chuyển toàn bộ traffic** trong 1 giây. Rollback = chuyển công tắc về blue — **cực nhanh**. Nhược điểm: tốn **gấp đôi** tài nguyên trong lúc deploy; database vẫn dùng chung nên migration vẫn phải tương thích; chuyển 100% một lần nên nếu v2 có bug thì **mọi người** cùng dính (dù rollback nhanh).

### 9.4. Canary — thả "chim hoàng yến" đi trước

Tên gọi từ thợ mỏ than mang chim hoàng yến xuống hầm: chim ngất trước khi khí độc đủ hại người. Deploy v2 cho một **phần nhỏ** traffic, quan sát metrics, rồi tăng dần.

```mermaid
flowchart LR
    U["Traffic"] --> R{"Router"}
    R -->|"95%"| V1["v1 - stable"]
    R -->|"5%"| V2["v2 - canary"]
    V2 --> M["So sánh metrics<br/>error rate, p95, business KPI"]
    M -->|"tốt"| UP["Tăng 25% → 50% → 100%"]
    M -->|"xấu"| DOWN["Tự rollback về 0%"]
```

Đây là chiến lược của các công ty lớn. Kết hợp với **SLO và alert** ([Bài 11](./11-observability-reliability.md)), canary có thể **tự động hóa hoàn toàn** (Argo Rollouts, Flagger, Spinnaker): mỗi bước đợi 10 phút, so sánh error rate của canary với stable, xấu hơn ngưỡng → tự rút.

### 9.5. So sánh

| Chiến lược | Downtime | Chi phí hạ tầng | Tốc độ rollback | Rủi ro ảnh hưởng người dùng | Độ phức tạp |
|---|---|---|---|---|---|
| **Recreate** | Có | 1x | Chậm (deploy lại) | 100% + downtime | Rất thấp |
| **Rolling** | Không | ~1x (+1 surge) | Vừa (rolling ngược) | Tăng dần | Thấp |
| **Blue-green** | Không | 2x khi deploy | **Rất nhanh** | 100% (trong thời gian ngắn) | Vừa |
| **Canary** | Không | ~1x + canary | Nhanh | **Nhỏ nhất** (5% trước) | Cao |

!!! note "Shadow / dark launch"
    Biến thể khác: **nhân bản** traffic thật gửi sang v2 nhưng **bỏ qua** response của v2 (người dùng vẫn nhận response v1). Dùng để kiểm tra hiệu năng và so sánh kết quả của hệ thống mới viết lại. Cẩn thận: v2 không được gây **side effect** (trừ tiền, gửi email hai lần).

## 📖 10. Feature flags — tách deploy khỏi release

**Deploy** là đưa code lên server. **Release** là cho người dùng thấy tính năng. Feature flag cho phép deploy code mới ở trạng thái **tắt**, rồi bật dần cho nhân viên → 1% → 10% → 100% người dùng, và **tắt ngay trong 1 giây** khi có sự cố mà không cần deploy lại.

```mermaid
flowchart LR
    REQ["Request của user u123"] --> E{"Flag new_checkout"}
    E -->|"tắt tổng"| OLD["Checkout cũ"]
    E -->|"u123 trong allowlist"| NEW["Checkout mới"]
    E -->|"hash(flag:u123) % 100 < 30"| NEW
    E -->|"còn lại"| OLD
```

Điểm mấu chốt của rollout theo phần trăm: dùng **hash ổn định** của `(flag, user)` thay vì `random()` — cùng một user luôn thấy cùng một phiên bản (không "nhấp nháy" giữa hai giao diện mỗi lần F5), và tăng từ 30% lên 50% thì những người đã ở trong 30% **vẫn giữ nguyên**. Thêm tên flag vào chuỗi hash để mỗi flag chọn một nhóm user khác nhau (không phải lúc nào cũng "chuột bạch" là cùng một nhóm).

=== "Go"

    ```go
    package main

    import (
    	"fmt"
    	"hash/fnv"
    	"slices"
    )

    type Flag struct {
    	Key       string
    	Enabled   bool     // công tắc tổng (kill switch)
    	AllowList []string // luôn bật cho những user này (QA, nhân viên)
    	Percent   uint32   // 0..100: bật cho bao nhiêu % user còn lại
    }

    // bucket trả về số 0..99 CỐ ĐỊNH cho cặp (flag, user):
    // cùng user luôn rơi vào cùng bucket → trải nghiệm không "nhấp nháy".
    func bucket(flagKey, userID string) uint32 {
    	h := fnv.New32a()
    	h.Write([]byte(flagKey + ":" + userID))
    	return h.Sum32() % 100
    }

    func IsEnabled(f Flag, userID string) bool {
    	if !f.Enabled {
    		return false
    	}
    	if slices.Contains(f.AllowList, userID) {
    		return true
    	}
    	return bucket(f.Key, userID) < f.Percent
    }

    func main() {
    	flag := Flag{Key: "new_checkout", Enabled: true, AllowList: []string{"qa-1"}, Percent: 30}

    	users := []string{"qa-1", "u1", "u2", "u3", "u4", "u5", "u6", "u7", "u8"}
    	for _, u := range users {
    		fmt.Printf("%-5s bucket=%2d -> %v\n", u, bucket(flag.Key, u), IsEnabled(flag, u))
    	}

    	on := 0
    	for i := range 10000 {
    		if IsEnabled(flag, fmt.Sprintf("user-%d", i)) {
    			on++
    		}
    	}
    	fmt.Printf("10000 user, bật cho %d (~%.1f%%)\n", on, float64(on)/100)

    	flag.Enabled = false // sự cố! tắt ngay, không cần deploy
    	fmt.Println("sau kill switch, qa-1:", IsEnabled(flag, "qa-1"))
    }
    ```

=== "Python"

    ```python
    from dataclasses import dataclass, field


    @dataclass
    class Flag:
        key: str
        enabled: bool                                        # công tắc tổng (kill switch)
        allow_list: list[str] = field(default_factory=list)  # luôn bật cho QA, nhân viên
        percent: int = 0                                     # 0..100


    def fnv1a_32(data: bytes) -> int:
        h = 0x811C9DC5
        for b in data:
            h ^= b
            h = (h * 0x01000193) & 0xFFFFFFFF
        return h


    def bucket(flag_key: str, user_id: str) -> int:
        # Cùng (flag, user) luôn ra cùng số 0..99 → trải nghiệm ổn định
        return fnv1a_32(f"{flag_key}:{user_id}".encode()) % 100


    def is_enabled(flag: Flag, user_id: str) -> bool:
        if not flag.enabled:
            return False
        if user_id in flag.allow_list:
            return True
        return bucket(flag.key, user_id) < flag.percent


    if __name__ == "__main__":
        flag = Flag("new_checkout", enabled=True, allow_list=["qa-1"], percent=30)

        for u in ["qa-1", "u1", "u2", "u3", "u4", "u5", "u6", "u7", "u8"]:
            print(f"{u:<5} bucket={bucket(flag.key, u):2d} -> {str(is_enabled(flag, u)).lower()}")

        on = sum(is_enabled(flag, f"user-{i}") for i in range(10000))
        print(f"10000 user, bật cho {on} (~{on / 100:.1f}%)")

        flag.enabled = False  # sự cố! tắt ngay, không cần deploy
        print("sau kill switch, qa-1:", str(is_enabled(flag, "qa-1")).lower())
    ```

Cả hai phiên bản dùng cùng thuật toán FNV-1a 32-bit nên ra **cùng kết quả** — quan trọng khi service Go và service Python cần đồng ý "user này có ở trong rollout không":

```text
# Output (Go và Python giống hệt nhau):
qa-1  bucket=92 -> true
u1    bucket= 2 -> true
u2    bucket=83 -> false
u3    bucket=64 -> false
u4    bucket=97 -> false
u5    bucket=78 -> false
u6    bucket=59 -> false
u7    bucket=40 -> false
u8    bucket=69 -> false
10000 user, bật cho 2992 (~29.9%)
sau kill switch, qa-1: false
```

Chú ý: `qa-1` có bucket 92 (ngoài 30%) nhưng vẫn bật vì nằm trong **allowlist**; với 10.000 user, tỉ lệ thực tế 29.9% rất sát 30%.

### 10.1. Các loại flag

| Loại | Sống bao lâu | Ví dụ |
|---|---|---|
| **Release flag** | Ngày–tuần, xóa sau khi 100% | `new_checkout` |
| **Ops flag / kill switch** | Lâu dài | Tắt tính năng gợi ý sản phẩm khi DB quá tải (graceful degradation) |
| **Experiment flag** | Theo thời gian A/B test | Nút "Mua ngay" màu cam vs xanh |
| **Permission flag** | Lâu dài | Tính năng chỉ cho gói Premium |

!!! warning "Nợ flag (flag debt)"
    Mỗi flag là một câu `if` — 20 flag là 2^20 tổ hợp không ai test hết. Quy tắc: release flag phải có **ngày hết hạn** và **người chịu trách nhiệm**; khi đã 100% ổn định 1–2 tuần thì **xóa flag và nhánh code cũ**. Năm 2012, Knight Capital mất **440 triệu USD trong 45 phút** một phần vì tái sử dụng một flag cũ kích hoạt lại đoạn code chết trên một server chưa được deploy bản mới.

Trong thực tế, flag được lưu ở dịch vụ tập trung (LaunchDarkly, Unleash, Flagsmith, GrowthBook, hoặc tự làm với bảng DB + cache) và SDK trong service **cache cục bộ** rồi đồng bộ định kỳ — để hệ thống flag có sập thì service vẫn chạy với giá trị cuối cùng (hoặc giá trị mặc định an toàn).

## 📖 11. Migration database trong CD — expand/contract

### 11.1. Vấn đề

Trong rolling/canary/blue-green, **v1 và v2 chạy cùng lúc trên cùng một database**. Nếu migration của v2 đổi tên cột `name` → `full_name`, các instance v1 còn đang chạy sẽ lỗi ngay lập tức. Rollback code về v1 cũng vô ích vì cột `name` đã mất.

### 11.2. Expand / contract (parallel change)

Chia một thay đổi phá vỡ thành nhiều bước, **mỗi bước tương thích với phiên bản code ngay trước nó**:

```mermaid
flowchart TB
    E1["1. EXPAND - migration<br/>ADD COLUMN full_name NULL"] --> E2["2. Deploy code v2<br/>GHI cả name và full_name<br/>ĐỌC full_name, fallback name"]
    E2 --> E3["3. BACKFILL<br/>UPDATE theo lô 1000 dòng<br/>SET full_name = name"]
    E3 --> E4["4. Deploy code v3<br/>chỉ đọc/ghi full_name"]
    E4 --> E5["5. CONTRACT - migration<br/>DROP COLUMN name<br/>sau khi chắc chắn không còn v2"]
```

```sql
-- Bước 1: expand (nhanh, không khóa bảng lâu trên PostgreSQL 11+)
ALTER TABLE users ADD COLUMN full_name TEXT;

-- Bước 3: backfill theo lô để không khóa bảng lớn / không làm replica lag
UPDATE users SET full_name = name
WHERE id IN (
  SELECT id FROM users WHERE full_name IS NULL ORDER BY id LIMIT 1000
);
-- lặp lại đến khi 0 dòng được cập nhật

-- Bước 4.5: khi mọi dòng đã có dữ liệu
ALTER TABLE users ALTER COLUMN full_name SET NOT NULL;

-- Bước 5: contract (một release SAU, khi không còn code nào đọc cột cũ)
ALTER TABLE users DROP COLUMN name;
```

Ở **mọi thời điểm**, bạn có thể rollback code về phiên bản trước mà database vẫn tương thích.

### 11.3. Quy tắc chạy migration trong pipeline

- Migration là **file có version** trong repo (`golang-migrate`, `goose`, `atlas` cho Go; `Alembic` cho Python/SQLAlchemy, Django migrations). Không ai sửa schema production bằng tay.
- Chạy migration như **một bước riêng** trước khi deploy code (Kubernetes `Job` hoặc bước trong pipeline), **không** để mỗi instance tự chạy lúc khởi động (10 pod cùng chạy migration = tranh lock).
- Migration phải **tương thích ngược** với code đang chạy (expand trước, contract sau).
- Cẩn thận thao tác khóa bảng lâu: tạo index trên bảng lớn dùng `CREATE INDEX CONCURRENTLY` (PostgreSQL); thêm cột `NOT NULL` có default trên phiên bản cũ; đổi kiểu cột. Đặt `lock_timeout` để migration **thất bại nhanh** thay vì treo cả hệ thống. (Chi tiết về lock ở [Bài 6](./06-database-internals-performance.md).)
- Test migration trên bản sao dữ liệu có kích thước giống production trước.

## 📖 12. Rollback, môi trường và 12-factor

### 12.1. Rollback vs roll forward

| | Rollback (quay lui) | Roll forward (sửa tiến) |
|---|---|---|
| Làm gì | Deploy lại phiên bản trước đã biết là tốt | Sửa bug, deploy bản mới |
| Khi nào | Sự cố đang ảnh hưởng người dùng, chưa rõ nguyên nhân | Bug nhỏ, sửa nhanh, rollback nguy hiểm hơn |
| Tốc độ | Nhanh (vài giây–phút) nếu artifact còn sẵn | Phụ thuộc thời gian sửa + pipeline |

Nguyên tắc vàng khi có sự cố: **khôi phục dịch vụ trước, tìm nguyên nhân sau**. Thứ tự ưu tiên: tắt feature flag (giây) → rollback deploy (phút) → roll forward (chục phút+).

Những thứ **không** rollback được bằng cách deploy lại code cũ: migration đã xóa cột/dữ liệu, message đã gửi vào queue với format mới, email/SMS đã gửi, tiền đã trừ, cache đã ghi format mới. Vì vậy mọi thay đổi dữ liệu phải theo expand/contract, và consumer phải đọc được cả format cũ lẫn mới.

```bash
# Kubernetes: xem lịch sử và rollback
kubectl rollout history deployment/order-api
kubectl rollout undo deployment/order-api                 # về bản ngay trước
kubectl rollout undo deployment/order-api --to-revision=41
kubectl rollout status deployment/order-api
```

### 12.2. Môi trường

```mermaid
flowchart LR
    L["Local<br/>docker compose"] --> D["Dev / Preview<br/>mỗi PR một môi trường tạm"]
    D --> S["Staging<br/>giống prod nhất có thể"]
    S --> P["Production"]
    IMG[("Registry<br/>order-api:9f3c2a1")] -.->|"cùng một image"| S
    IMG -.->|"cùng một image"| P
```

- **Build once, deploy many**: cùng một image (tag = commit SHA, **không dùng** `latest`) được thăng cấp (promote) qua các môi trường; chỉ **config** khác nhau. Nếu build lại cho production, bạn đang deploy thứ **chưa từng được test**.
- **Staging** càng giống production càng tốt (cùng phiên bản DB, cùng cấu hình mạng), nhưng dữ liệu phải được **ẩn danh hóa** — không copy PII thật vào staging (xem [Bài 12](./12-security.md)).
- **Preview environment** cho mỗi PR (Vercel, Render, hoặc namespace Kubernetes tạm) giúp reviewer và PM thử trực tiếp.

### 12.3. The Twelve-Factor App

Bộ nguyên tắc (Heroku, 2011) cho ứng dụng chạy tốt trên cloud — vẫn là nền tảng của container và Kubernetes ngày nay:

| # | Factor | Nghĩa là | Ví dụ đúng |
|---|---|---|---|
| 1 | Codebase | Một repo, nhiều lần deploy | Cùng repo cho staging/prod |
| 2 | Dependencies | Khai báo tường minh, cô lập | `go.mod`, `requirements.txt` có pin version |
| 3 | **Config** | Config nằm trong **môi trường**, không trong code | `DATABASE_URL` từ env var |
| 4 | Backing services | DB, cache, queue là tài nguyên gắn vào qua URL | Đổi Redis chỉ cần đổi `REDIS_URL` |
| 5 | Build, release, run | Tách rõ 3 giai đoạn | Image bất biến + config = release |
| 6 | **Processes** | Process **stateless**, trạng thái ở backing service | Session trong Redis, file trên S3 |
| 7 | Port binding | App tự mở port phục vụ | `:8080`, không cần web server ngoài |
| 8 | Concurrency | Scale bằng thêm process | Thêm pod, không phải máy to hơn |
| 9 | **Disposability** | Khởi động nhanh, tắt êm (graceful shutdown) | Bắt SIGTERM, xử lý nốt request |
| 10 | Dev/prod parity | Môi trường giống nhau | Dev cũng dùng PostgreSQL, không SQLite |
| 11 | **Logs** | Log là luồng sự kiện ra stdout | Platform thu gom, không tự ghi file |
| 12 | Admin processes | Tác vụ quản trị chạy như process một lần | Migration là Job riêng |

Graceful shutdown (factor 9) và config từ env (factor 3) đã có code mẫu ở [Go - Bài 16](../golang/16-production-ready.md) / [Python - Bài 16](../python/16-production-ready.md).

## 📖 13. Kubernetes cơ bản

### 13.1. Kubernetes là gì và vì sao?

Docker chạy **một** container trên **một** máy. Khi có 30 service × 5 bản sao trên 20 máy, cần một "nhạc trưởng" (**orchestrator**) lo: đặt container lên máy nào, tự khởi động lại khi chết, cân bằng tải, rolling update, scale theo tải, quản lý config/secret. Đó là **Kubernetes (K8s)**.

Ý tưởng cốt lõi: bạn **khai báo trạng thái mong muốn** (*"tôi muốn 3 bản sao của order-api:9f3c2a1"*), K8s liên tục **so sánh** với trạng thái thực và **điều chỉnh** (reconcile loop) — giống máy lạnh: đặt 26°C, máy tự bật tắt để giữ nhiệt độ.

```mermaid
flowchart TB
    subgraph CP["Control plane"]
        API["API server"]
        ETCD[("etcd<br/>trạng thái cụm")]
        SCH["Scheduler"]
        CM["Controller manager"]
    end
    subgraph N1["Node 1"]
        K1["kubelet"]
        P1["Pod order-api"]
        P2["Pod payment-api"]
    end
    subgraph N2["Node 2"]
        K2["kubelet"]
        P3["Pod order-api"]
    end
    DEV["kubectl apply -f"] --> API
    API --- ETCD
    SCH --> API
    CM --> API
    K1 --> API
    K2 --> API
```

| Đối tượng | Vai trò | Ví von |
|---|---|---|
| **Pod** | Đơn vị nhỏ nhất: 1+ container chung mạng/volume | Một căn hộ |
| **Deployment** | Quản lý N bản sao Pod, rolling update, rollback | Ban quản lý giữ đủ N căn có người ở |
| **Service** | Địa chỉ ổn định + load balancing tới các Pod | Số hotline tổng đài chuyển tới nhân viên đang rảnh |
| **Ingress** | Cửa ngõ HTTP từ ngoài vào, route theo host/path | Lễ tân tòa nhà |
| **ConfigMap / Secret** | Config và bí mật tách khỏi image | Bảng thông báo / két sắt |
| **HPA** | Tự scale số Pod theo tải | Tự mở thêm quầy khi khách đông |
| **Namespace** | Phân vùng logic trong cụm | Các tầng trong tòa nhà |

### 13.2. Deployment với probes và resources

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-api
  labels: { app: order-api }
spec:
  replicas: 3
  revisionHistoryLimit: 10          # giữ 10 bản để rollback
  selector:
    matchLabels: { app: order-api }
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1                   # tạo thêm tối đa 1 pod mới mỗi lúc
      maxUnavailable: 0             # không bao giờ giảm dưới 3 pod sẵn sàng
  template:
    metadata:
      labels: { app: order-api }
    spec:
      terminationGracePeriodSeconds: 30   # thời gian graceful shutdown sau SIGTERM
      containers:
        - name: api
          image: ghcr.io/shop/order-api:9f3c2a1   # tag = commit SHA, không dùng latest
          ports:
            - containerPort: 8080
          envFrom:
            - configMapRef: { name: order-api-config }
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef: { name: order-api-secret, key: database-url }
          resources:
            requests: { cpu: 250m, memory: 256Mi }   # để scheduler xếp chỗ
            limits: { memory: 512Mi }                # vượt → bị OOMKilled
          startupProbe:                 # app khởi động chậm? đợi tối đa 30 x 2s
            httpGet: { path: /healthz, port: 8080 }
            failureThreshold: 30
            periodSeconds: 2
          readinessProbe:               # chưa sẵn sàng → rút khỏi Service
            httpGet: { path: /readyz, port: 8080 }
            periodSeconds: 5
            failureThreshold: 2
          livenessProbe:                # treo cứng → restart container
            httpGet: { path: /healthz, port: 8080 }
            periodSeconds: 10
            failureThreshold: 3
          securityContext:
            runAsNonRoot: true
            readOnlyRootFilesystem: true
            allowPrivilegeEscalation: false
```

**Ba loại probe — hay bị nhầm nhất:**

| Probe | Câu hỏi | Fail thì | Nên kiểm tra |
|---|---|---|---|
| **startup** | Đã khởi động xong chưa? | Chờ tiếp; quá ngưỡng thì restart | Như liveness |
| **readiness** | Có nhận traffic được không? | **Rút khỏi load balancer** (không restart) | DB/cache thiết yếu kết nối được, đã warm-up |
| **liveness** | Process còn "sống" không? | **Restart container** | Chỉ bản thân process (event loop không treo) — **không** kiểm tra DB |

!!! warning "Liveness probe kiểm tra database = tự sát tập thể"
    Nếu liveness gọi DB và DB chậm 30 giây, **mọi pod** fail liveness → K8s restart **tất cả** cùng lúc → khi DB hồi phục, hàng loạt pod đang khởi động lại → sự cố nhỏ thành sập toàn bộ. Liveness chỉ kiểm tra chính process; phụ thuộc bên ngoài để cho **readiness**.

**Tại sao `requests` và `limits`?** `requests` là phần được **đảm bảo** — scheduler dùng để chọn node. `limits.memory` là trần — vượt thì container bị giết (**OOMKilled**). Nhiều team **không đặt** CPU limit (tránh bị throttle gây tăng latency) nhưng **luôn** đặt memory limit. Với Go, đặt `GOMEMLIMIT` khoảng 80–90% memory limit để GC chủ động hơn.

### 13.3. Service, Ingress, ConfigMap, Secret

```yaml
# k8s/service.yaml — địa chỉ nội bộ ổn định: http://order-api.shop.svc:80
apiVersion: v1
kind: Service
metadata:
  name: order-api
spec:
  selector: { app: order-api }      # chọn các Pod có label này
  ports:
    - port: 80
      targetPort: 8080
---
# k8s/ingress.yaml — cửa ngõ từ Internet
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shop
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt   # tự cấp TLS
spec:
  ingressClassName: nginx
  tls:
    - hosts: [api.shop.vn]
      secretName: shop-tls
  rules:
    - host: api.shop.vn
      http:
        paths:
          - path: /orders
            pathType: Prefix
            backend:
              service: { name: order-api, port: { number: 80 } }
          - path: /payments
            pathType: Prefix
            backend:
              service: { name: payment-api, port: { number: 80 } }
---
# k8s/configmap.yaml — config không bí mật
apiVersion: v1
kind: ConfigMap
metadata:
  name: order-api-config
data:
  LOG_LEVEL: info
  PAYMENT_BASE_URL: http://payment-api
  FEATURE_FLAGS_URL: http://flags
---
# k8s/secret.yaml — CHỈ minh họa. Đừng commit secret thật vào git!
apiVersion: v1
kind: Secret
metadata:
  name: order-api-secret
type: Opaque
stringData:
  database-url: postgres://order:CHANGE_ME@pg:5432/orders
```

!!! warning "Secret của Kubernetes chỉ là base64"
    `Secret` mặc định chỉ **encode base64** (không phải mã hóa) và lưu trong etcd. Cần: bật **encryption at rest** cho etcd, phân quyền RBAC chặt, và lấy secret từ kho chuyên dụng (AWS Secrets Manager, GCP Secret Manager, Vault) qua **External Secrets Operator**, hoặc mã hóa trong git bằng **Sealed Secrets / SOPS**.

### 13.4. HPA — tự động scale

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: order-api
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: order-api
  minReplicas: 3          # tối thiểu 3 để chịu được 1 node chết
  maxReplicas: 20         # trần để chặn hóa đơn "bất ngờ"
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70   # % so với requests.cpu
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300   # đợi 5 phút mới giảm, tránh dao động
```

HPA cần `requests.cpu` để tính %. Với worker xử lý queue, scale theo **độ dài queue** hợp lý hơn CPU (dùng **KEDA**). Xem thêm autoscaling ở [Bài 10](./10-system-design.md).

### 13.5. Thao tác thường dùng

```bash
kubectl apply -f k8s/                         # áp dụng trạng thái mong muốn
kubectl get pods -l app=order-api
kubectl set image deployment/order-api api=ghcr.io/shop/order-api:a1b2c3d
kubectl rollout status deployment/order-api
kubectl logs -f deploy/order-api --since=10m
kubectl describe pod order-api-7d9f8c6b5-x2k4p   # xem Events khi pod không lên
```

```text
Output (ví dụ) của kubectl get pods:
NAME                         READY   STATUS             RESTARTS   AGE
order-api-7d9f8c6b5-x2k4p    1/1     Running            0          2d
order-api-7d9f8c6b5-q8m1z    1/1     Running            0          2d
order-api-6c4b7f9d8-n5t2w    0/1     CrashLoopBackOff   5          4m
```

| Trạng thái lỗi | Nghĩa là | Kiểm tra |
|---|---|---|
| `ImagePullBackOff` | Không kéo được image | Sai tag? Thiếu quyền registry? |
| `CrashLoopBackOff` | Container khởi động rồi chết liên tục | `kubectl logs --previous`: thiếu env var? không kết nối được DB? |
| `OOMKilled` | Vượt memory limit | Rò rỉ bộ nhớ? limit quá thấp? |
| `Pending` | Không node nào đủ tài nguyên | `requests` quá lớn? cụm hết chỗ? |
| `0/1 Ready` | Readiness fail | Endpoint `/readyz` trả gì? |

!!! tip "Không phải lúc nào cũng cần Kubernetes"
    K8s mạnh nhưng **phức tạp** và tốn người vận hành. Team nhỏ, ít service: cân nhắc **PaaS / serverless container** — Google Cloud Run, AWS App Runner / ECS Fargate, Fly.io, Render, Railway. Bạn vẫn dùng Docker image, vẫn có rolling deploy, autoscale, HTTPS — mà không phải quản lý cụm. Chuyển lên K8s khi thật sự cần (nhiều service, nhiều team, yêu cầu đặc thù). Nếu dùng K8s, hãy dùng bản **managed** (EKS, GKE, AKS).

### 13.6. GitOps

Thay vì pipeline chạy `kubectl apply` trực tiếp, **GitOps** (Argo CD, Flux) coi **một repo git** là nguồn sự thật cho trạng thái cụm: CI chỉ cập nhật tag image trong repo config → Argo CD thấy thay đổi và đồng bộ vào cụm. Lợi ích: mọi thay đổi có lịch sử, có review; rollback = `git revert`; cụm "lệch" khỏi git sẽ được tự sửa.

## 📖 14. Infrastructure as Code với Terraform

Tạo hạ tầng bằng cách bấm chuột trên console → không ai nhớ đã bấm gì, không tái tạo được, không review được. **Infrastructure as Code (IaC)** mô tả hạ tầng bằng file text trong git.

```hcl
# main.tf — một PostgreSQL managed trên AWS (rút gọn)
terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
  backend "s3" {                       # state lưu tập trung, có khóa
    bucket = "shop-terraform-state"
    key    = "prod/database.tfstate"
    region = "ap-southeast-1"
  }
}

provider "aws" {
  region = "ap-southeast-1"            # Singapore — gần Việt Nam
}

variable "env" {
  type    = string
  default = "prod"
}

resource "aws_db_instance" "orders" {
  identifier                  = "orders-${var.env}"
  engine                      = "postgres"
  engine_version              = "16"
  instance_class              = var.env == "prod" ? "db.t4g.medium" : "db.t4g.micro"
  allocated_storage           = 50
  db_name                     = "orders"
  username                    = "order_admin"
  manage_master_user_password = true   # mật khẩu do Secrets Manager quản lý
  multi_az                    = var.env == "prod"
  backup_retention_period     = 7
  deletion_protection         = true
  storage_encrypted           = true

  tags = { team = "orders", env = var.env }
}

output "db_endpoint" {
  value = aws_db_instance.orders.address
}
```

```bash
terraform init      # tải provider, cấu hình backend
terraform plan      # xem SẼ thay đổi gì (đưa vào PR để review)
terraform apply     # thực hiện
```

```text
Output (ví dụ) của terraform plan:
  # aws_db_instance.orders will be created
  + resource "aws_db_instance" "orders" {
      + engine         = "postgres"
      + instance_class = "db.t4g.medium"
      + multi_az       = true
      ...
    }

Plan: 1 to add, 0 to change, 0 to destroy.
```

!!! tip "Thói quen tốt với IaC"
    - **Luôn đọc `plan`** trước `apply` — đặc biệt dòng `destroy` và `must be replaced` (thay thế DB = mất dữ liệu!).
    - State lưu remote (S3/GCS) có **locking**; state có thể chứa secret → bảo vệ như secret.
    - Đặt `deletion_protection`, `prevent_destroy` cho tài nguyên chứa dữ liệu.
    - Chạy `plan` trong CI cho mỗi PR, `apply` sau khi merge (Atlantis, Terraform Cloud, hoặc workflow riêng).
    - Lựa chọn khác: **OpenTofu** (fork mã nguồn mở của Terraform), **Pulumi** (viết IaC bằng Go/Python/TypeScript).

## 📖 15. Bản đồ dịch vụ cloud

Tên khác nhau nhưng khái niệm giống nhau. Nắm cột "khái niệm" là chuyển cloud không khó.

| Khái niệm | AWS | GCP | Dùng khi |
|---|---|---|---|
| Máy ảo | EC2 | Compute Engine | Toàn quyền kiểm soát, phần mềm đặc thù |
| Container không quản lý server | ECS Fargate, App Runner | **Cloud Run** | API/worker stateless — lựa chọn mặc định tốt |
| Kubernetes managed | EKS | GKE | Nhiều service, nhiều team |
| Function (FaaS) | Lambda | Cloud Run functions | Xử lý sự kiện, tác vụ ngắn, tải thất thường |
| SQL managed | RDS, Aurora | Cloud SQL, AlloyDB | PostgreSQL/MySQL — hầu hết mọi ứng dụng |
| NoSQL key-value/document | DynamoDB | Firestore, Bigtable | Xem [Bài 7](./07-nosql.md) |
| Cache | ElastiCache (Redis/Valkey) | Memorystore | Xem [Bài 8](./08-caching.md) |
| Object storage | S3 | Cloud Storage | File, ảnh, backup, data lake |
| Message queue | SQS | Cloud Tasks | Hàng đợi công việc |
| Pub/sub, streaming | SNS, Kinesis, MSK (Kafka) | Pub/Sub | Xem [Bài 9](./09-message-queues.md) |
| CDN | CloudFront | Cloud CDN | Nội dung tĩnh, giảm độ trễ |
| DNS | Route 53 | Cloud DNS | Tên miền |
| Load balancer | ALB / NLB | Cloud Load Balancing | Phân tải HTTP/TCP |
| Container registry | ECR | Artifact Registry | Lưu image |
| Secrets | Secrets Manager, SSM Parameter Store | Secret Manager | Xem [Bài 12](./12-security.md) |
| Quyền truy cập | IAM | IAM | Least privilege cho người và service |
| Logs / metrics | CloudWatch | Cloud Logging / Monitoring | Xem [Bài 11](./11-observability-reliability.md) |
| Data warehouse | Redshift, Athena | **BigQuery** | Phân tích, báo cáo |

!!! note "Ở Việt Nam"
    Ngoài AWS/GCP/Azure, nhiều công ty dùng cloud trong nước (Viettel Cloud, FPT Cloud, VNG Cloud, BizFly Cloud) vì yêu cầu lưu trữ dữ liệu trong nước (Nghị định 53/2022 hướng dẫn Luật An ninh mạng, và các quy định về bảo vệ dữ liệu cá nhân), độ trễ thấp, và thanh toán bằng VND. Các khái niệm trong bảng vẫn áp dụng y nguyên.

## 📖 16. Ý thức về chi phí (FinOps cơ bản)

Trên cloud, **mỗi dòng code và mỗi quyết định kiến trúc đều có giá tiền**. Kỹ sư backend giỏi biết hóa đơn đến từ đâu.

**Ví dụ tính nhẩm** (giá minh họa, thay đổi theo vùng và thời điểm):

```text
3 pod x (0.25 vCPU, 512MB) chạy 24/7 trên node      ≈ vài chục USD/tháng
PostgreSQL managed Multi-AZ (2 vCPU, 4GB)            ≈ 100–200 USD/tháng
NAT Gateway: phí giờ + phí mỗi GB đi qua             ≈ dễ thành 100+ USD/tháng mà không ai để ý
Log: 50 GB/ngày x 30 ngày ingest + lưu trữ          ≈ có thể đắt hơn cả DB!
Data transfer ra Internet / giữa các vùng           ≈ tính theo GB — "thuế vô hình"
```

Các nguồn tốn tiền hay bị bỏ quên và cách xử lý:

| Nguồn | Cách giảm |
|---|---|
| Môi trường dev/staging chạy 24/7 | Tự tắt ngoài giờ làm việc, scale về 0 |
| `requests` CPU/RAM đặt quá cao "cho chắc" | Đo thực tế (p95 usage), right-sizing |
| Log debug ở production, giữ log vĩnh viễn | Log level `info`, sampling, retention 7–30 ngày, log lạnh sang object storage |
| Metric có cardinality cao (label `user_id`) | Xem [Bài 11](./11-observability-reliability.md) |
| Ổ đĩa, snapshot, IP tĩnh, load balancer "mồ côi" | Gắn tag `team`/`env`, rà soát định kỳ |
| Traffic giữa các AZ/region, qua NAT | Đặt service gần nhau, VPC endpoint cho S3 |
| Workload ổn định chạy on-demand | Reserved instances / Savings Plans / Committed use (giảm 30–60%) |
| Batch job chịu được gián đoạn | Spot / preemptible instances (giảm 60–90%) |

!!! tip "Thói quen"
    - Bật **budget alert** ngay ngày đầu tạo tài khoản cloud (ví dụ báo khi vượt 50%, 80%, 100% ngân sách).
    - Gắn **tag** `team`, `service`, `env` cho mọi tài nguyên để biết ai tiêu bao nhiêu.
    - Khi thiết kế, hỏi thêm câu: *"Ở 10 lần traffic hiện tại, hóa đơn tăng tuyến tính hay tăng vọt?"*

## 🌍 Ứng dụng thực tế

- **Shopee/Tiki trước đợt sale 11.11**: chạy **load test + spike test** trên staging với dữ liệu cỡ thật nhiều tuần trước, pre-scale (tăng `minReplicas`) trước giờ G thay vì chỉ trông vào autoscale, **đóng băng deploy** (code freeze) vài ngày quanh sự kiện, bật sẵn **kill switch** để tắt các tính năng phụ (gợi ý, đánh giá) khi quá tải.
- **Ví điện tử / ngân hàng số**: mọi thay đổi đi qua **canary** 1% → 10% → 50% → 100% kèm theo dõi tỉ lệ giao dịch thành công; migration DB bắt buộc expand/contract; contract test giữa core banking và các service xung quanh.
- **Startup nhỏ 3–5 kỹ sư**: GitHub Actions + Docker + **Cloud Run** hoặc Render, PostgreSQL managed, feature flag tự làm bằng bảng DB. Deploy nhiều lần mỗi ngày mà không cần một người DevOps riêng.
- **Công ty dùng Kubernetes**: GitOps với Argo CD, Argo Rollouts cho canary tự động dựa trên metric Prometheus, Terraform cho hạ tầng, External Secrets lấy secret từ Vault.
- **Google, Facebook, Netflix**: trunk-based development, hàng nghìn deploy mỗi ngày, mọi tính năng lớn đều nằm sau feature flag; Netflix còn chạy **chaos engineering** (Chaos Monkey) để chắc chắn hệ thống chịu được instance chết bất kỳ lúc nào.

## ⚠️ Lỗi thường gặp

### 1. Test phụ thuộc lẫn nhau

```text
❌ Test A tạo user "an@x.com", test B giả định user đó đã tồn tại → chạy riêng B thì đỏ,
   chạy song song thì ngẫu nhiên đỏ
✅ Mỗi test tự tạo dữ liệu nó cần (Arrange), dùng DB/schema/transaction riêng
```

### 2. Mock mọi thứ, kể cả database

```text
❌ mockDB.On("Query", "SELECT * FROM users WHERE email = $1") → test xanh, SQL thật sai tên cột
✅ Repository test bằng DB thật (Testcontainers); service test bằng fake repo
```

### 3. Test phụ thuộc thời gian thật và random

```text
❌ if time.Now().Hour() >= 22 { phí ship đêm } → test đỏ khi CI chạy lúc 22h
✅ Tiêm "đồng hồ" vào (Clock interface / tham số now), seed cố định cho random
```

### 4. Dùng tag `latest` cho image

```text
❌ image: order-api:latest → không biết đang chạy phiên bản nào, rollback về "latest" nào?
✅ image: order-api:9f3c2a1 (commit SHA) hoặc digest @sha256:... — bất biến, truy vết được
```

### 5. Migration phá vỡ tương thích chạy cùng lúc với deploy

```text
❌ Cùng một release: đổi tên cột + code mới dùng tên mới → pod cũ đang chạy lỗi hàng loạt
✅ Expand → deploy → backfill → deploy → contract (mục 11)
```

### 6. Liveness probe kiểm tra phụ thuộc bên ngoài

```text
❌ /healthz ping DB, Redis, payment API → một phụ thuộc chậm làm restart toàn bộ pod
✅ liveness: chỉ process; readiness: phụ thuộc thiết yếu; startup: cho app khởi động chậm
```

### 7. Không đặt resource requests/limits

```text
❌ Không đặt gì → pod "hàng xóm ồn ào" ăn hết RAM của node, pod khác bị giết oan; HPA không tính được %
✅ Đặt requests theo đo đạc thực tế, luôn đặt memory limit
```

### 8. Build lại image cho từng môi trường

```text
❌ Build image riêng cho staging và production → thứ lên production chưa từng được test
✅ Build một lần, promote cùng image; khác biệt chỉ nằm ở config (env var, ConfigMap)
```

### 9. Secret trong repo hoặc trong log CI

```text
❌ DATABASE_URL=postgres://admin:P@ssw0rd@... trong .env được commit; echo $TOKEN trong workflow
✅ Secret store + OIDC; GitHub tự che secret trong log nhưng đừng in ra hoặc biến đổi nó
```

### 10. Feature flag không bao giờ được dọn

```text
❌ 2 năm sau vẫn còn if flags.new_checkout_v2 && !flags.old_cart_fix ... không ai dám xóa
✅ Mỗi release flag có owner + ngày hết hạn; ticket dọn dẹp tạo ngay khi tạo flag
```

## 🏋️ Bài tập

### Bài tập 1: Phân loại test double (⭐ Dễ)

Với mỗi tình huống, chọn dummy / stub / fake / spy / mock:

1. Test hàm tính phí ship cần một `Logger` nhưng hàm không log gì trong nhánh đang test.
2. Test "khi SMS gateway trả lỗi thì vẫn lưu đơn hàng".
3. Test repository của cart với một bản cài đặt dùng map thay cho Redis.
4. Test "sau khi đặt hàng thành công thì đã publish đúng 1 event `OrderPlaced`".
5. Test "phải gọi `Refund(orderID, amount)` đúng một lần với đúng số tiền khi hủy đơn".

<details markdown="1"><summary>Đáp án</summary>

1. **Dummy** — chỉ để lấp tham số.
2. **Stub** — trả lỗi đóng hộp để đi vào nhánh lỗi.
3. **Fake** — cài đặt thật nhưng đơn giản.
4. **Spy** — ghi lại các event đã publish rồi kiểm tra sau (hoặc mock nếu bạn đặt kỳ vọng trước).
5. **Mock** — cách gọi chính là hành vi cần kiểm tra. (Spy + assert sau cũng đạt được; khác biệt chỉ là kỳ vọng đặt **trước** hay kiểm tra **sau**.)

</details>

### Bài tập 2: Thêm test cho `OrderService` (⭐ Dễ)

Thêm vào ví dụ mục 3: nếu `repo.Save` trả lỗi sau khi đã trừ tiền thành công thì `Place` phải trả lỗi và **không** gửi thông báo. Viết fake repo có thể "cấu hình để lỗi". Câu hỏi thêm: trong đời thật, tình huống "đã trừ tiền nhưng không lưu được đơn" nên xử lý thế nào? (Gợi ý: outbox, saga — [Bài 9](./09-message-queues.md), [Bài 14](./14-architecture-microservices.md).)

<details markdown="1"><summary>Gợi ý</summary>

Go: `type fakeRepo struct{ data map[string]Order; failSave bool }`, trong `Save` trả `errors.New("db down")` nếu `failSave`. Python: `FakeRepo(fail_save=True)` raise exception. Assert `err != nil` và `len(spy.msgs) == 0`. Đời thật: ghi đơn `PENDING` **trước** khi trừ tiền (có idempotency key), sau đó cập nhật trạng thái; nếu cập nhật lỗi, job đối soát (reconciliation) hoặc saga sẽ hoàn tiền/hoàn tất đơn.

</details>

### Bài tập 3: Feature flag theo nhóm (⭐⭐ Trung bình)

Mở rộng flag evaluator mục 10: thêm `DenyList` (không bao giờ bật), và **rules theo thuộc tính** — ví dụ chỉ bật cho `city == "HCM"` và `app_version >= 5.2.0`. Thứ tự ưu tiên: kill switch → deny list → allow list → rules → percentage. Viết test cho từng nhánh, và test rằng tăng `Percent` từ 30 lên 50 thì **mọi** user đang bật vẫn bật.

### Bài tập 4: Pipeline CI hoàn chỉnh (⭐⭐ Trung bình)

Cho một service (Go hoặc Python) của bạn từ các bài trước, viết workflow GitHub Actions: lint, test với PostgreSQL service container, `govulncheck`/`pip-audit`, build image, scan bằng Trivy, push lên GHCR chỉ khi ở `main`. Thời gian chạy phải dưới 5 phút — đo và tối ưu bằng cache. Bật branch protection yêu cầu CI xanh.

### Bài tập 5: Kế hoạch migration expand/contract (⭐⭐ Trung bình)

Bảng `orders` có 50 triệu dòng, cột `status TEXT` với giá trị `'paid'`, `'shipped'`... Yêu cầu: chuyển sang cột `status_code SMALLINT` (1 = paid, 2 = shipped...) và cuối cùng xóa cột cũ. Viết danh sách các release (code + migration) theo thứ tự, câu SQL cho từng bước, cách backfill không khóa bảng, và điểm nào có thể rollback an toàn.

<details markdown="1"><summary>Gợi ý</summary>

R1: `ADD COLUMN status_code SMALLINT` (nullable). R2: code ghi cả hai cột, đọc `status`. Backfill theo lô `WHERE id BETWEEN x AND x+10000`, có sleep giữa các lô, theo dõi replica lag. R3: code đọc `status_code` (fallback `status` nếu NULL). Thêm `CHECK`/`NOT NULL` bằng `NOT VALID` rồi `VALIDATE CONSTRAINT`. R4: code chỉ ghi `status_code`. R5: `DROP COLUMN status`. Từ R1 đến R4 đều rollback code được; sau R5 thì không.

</details>

### Bài tập 6: Deploy lên Kubernetes local (⭐⭐⭐ Khó)

Dùng **kind** hoặc **minikube**: deploy service của bạn với Deployment (3 replicas, 3 loại probe, resources), Service, Ingress, ConfigMap, Secret, HPA. Sau đó:

1. Đổi image sang phiên bản mới và quan sát rolling update bằng `kubectl rollout status` trong khi chạy k6 liên tục — có request nào lỗi không? Nếu có, sửa (gợi ý: graceful shutdown, `preStop` sleep vài giây, readiness).
2. Deploy một phiên bản cố tình crash lúc khởi động → quan sát `CrashLoopBackOff`, và rollout **dừng lại** nhờ `maxUnavailable: 0`. Rollback bằng `kubectl rollout undo`.

### Bài tập 7: Canary thủ công và tiêu chí tự động (⭐⭐⭐ Khó)

Thiết kế (viết ra giấy hoặc tài liệu) quy trình canary cho `order-api`: các bước % traffic, thời gian chờ mỗi bước, **metric nào** quyết định tiến/lùi (error rate 5xx, p99 latency, tỉ lệ đặt hàng thành công so với nhóm stable), ngưỡng cụ thể, và điều gì xảy ra với request đang dở khi rollback. Nếu làm được, cài đặt bằng Argo Rollouts hoặc hai Deployment + trọng số ở Ingress (nginx `canary-weight`).

## ✅ Checklist hoàn thành

- [ ] Giải thích được test pyramid vs testing trophy và chọn được chiến lược test cho backend
- [ ] Phân biệt và viết được dummy, stub, fake, spy, mock bằng Go và Python
- [ ] Viết được table-driven test (Go) / subTest hoặc parametrize (Python)
- [ ] Viết integration test với DB thật, mỗi test cô lập; biết dùng Testcontainers
- [ ] Hiểu contract testing và các quy tắc tiến hóa API không phá vỡ
- [ ] Viết được kịch bản k6 có thresholds và đọc được p95/p99, error rate
- [ ] Viết được workflow GitHub Actions: lint, test, scan, build và push image
- [ ] So sánh được recreate, rolling, blue-green, canary
- [ ] Cài đặt được feature flag với rollout theo phần trăm ổn định và kill switch
- [ ] Lập được kế hoạch migration expand/contract; biết thứ gì không rollback được
- [ ] Hiểu build once deploy many, các môi trường, 12-factor
- [ ] Viết được Deployment, Service, Ingress, ConfigMap, Secret, HPA; phân biệt 3 loại probe
- [ ] Đọc được một file Terraform và quy trình plan/apply
- [ ] Map được dịch vụ AWS ↔ GCP và biết các nguồn chi phí cloud hay bị bỏ quên

**Bài tiếp theo**: [Bài 14: Kiến trúc & Microservices](./14-architecture-microservices.md)
