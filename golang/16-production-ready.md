# 📚 Bài 16: Go trong Production

## 🎯 Mục tiêu bài học

- Tổ chức **cấu trúc project thực tế** với `cmd/`, `internal/` (và biết khi nào **không** cần `pkg/`)
- Đọc **cấu hình** từ biến môi trường, cờ dòng lệnh và file theo nguyên tắc **12-factor**
- **Dependency injection thủ công** và **functional options pattern**
- Thiết kế **interface nhỏ** để code dễ test
- **Structured logging** với `slog` và **bọc lỗi xuyên các tầng** (repository → service → handler)
- **Graceful shutdown** với `signal.NotifyContext`, **health check** `/healthz` và `/readyz`
- **Metrics** cơ bản với `expvar`, **profiling** với `pprof`
- **Benchmark** và **tối ưu cấp phát bộ nhớ**
- **Build** có version (`-ldflags`), **cross-compile** (`GOOS`/`GOARCH`)
- **Dockerfile multi-stage** với image `distroless`/`scratch`
- **CI với GitHub Actions**: `go vet`, `go test -race`, `golangci-lint`, `govulncheck`
- **Makefile** và các nguyên tắc **bảo mật cơ bản**
- **Capstone**: xây dựng **Bookmark API** hoàn chỉnh - config, slog, SQLite, middleware, test, Dockerfile, CI

## 📖 1. Từ "chạy được" đến "sẵn sàng cho production"

Todo API ở [Bài 10](./10-final-project.md) **chạy được**. Nhưng để nó phục vụ người dùng thật 24/7, bạn cần trả lời thêm nhiều câu hỏi:

| Câu hỏi | Nếu bỏ qua thì... | Mục |
|---------|-------------------|-----|
| Code để ở đâu khi dự án lớn dần? | 50 file trong một thư mục, không ai tìm được gì | 2 |
| Đổi cổng, đổi DB thế nào mà không sửa code? | Build lại mỗi lần đổi môi trường | 3 |
| Làm sao test mà không cần DB thật? | Test chậm, phụ thuộc môi trường, không ai chạy | 4, 5 |
| Có lỗi lúc 3 giờ sáng, xem ở đâu? | "Nó chạy trên máy em mà!" | 6 |
| Deploy phiên bản mới có làm mất request? | Người dùng thấy lỗi 502 mỗi lần deploy | 7 |
| Load balancer biết server còn sống không? | Gửi request vào server đã chết | 8 |
| Server chậm, chậm ở đâu? | Đoán mò, tối ưu sai chỗ | 9, 10 |
| Phiên bản nào đang chạy trên server? | Không biết bug đã được sửa chưa | 11 |
| Đóng gói, triển khai, kiểm tra tự động? | "Build trên máy anh A mới chạy" | 12, 13, 14 |
| Có bị hack không? | Lộ dữ liệu người dùng | 15 |

> 💡 **Ví von**: Viết code chạy được giống như **nấu được một món ngon ở nhà**. Đưa lên production giống như **mở nhà hàng**: cần bếp gọn gàng (cấu trúc), công thức ghi rõ (config), kiểm tra chất lượng (test, CI), sổ ghi chép (log), camera giám sát (metrics, profiling), quy trình mở/đóng cửa (graceful shutdown), và an toàn thực phẩm (bảo mật).

## 📖 2. Cấu trúc project thực tế

Bạn đã gặp `internal/` ở [Bài 9](./09-packages-modules-testing.md). Đây là bố cục được dùng rộng rãi cho một service Go:

```text
bookmark-api/
├── cmd/                        ← Mỗi thư mục con = MỘT chương trình (package main)
│   └── bookmark-api/
│       └── main.go             ← Mỏng: đọc config, "lắp ráp" các thành phần, chạy
├── internal/                   ← Code RIÊNG của module - module khác KHÔNG import được
│   ├── config/                 ← Đọc cấu hình
│   ├── bookmark/               ← Nghiệp vụ (domain): model, quy tắc, Service
│   ├── storage/sqlite/         ← Cài đặt lưu trữ
│   └── httpapi/                ← Tầng HTTP: handler, middleware
├── Dockerfile
├── Makefile
├── .github/workflows/ci.yml
├── go.mod
└── go.sum
```

### Khi nào dùng thư mục nào?

| Thư mục | Dùng khi | Ghi chú |
|---------|----------|---------|
| `cmd/<tên>/` | Có file thực thi (server, CLI, worker, tool migrate...) | Một repo có thể có nhiều: `cmd/api`, `cmd/worker`, `cmd/migrate` |
| `internal/` | **Hầu hết code** của ứng dụng | Compiler **cấm** module khác import → tự do sửa đổi mà không sợ làm hỏng người khác |
| `pkg/` | Code bạn **chủ động muốn** cho project khác import | ⚠️ **Không bắt buộc**, nhiều người khuyên **tránh**: nếu là thư viện thì đặt ở gốc module; nếu không định chia sẻ thì dùng `internal/` |
| Gốc repo (chỉ `main.go`) | Tool nhỏ, dưới ~10 file | Đừng tạo 10 thư mục cho chương trình 200 dòng! |

**Chia package theo nghiệp vụ, không theo loại file**:

```text
❌ Theo "loại" (kiểu MVC)          ✅ Theo nghiệp vụ / trách nhiệm
internal/                           internal/
├── models/                         ├── bookmark/    ← model + service + lỗi của bookmark
├── controllers/                    ├── user/        ← model + service + lỗi của user
├── services/                       ├── storage/     ← lưu trữ
└── utils/  ← "thùng rác"           └── httpapi/     ← giao tiếp HTTP
```

Tên package là một phần của tên gọi: `bookmark.Service`, `bookmark.ErrNotFound` đọc rất tự nhiên; `services.BookmarkService`, `models.Bookmark` thì lặp từ. Và **đừng bao giờ** tạo package `utils`, `common`, `helpers` - chúng sẽ thành nơi chứa mọi thứ không ai muốn nhận.

> 💡 **Hướng phụ thuộc** quan trọng hơn tên thư mục: `httpapi` → `bookmark` ← `storage/sqlite`. Package nghiệp vụ `bookmark` **không import** HTTP hay SQLite. Nhờ vậy bạn có thể đổi SQLite sang PostgreSQL, hoặc thêm gRPC bên cạnh HTTP, mà **không sửa một dòng** nghiệp vụ.

## 📖 3. Cấu hình theo 12-Factor

**The Twelve-Factor App** ([12factor.net](https://12factor.net)) là bộ nguyên tắc cho ứng dụng chạy trên cloud. Nguyên tắc số III: **"Lưu cấu hình trong môi trường"** - cùng một binary chạy ở dev, staging, production; chỉ **biến môi trường** là khác.

> 💡 **Ví von**: Binary là **chiếc xe**. Config là **điểm đến** bạn nhập vào GPS. Bạn không cần mua xe mới cho mỗi chuyến đi.

### Thứ tự ưu tiên phổ biến

```text
Giá trị mặc định  <  File cấu hình  <  Biến môi trường  <  Cờ dòng lệnh
(trong code)         (config.json)     (BOOKMARK_ADDR)     (-addr :9000)
   thấp nhất ───────────────────────────────────────────────► cao nhất
```

- **Mặc định**: hợp lý cho môi trường dev → `go run .` là chạy được ngay
- **Biến môi trường**: cách chuẩn trên Docker/Kubernetes
- **Cờ**: tiện khi chạy tay, debug
- **File**: hữu ích khi cấu hình phức tạp (danh sách, lồng nhau). Với service nhỏ, thường **không cần**

Capstone (mục 16) có package `config` hoàn chỉnh. Ý tưởng cốt lõi - dùng **biến môi trường làm giá trị mặc định cho cờ**:

```go
env := func(key, def string) string { return cmp.Or(getenv(key), def) }

fs := flag.NewFlagSet("bookmark-api", flag.ContinueOnError)
addr := fs.String("addr", env("BOOKMARK_ADDR", ":8080"), "địa chỉ HTTP API")
//                        └─ env có thì dùng env, không thì ":8080"
//     và nếu người dùng truyền -addr thì cờ sẽ ghi đè cả hai
```

Nếu muốn thêm lớp **file**, đọc file **trước** rồi dùng giá trị trong file làm "mặc định" cho `env(...)`:

```go
type fileConfig struct {
	Addr   string `json:"addr"`
	DBPath string `json:"db_path"`
}

func loadFile(path string) (fileConfig, error) {
	var fc fileConfig
	if path == "" {
		return fc, nil // Không có file cũng không sao
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return fc, fmt.Errorf("đọc file cấu hình: %w", err)
	}
	return fc, json.Unmarshal(data, &fc)
}

// ... addr := fs.String("addr", env("BOOKMARK_ADDR", cmp.Or(fc.Addr, ":8080")), "...")
```

**Nguyên tắc vàng**:
- ✅ **Validate ngay khi khởi động** và **gom tất cả lỗi** (`errors.Join`) → sai cấu hình thì **chết ngay** với thông báo rõ ràng, thay vì chạy được 2 tiếng rồi mới lỗi
- ✅ Hàm `Load(args, getenv)` nhận **tham số** thay vì gọi `os.Getenv` trực tiếp → test được
- ✅ Đặt **tiền tố** cho biến môi trường (`BOOKMARK_...`) tránh đụng biến của hệ thống
- ❌ **Không** đọc `os.Getenv` rải rác khắp code - chỉ đọc ở **một chỗ** (package `config`), rồi truyền `Config` đi
- ❌ **Không** commit secret (mật khẩu, API key) vào file cấu hình trong Git

## 📖 4. Dependency Injection thủ công & Functional Options

### Dependency Injection (DI) là gì?

Nghe có vẻ phức tạp, nhưng DI chỉ là: **"Đừng tự tạo thứ mình cần - hãy nhận nó từ bên ngoài"**.

```go
// ❌ Tự tạo phụ thuộc bên trong → không thể thay bằng bản giả khi test
func NewService() *Service {
	db, _ := sql.Open("sqlite", "prod.db")
	return &Service{db: db}
}

// ✅ Nhận phụ thuộc qua tham số → test truyền bản giả, production truyền bản thật
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}
```

> 💡 **Ví von**: Đầu bếp (Service) **không tự trồng rau** (tạo DB). Rau được **giao đến** (inject) mỗi sáng. Muốn thử món mới với rau giả bằng nhựa (test)? Chỉ cần đổi nhà cung cấp.

Java/C# thường dùng framework DI (Spring...). Trong Go, **DI thủ công trong `main`** là cách phổ biến nhất - rõ ràng, không "phép màu":

```go
// main.go - "lắp ráp" từ trong ra ngoài
store, err := sqlite.Open(ctx, cfg.DBPath)          // Tầng thấp nhất
svc := bookmark.NewService(store)                   // Service nhận store
api := httpapi.New(svc, store, httpapi.WithLogger(logger)) // Handler nhận service
srv := &http.Server{Addr: cfg.Addr, Handler: api.Handler()}
```

Nhìn vào `main`, bạn thấy **toàn bộ sơ đồ** của ứng dụng trong 10 dòng. (Với dự án rất lớn, có công cụ sinh code DI như `google/wire`, nhưng hầu hết dự án không cần.)

### Functional Options Pattern

**Vấn đề**: Constructor có nhiều tham số tùy chọn. Các cách "ngây thơ" đều có nhược điểm:

```go
NewClient("https://api.com", 10*time.Second, 3, "my-app", nil) // ❌ Số 3 là gì? nil là gì?
NewClient("https://api.com", Config{Timeout: 10 * time.Second}) // 🤔 Được, nhưng 0 là "không set" hay "set bằng 0"?
```

**Functional options**: mỗi tùy chọn là một **hàm** sửa đối tượng. Pattern này do Dave Cheney và Rob Pike phổ biến, được dùng trong gRPC, Uber zap, và vô số thư viện Go.

```go
package main

import (
	"fmt"
	"log/slog"
	"os"
	"time"
)

// Client gọi một API bên ngoài. Có nhiều tùy chọn, hầu hết có giá trị mặc định hợp lý.
type Client struct {
	baseURL   string        // Bắt buộc
	timeout   time.Duration // Tùy chọn
	retries   int           // Tùy chọn
	userAgent string        // Tùy chọn
	logger    *slog.Logger  // Tùy chọn
}

// Option là một hàm "chỉnh sửa" Client
type Option func(*Client)

func WithTimeout(d time.Duration) Option {
	return func(c *Client) { c.timeout = d }
}

func WithRetries(n int) Option {
	return func(c *Client) { c.retries = n }
}

func WithUserAgent(ua string) Option {
	return func(c *Client) { c.userAgent = ua }
}

func WithLogger(l *slog.Logger) Option {
	return func(c *Client) { c.logger = l }
}

// NewClient: tham số BẮT BUỘC đứng trước, tùy chọn là variadic ở cuối
func NewClient(baseURL string, opts ...Option) *Client {
	c := &Client{ // 1. Giá trị mặc định
		baseURL:   baseURL,
		timeout:   10 * time.Second,
		retries:   3,
		userAgent: "my-app/1.0",
		logger:    slog.New(slog.DiscardHandler), // Go 1.24+: logger "im lặng"
	}
	for _, opt := range opts { // 2. Áp dụng từng tùy chọn theo thứ tự
		opt(c)
	}
	return c
}

func (c *Client) String() string {
	return fmt.Sprintf("Client{url=%s timeout=%v retries=%d ua=%q}", c.baseURL, c.timeout, c.retries, c.userAgent)
}

func main() {
	// Chỉ cần mặc định
	fmt.Println(NewClient("https://api.example.com"))

	// Chỉ đổi những gì cần - dễ đọc như câu văn
	fmt.Println(NewClient("https://api.example.com",
		WithTimeout(2*time.Second),
		WithRetries(0),
	))

	// Gom tùy chọn dùng chung thành slice
	prodOpts := []Option{WithUserAgent("bookmark-api/2.3"), WithLogger(slog.New(slog.NewJSONHandler(os.Stderr, nil)))}
	fmt.Println(NewClient("https://api.example.com", prodOpts...))
}

// Output:
// Client{url=https://api.example.com timeout=10s retries=3 ua="my-app/1.0"}
// Client{url=https://api.example.com timeout=2s retries=0 ua="my-app/1.0"}
// Client{url=https://api.example.com timeout=10s retries=3 ua="bookmark-api/2.3"}
```

**Ưu điểm**:
- **Mặc định hợp lý**, người dùng chỉ ghi những gì cần đổi
- **Tự mô tả**: `WithRetries(0)` rõ ràng hơn số `0` đứng một mình
- **Thêm tùy chọn mới không phá vỡ** code cũ (không đổi chữ ký hàm)
- Phân biệt được "không set" và "set bằng 0" (`WithRetries(0)` là tắt retry)

> 💡 **Khi nào KHÔNG cần**: Struct chỉ có 2-3 field, hoặc code nội bộ trong `internal/` - một struct `Config` đơn giản là đủ. Đừng "over-engineer".

## 📖 5. Interface nhỏ cho testability

Nguyên tắc Go nổi tiếng: **"Accept interfaces, return structs"** (nhận interface, trả về struct) và **"The bigger the interface, the weaker the abstraction"** (interface càng lớn, trừu tượng càng yếu).

**Quy tắc thực hành**:
1. **Khai báo interface ở phía NGƯỜI DÙNG**, không phải phía cài đặt. Package `bookmark` cần lưu trữ → `bookmark` khai báo `Repository`. Package `sqlite` chỉ việc có các method phù hợp (Go tự động thỏa mãn interface, không cần `implements`)
2. **Chỉ đưa vào interface những method thật sự dùng**. Handler `/readyz` chỉ cần `Ping` → interface `Pinger` một method

```go
// Trong package httpapi - chỉ cần Ping, không cần biết đó là SQLite hay Postgres
type Pinger interface {
	Ping(ctx context.Context) error
}
```

Khi test, tạo bản giả chỉ mất vài dòng:

```go
type fakePinger struct{ err error }

func (f fakePinger) Ping(context.Context) error { return f.err }

// Test /readyz khi DB sập:
api := httpapi.New(svc, fakePinger{err: errors.New("db down")})
```

**Mẹo "nhúng interface nil"** để giả lập nhanh khi chỉ cần một method (hoặc để kiểm tra panic):

```go
// Nhúng interface: kiểu tự động có ĐỦ method, nhưng gọi method chưa ghi đè sẽ panic
type panicService struct{ BookmarkService }
```

Capstone dùng mẹo này để test middleware `recoverPanic` (xem `server_test.go`).

> ⚠️ **Đừng tạo interface "cho có"**: Nếu chỉ có **một** cài đặt và không cần giả lập khi test, dùng thẳng struct. Interface nên **được phát hiện** (khi cần), không nên **được thiết kế trước**.

## 📖 6. Logging với `slog` & bọc lỗi xuyên tầng

Bạn đã học `slog` ở [Bài 15](./15-generics-reflection-stdlib.md). Trong production:

- **JSON handler** + ghi ra **stdout** (12-factor: log là dòng sự kiện, việc thu thập là của hạ tầng - Docker, Kubernetes, Loki...)
- Mỗi request có **`request_id`** → lọc toàn bộ log của **một** request
- Level cấu hình được qua biến môi trường (`BOOKMARK_LOG_LEVEL=debug` khi điều tra sự cố)
- `logger.With("service", "bookmark-api")` → mọi dòng log đều biết đến từ service nào

### Bọc lỗi xuyên các tầng

Khi một lỗi xảy ra ở tầng sâu nhất, nó "nổi lên" qua nhiều tầng. Mỗi tầng **bọc thêm ngữ cảnh** bằng `%w` ([Bài 7](./07-error-handling.md)):

```text
sqlite:   bookmark.ErrNotFound                              ← dịch lỗi hạ tầng → lỗi nghiệp vụ
service:  "lấy bookmark 99: bookmark không tồn tại"          ← thêm ngữ cảnh (id nào)
handler:  errors.Is(err, bookmark.ErrNotFound) → 404         ← quyết định status code
```

**Ba quy tắc quan trọng**:

1. **Dịch lỗi ở ranh giới**: tầng `sqlite` biết `sql.ErrNoRows` và mã lỗi `SQLITE_CONSTRAINT_UNIQUE`; nó **dịch** thành `bookmark.ErrNotFound`, `bookmark.ErrDuplicateURL`. Tầng trên **không bao giờ** phải biết đến SQLite
2. **Log HOẶC trả về, không làm cả hai**: nếu mỗi tầng vừa log vừa `return err`, một lỗi sẽ xuất hiện 3 lần trong log. Chỉ **một nơi** log - thường là handler (trong capstone: hàm `writeError`)
3. **Không lộ chi tiết nội bộ cho client**: lỗi 500 được log **đầy đủ** (kèm `request_id`), nhưng client chỉ nhận `{"error":"lỗi hệ thống","request_id":"..."}`. Lộ câu SQL hay đường dẫn file là cho kẻ tấn công thêm thông tin

```go
// Một nơi DUY NHẤT chuyển lỗi → HTTP status (rút gọn từ capstone)
switch {
case errors.As(err, &validationErr):
	writeJSON(w, 400, ...)
case errors.Is(err, bookmark.ErrNotFound):
	writeJSON(w, 404, ...)
case errors.Is(err, bookmark.ErrDuplicateURL):
	writeJSON(w, 409, ...)
default:
	logger.ErrorContext(ctx, "lỗi nội bộ", "err", err, "request_id", id) // Log đầy đủ
	writeJSON(w, 500, map[string]string{"error": "lỗi hệ thống"})         // Client thấy chung chung
}
```

## 📖 7. Graceful Shutdown cho HTTP server

Ở [Bài 14](./14-advanced-concurrency.md) bạn đã tắt worker an toàn. Với HTTP server, Go có sẵn `srv.Shutdown(ctx)`:
1. **Đóng listener** → không nhận kết nối mới
2. **Đóng các kết nối rảnh** (keep-alive không có request)
3. **Chờ** các request đang xử lý hoàn thành
4. Trả về khi xong, hoặc khi `ctx` hết hạn (khi đó trả lỗi, bạn có thể `srv.Close()` để cắt ngang)

```go
package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /slow", func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(300 * time.Millisecond) // Một request "chậm" đang xử lý dở
		fmt.Fprint(w, "báo cáo đã xong")
	})

	srv := &http.Server{
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	ln, err := net.Listen("tcp", "127.0.0.1:0") // Cổng 0 = hệ điều hành tự chọn cổng trống
	if err != nil {
		fmt.Println("listen:", err)
		os.Exit(1)
	}

	// 1. ctx bị hủy khi nhận SIGINT (Ctrl+C) hoặc SIGTERM (docker stop / Kubernetes)
	//    (base + simulateCtrlC chỉ để demo tự dừng; code thật dùng context.Background())
	base, simulateCtrlC := context.WithCancel(context.Background())
	ctx, stop := signal.NotifyContext(base, os.Interrupt, syscall.SIGTERM)
	defer stop()

	// 2. Chạy server trong goroutine riêng
	serverErr := make(chan error, 1)
	go func() {
		fmt.Println("🚀 Server đang chạy")
		if err := srv.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err // Lỗi thật (ví dụ cổng bị chiếm)
		}
		close(serverErr)
	}()

	// --- Chỉ để demo: một client gọi /slow, và 100ms sau "ai đó" bấm Ctrl+C ---
	clientDone := make(chan string)
	go func() {
		resp, err := http.Get("http://" + ln.Addr().String() + "/slow")
		if err != nil {
			clientDone <- "client lỗi: " + err.Error()
			return
		}
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		clientDone <- "client nhận được: " + string(body)
	}()
	time.AfterFunc(100*time.Millisecond, simulateCtrlC)
	// --------------------------------------------------------------------------

	// 3. Chờ tín hiệu dừng HOẶC server chết vì lỗi
	select {
	case <-ctx.Done():
		fmt.Println("🛑 Nhận tín hiệu dừng")
	case err := <-serverErr:
		fmt.Println("server lỗi:", err)
		os.Exit(1)
	}
	stop() // Ctrl+C lần 2 sẽ giết chương trình ngay (hành vi mặc định)

	// 4. Shutdown: ngừng nhận kết nối mới, CHỜ request đang chạy xong (tối đa 10 giây)
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		fmt.Println("⚠️ Shutdown quá hạn, buộc đóng:", err)
		srv.Close()
	}
	fmt.Println(<-clientDone)
	fmt.Println("✅ Đã tắt an toàn - request đang chạy không bị cắt ngang")
}

// Output:
// 🚀 Server đang chạy
// 🛑 Nhận tín hiệu dừng
// client nhận được: báo cáo đã xong
// ✅ Đã tắt an toàn - request đang chạy không bị cắt ngang
```

**Ghi nhớ**:
- `ListenAndServe` **luôn** trả về lỗi khác `nil`. Sau khi `Shutdown`, lỗi là `http.ErrServerClosed` - đây là **bình thường**, đừng báo là lỗi
- Context cho `Shutdown` phải là context **mới** (`context.Background()` + timeout), không phải `ctx` đã bị hủy bởi tín hiệu - nếu không `Shutdown` sẽ trả về ngay lập tức
- Timeout shutdown phải **nhỏ hơn** thời gian chờ của hạ tầng (Docker: 10s, Kubernetes: `terminationGracePeriodSeconds` mặc định 30s)
- Luôn đặt **timeout** cho `http.Server` (`ReadHeaderTimeout`, `ReadTimeout`, `WriteTimeout`, `IdleTimeout`). Server không timeout có thể bị hạ gục bởi vài nghìn kết nối "rề rà" (tấn công **Slowloris**)

## 📖 8. Health check: `/healthz` và `/readyz`

Load balancer và Kubernetes cần biết: **server còn sống không?** và **có nên gửi request đến không?** Đây là **hai câu hỏi khác nhau**:

| Endpoint | Câu hỏi | Kiểm tra gì | Nếu thất bại |
|----------|---------|-------------|--------------|
| `/healthz` (liveness) | Tiến trình có bị treo/chết không? | Chỉ cần trả 200 | Kubernetes **restart** container |
| `/readyz` (readiness) | Sẵn sàng nhận traffic chưa? | Ping DB, đang shutdown không... | Tạm **ngừng gửi** traffic, không restart |

> ⚠️ **Lỗi kinh điển**: cho `/healthz` kiểm tra database. Khi DB chập chờn 30 giây, Kubernetes sẽ **restart tất cả pod** - vừa không giúp gì (DB vẫn lỗi), vừa gây sập dây chuyền. Liveness **không** kiểm tra phụ thuộc bên ngoài.

Khi bắt đầu shutdown, capstone gọi `api.StartShutdown()` → `/readyz` trả **503** → load balancer ngừng gửi request mới **trước khi** server đóng listener. Kết hợp với `Shutdown()`, deploy phiên bản mới **không làm rơi request nào**.

Cấu hình Kubernetes tương ứng (tham khảo):

```yaml
livenessProbe:
  httpGet: { path: /healthz, port: 8080 }
  periodSeconds: 10
readinessProbe:
  httpGet: { path: /readyz, port: 8080 }
  periodSeconds: 5
```

## 📖 9. Metrics với `expvar` & Profiling với `pprof`

### `expvar` - Metrics có sẵn trong thư viện chuẩn

Log cho biết **chuyện gì đã xảy ra**; metrics cho biết **hệ thống đang thế nào** (bao nhiêu request/giây, bao nhiêu lỗi, bao nhiêu goroutine...). `expvar` công khai các biến dưới dạng JSON tại `/debug/vars`:

```go
var (
	metricRequests = expvar.NewMap("http_requests_total") // Map: đếm theo "2xx", "4xx", "5xx"
	metricInFlight = expvar.NewInt("http_requests_in_flight")
)

metricInFlight.Add(1)
metricRequests.Add("2xx", 1)
```

```bash
curl -s localhost:6060/debug/vars
```

```text
{
"cmdline": ["./bookmark-api","-addr",":8080"],
"http_panics_total": 0,
"http_requests_in_flight": 0,
"http_requests_total": {"2xx": 6, "4xx": 3},
"memstats": {"Alloc":354544,"TotalAlloc":354544,"Sys":8606984,"Mallocs":2051,"HeapAlloc":354544,...}
}
```

`expvar` tự động thêm `cmdline` và `memstats` (thống kê bộ nhớ, GC). Các biến `expvar` **an toàn đồng thời** (dùng atomic bên trong).

> 💡 **Trong thực tế**, hầu hết công ty dùng **Prometheus** (`github.com/prometheus/client_golang`) + **Grafana**, hoặc **OpenTelemetry**. Chúng hỗ trợ histogram (phân bố độ trễ p50/p95/p99), label... `expvar` là bước khởi đầu tốt, không cần thư viện ngoài, và **ý tưởng hoàn toàn giống nhau**.

### `pprof` - "Máy chụp X-quang" cho chương trình

Server chậm hoặc ăn nhiều RAM? **Đừng đoán - hãy đo.** `pprof` lấy mẫu chương trình đang chạy để chỉ ra **hàm nào** tốn CPU, **dòng nào** cấp phát nhiều bộ nhớ, goroutine nào đang kẹt.

**Cách 1: Trên server đang chạy** (`net/http/pprof`)

```go
import "net/http/pprof"

mux := http.NewServeMux()
mux.HandleFunc("/debug/pprof/", pprof.Index)
mux.HandleFunc("/debug/pprof/profile", pprof.Profile)
// ... (xem đầy đủ trong capstone: hàm adminHandler)
```

> ⚠️ **Bảo mật**: pprof lộ rất nhiều thông tin nội bộ và có thể làm chậm server. **Luôn** chạy trên **cổng riêng**, chỉ nghe `127.0.0.1` (capstone mặc định `127.0.0.1:6060`). Truy cập từ xa qua `kubectl port-forward` hoặc SSH tunnel. Tránh `import _ "net/http/pprof"` rồi dùng `http.DefaultServeMux` cho API chính - pprof sẽ bị lộ ra Internet.

```bash
# CPU: lấy mẫu 30 giây rồi mở giao diện tương tác
go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30

# Bộ nhớ đang dùng (heap)
go tool pprof http://localhost:6060/debug/pprof/heap

# Xem tất cả goroutine (tìm leak - Bài 14)
curl "http://localhost:6060/debug/pprof/goroutine?debug=1"

# Mở giao diện web với flame graph (cần Graphviz cho một số chế độ xem)
go tool pprof -http=:8081 cpu.out
```

**Cách 2: Từ benchmark** - xem mục tiếp theo.

Trong giao diện tương tác của `pprof`, các lệnh hay dùng:

| Lệnh | Ý nghĩa |
|------|---------|
| `top` | Các hàm tốn tài nguyên nhất |
| `top -cum` | Sắp theo tổng tích lũy (tính cả hàm con) |
| `list TênHàm` | Hiển thị **từng dòng code** của hàm kèm chi phí |
| `web` | Vẽ đồ thị gọi hàm (cần Graphviz) |

- **flat**: thời gian trong **chính** hàm đó
- **cum** (cumulative): thời gian trong hàm **và mọi hàm nó gọi**

## 📖 10. Benchmark & tối ưu cấp phát bộ nhớ

**Quy trình tối ưu đúng**: ① Viết test đảm bảo đúng → ② Benchmark đo hiện trạng → ③ Profile tìm nút thắt → ④ Sửa **một** thứ → ⑤ Benchmark lại, so sánh. Lặp lại.

> 💡 *"Premature optimization is the root of all evil"* - Donald Knuth. Chỉ tối ưu khi **đo được** là chậm, và tối ưu **đúng chỗ** profile chỉ ra.

Ví dụ: nối danh sách ID thành chuỗi `"1,2,3"` - việc rất hay gặp (tạo câu SQL `IN (...)`, CSV, cache key...).

📄 **`tags.go`**

```go
package tags

import (
	"strconv"
	"strings"
)

// Phiên bản 1: "ngây thơ" - nối chuỗi bằng +=
func JoinV1(ids []int) string {
	s := ""
	for i, id := range ids {
		if i > 0 {
			s += ","
		}
		s += strconv.Itoa(id) // Mỗi lần += tạo một string MỚI và copy toàn bộ
	}
	return s
}

// Phiên bản 2: strings.Builder
func JoinV2(ids []int) string {
	var b strings.Builder
	for i, id := range ids {
		if i > 0 {
			b.WriteByte(',')
		}
		b.WriteString(strconv.Itoa(id)) // Itoa vẫn tạo string tạm cho số >= 100
	}
	return b.String()
}

// Phiên bản 3: cấp phát trước + AppendInt ghi thẳng vào buffer, không tạo string tạm
func JoinV3(ids []int) string {
	buf := make([]byte, 0, len(ids)*8) // Ước lượng ~8 byte mỗi số
	for i, id := range ids {
		if i > 0 {
			buf = append(buf, ',')
		}
		buf = strconv.AppendInt(buf, int64(id), 10)
	}
	return string(buf)
}
```

📄 **`tags_test.go`**

```go
package tags

import "testing"

var ids = func() []int {
	s := make([]int, 1000)
	for i := range s {
		s[i] = i * 7919
	}
	return s
}()

// Test đảm bảo 3 phiên bản cho CÙNG kết quả - tối ưu mà sai thì vô nghĩa!
func TestJoinSame(t *testing.T) {
	want := JoinV1(ids)
	if got := JoinV2(ids); got != want {
		t.Fatal("JoinV2 khác JoinV1")
	}
	if got := JoinV3(ids); got != want {
		t.Fatal("JoinV3 khác JoinV1")
	}
}

var sink string

func BenchmarkJoinV1(b *testing.B) {
	b.ReportAllocs()
	for b.Loop() { // Go 1.24+: thay cho for i := 0; i < b.N; i++
		sink = JoinV1(ids)
	}
}

func BenchmarkJoinV2(b *testing.B) {
	b.ReportAllocs()
	for b.Loop() {
		sink = JoinV2(ids)
	}
}

func BenchmarkJoinV3(b *testing.B) {
	b.ReportAllocs()
	for b.Loop() {
		sink = JoinV3(ids)
	}
}
```

```bash
go test -bench . -benchmem
```

```text
BenchmarkJoinV1-4   	     440	   2758320 ns/op	 8267574 B/op	    2997 allocs/op
BenchmarkJoinV2-4   	   33078	     36114 ns/op	   42256 B/op	    1014 allocs/op
BenchmarkJoinV3-4   	   72129	     16929 ns/op	   16384 B/op	       2 allocs/op
PASS
```

| Phiên bản | Thời gian | Bộ nhớ | Số lần cấp phát | So với V1 |
|-----------|-----------|--------|-----------------|-----------|
| V1 (`+=`) | 2.76 ms | 8.2 MB | 2997 | 1× |
| V2 (`Builder`) | 36 µs | 42 KB | 1014 | **~76× nhanh hơn** |
| V3 (`AppendInt` + cấp phát trước) | 17 µs | 16 KB | **2** | **~163× nhanh hơn** |

**Tại sao V1 chậm khủng khiếp?** Mỗi lần `+=` tạo string mới và **copy toàn bộ** chuỗi cũ → độ phức tạp O(n²). Với 1000 số, tổng số byte bị copy lên tới ~8MB cho một chuỗi kết quả chỉ ~8KB!

### Dùng profile để tìm nguyên nhân

```bash
go test -run '^$' -bench JoinV1 -cpuprofile cpu.out -memprofile mem.out
go tool pprof -top cpu.out
```

```text
      flat  flat%   sum%        cum   cum%
     420ms 19.27% 19.27%      420ms 19.27%  runtime.memmove
     220ms 10.09% 29.36%      220ms 10.09%  runtime.futex
     220ms 10.09% 39.45%      220ms 10.09%  runtime.madvise
      90ms  4.13% 43.58%      240ms 11.01%  runtime.scanobject
...
```

`runtime.memmove` (copy bộ nhớ) và `runtime.scanobject` (GC quét bộ nhớ) đứng đầu - không phải logic của bạn, mà là **chi phí của việc cấp phát và copy**. Profile bộ nhớ xác nhận:

```bash
go tool pprof -sample_index=alloc_space -top mem.out
```

```text
      flat  flat%   sum%        cum   cum%
    2.73GB 99.74% 99.74%     2.73GB 99.81%  example.JoinV1
```

(`-run '^$'` nghĩa là "không chạy test nào, chỉ chạy benchmark".)

### Escape analysis - Stack hay Heap?

Biến trên **stack** gần như miễn phí (tự giải phóng khi hàm return). Biến trên **heap** phải cấp phát và được GC dọn. Compiler quyết định qua **escape analysis** (phân tích "thoát"): nếu một giá trị có thể được dùng **sau khi hàm return** (ví dụ trả về con trỏ), nó "thoát" lên heap.

```go
func newUserPtr(name string) *User {
	u := User{Name: name} // Trả con trỏ ra ngoài hàm → u phải sống trên HEAP
	return &u
}

func newUserVal(name string) User {
	u := User{Name: name} // Trả giá trị → u nằm trên STACK (rẻ, không cần GC)
	return u
}
```

```bash
go build -gcflags=-m .
```

```text
./main.go:6:2: moved to heap: u
```

### Các kỹ thuật giảm cấp phát hay dùng

| Kỹ thuật | Ví dụ |
|----------|-------|
| Cấp phát trước slice/map khi biết kích thước | `make([]T, 0, n)`, `make(map[K]V, n)` |
| `strings.Builder` + `Grow`, `strconv.AppendInt` | Thay cho `+=`, `fmt.Sprintf` trong vòng lặp |
| Tái sử dụng buffer | `sync.Pool` ([Bài 14](./14-advanced-concurrency.md)), `buf = buf[:0]` |
| Trả giá trị thay vì con trỏ với struct nhỏ | Giữ trên stack |
| Tránh chuyển `[]byte` ↔ `string` thừa | Nhiều hàm có bản cho cả hai: `bytes.Contains`, `strings.Contains` |
| Tránh `any`/interface trong đường nóng | Gán giá trị vào interface thường gây cấp phát |

> ⚠️ Code tối ưu thường **khó đọc hơn**. V2 (`strings.Builder`) đã nhanh hơn 76 lần và vẫn rất dễ đọc - trong hầu hết trường hợp, dừng ở đó là đủ. Chỉ đi tới V3 khi profile production cho thấy hàm này **thực sự** là nút thắt.

## 📖 11. Build: version, cross-compile

### Nhúng version vào binary với `-ldflags`

Khi có sự cố, câu hỏi đầu tiên luôn là: **"Server đang chạy phiên bản nào?"**

```go
package main

import (
	"fmt"
	"runtime"
	"runtime/debug"
)

// Các biến này được GHI ĐÈ lúc build bằng: -ldflags "-X main.version=... -X main.commit=..."
// Chỉ hoạt động với biến string cấp package (không phải const).
var (
	version = "dev"
	commit  = "none"
)

func main() {
	fmt.Printf("version=%s commit=%s go=%s os/arch=%s/%s\n",
		version, commit, runtime.Version(), runtime.GOOS, runtime.GOARCH)

	// Go cũng tự nhúng thông tin build (module, dependency, commit git nếu build trong repo git)
	if info, ok := debug.ReadBuildInfo(); ok {
		fmt.Println("module:", info.Main.Path)
		for _, s := range info.Settings {
			if s.Key == "vcs.revision" || s.Key == "CGO_ENABLED" || s.Key == "GOOS" {
				fmt.Printf("  %s=%s\n", s.Key, s.Value)
			}
		}
	}
}

// Output (go run .):
// version=dev commit=none go=go1.24.7 os/arch=linux/amd64
// module: example
//   CGO_ENABLED=1
//   GOOS=linux
```

```bash
CGO_ENABLED=0 go build -trimpath -ldflags "-s -w -X main.version=1.2.3 -X main.commit=a1b2c3d" -o app .
./app
```

```text
version=1.2.3 commit=a1b2c3d go=go1.24.7 os/arch=linux/amd64
module: example
  CGO_ENABLED=0
  GOOS=linux
```

| Cờ | Ý nghĩa |
|----|---------|
| `-X main.version=1.2.3` | Gán giá trị cho biến **string** cấp package lúc link |
| `-s -w` | Bỏ bảng symbol và thông tin debug → binary **nhỏ hơn ~35%** (2.3MB → 1.5MB trong ví dụ) |
| `-trimpath` | Bỏ đường dẫn thư mục trên máy build khỏi binary (build **tái lập được**, không lộ `/home/ten-ban/...`) |
| `CGO_ENABLED=0` | Không dùng cgo → binary **tĩnh hoàn toàn**, chạy được trên image `scratch`/`distroless` |

> 💡 Khi build trong repo Git, `debug.ReadBuildInfo()` tự có `vcs.revision` (commit hash) và `vcs.modified` - đôi khi không cần `-X main.commit` nữa.

### Cross-compile - Build cho mọi hệ điều hành từ một máy

Một trong những "siêu năng lực" của Go: chỉ cần đặt 2 biến môi trường, **không cần cài thêm gì**:

```bash
GOOS=linux   GOARCH=amd64 go build -o bin/app-linux-amd64 .
GOOS=linux   GOARCH=arm64 go build -o bin/app-linux-arm64 .   # AWS Graviton, Raspberry Pi 4
GOOS=darwin  GOARCH=arm64 go build -o bin/app-macos-arm64 .   # Mac chip M
GOOS=windows GOARCH=amd64 go build -o bin/app.exe .

go tool dist list   # Xem tất cả tổ hợp được hỗ trợ (hơn 40)
```

> ⚠️ Cross-compile "dễ như ăn kẹo" **chỉ khi `CGO_ENABLED=0`**. Nếu dùng thư viện cần cgo (ví dụ `github.com/mattn/go-sqlite3`), bạn cần trình biên dịch C cho nền tảng đích. Đó là lý do capstone chọn `modernc.org/sqlite` - SQLite được **dịch sang Go thuần**.

## 📖 12. Dockerfile multi-stage

**Vấn đề**: Image `golang:1.24` nặng **~800MB** (compiler, công cụ, thư viện). Để **chạy** binary Go, bạn chỉ cần... chính binary đó.

**Giải pháp - Multi-stage build**: Giai đoạn 1 dùng image lớn để **build**; giai đoạn 2 chỉ **copy binary** sang image siêu nhỏ.

> 💡 **Ví von**: Xây nhà cần cần cẩu, giàn giáo, máy trộn bê tông (giai đoạn build). Khi **bàn giao**, bạn chỉ giao **căn nhà** - không ai giao kèm cần cẩu.

| Image nền | Kích thước | Có gì | Dùng khi |
|-----------|-----------|-------|----------|
| `golang:1.24` | ~800 MB | Mọi thứ | Chỉ để build |
| `alpine` | ~8 MB | Shell, package manager | Cần shell để debug, cần cài thêm gói |
| `gcr.io/distroless/static-debian12` | ~2 MB | CA certificates, tzdata, user `nonroot` | ✅ **Khuyên dùng** cho Go |
| `scratch` | 0 MB | **Không có gì** | Tối giản tuyệt đối (phải tự copy CA cert nếu gọi HTTPS, tự nhúng tzdata) |

Dockerfile của capstone (giải thích chi tiết ở mục 16):

```dockerfile
# syntax=docker/dockerfile:1

# ============ Giai đoạn 1: build ============
FROM golang:1.24-alpine AS build
WORKDIR /src

# Copy go.mod/go.sum TRƯỚC và tải dependency → Docker cache lại bước này,
# lần build sau chỉ sửa code thì không phải tải lại module
COPY go.mod go.sum ./
RUN go mod download

COPY . .
ARG VERSION=dev
# CGO_ENABLED=0: binary tĩnh hoàn toàn (modernc.org/sqlite là thuần Go nên không cần cgo)
RUN CGO_ENABLED=0 GOOS=linux go build \
      -trimpath \
      -ldflags="-s -w -X main.version=${VERSION}" \
      -o /out/bookmark-api ./cmd/bookmark-api \
 && mkdir -p /out/data

# ============ Giai đoạn 2: image chạy ============
# distroless/static: chỉ có CA certificates, tzdata, /etc/passwd - không shell, không package manager
FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=build /out/bookmark-api /bookmark-api
# Thư mục dữ liệu thuộc về user nonroot (UID 65532) để SQLite ghi được
COPY --from=build --chown=65532:65532 /out/data /data

ENV BOOKMARK_ADDR=:8080 \
    BOOKMARK_DB_PATH=/data/bookmarks.db \
    BOOKMARK_LOG_FORMAT=json

USER nonroot:nonroot
EXPOSE 8080
VOLUME ["/data"]
ENTRYPOINT ["/bookmark-api"]
```

```bash
docker build --build-arg VERSION=1.0.0 -t bookmark-api:1.0.0 .
docker run -p 8080:8080 -v bookmark-data:/data bookmark-api:1.0.0
docker images bookmark-api   # ~13 MB: binary ~10.6 MB + distroless ~2 MB
```

**Các điểm quan trọng**:
- **Thứ tự `COPY` tận dụng cache**: `go.mod`/`go.sum` thay đổi ít → bước `go mod download` được cache. Sửa code chỉ build lại từ `COPY . .`
- **Chạy bằng user không phải root** (`nonroot`, UID 65532): nếu kẻ tấn công chiếm được tiến trình, chúng không có quyền root trong container
- **`.dockerignore`** loại bỏ `.git`, file DB, binary cũ... khỏi "build context" → build nhanh hơn, không lỡ đưa dữ liệu nhạy cảm vào image
- Muốn dùng `scratch` thay distroless: thêm `COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/` (nếu gọi HTTPS ra ngoài) và `import _ "time/tzdata"` (nếu dùng múi giờ), đồng thời tự tạo user không phải root

## 📖 13. CI với GitHub Actions

**CI (Continuous Integration)**: mỗi lần push hoặc mở Pull Request, một máy chủ tự động **build + kiểm tra** code. Lỗi bị chặn **trước khi** vào nhánh chính.

📄 **`.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-go@v5
        with:
          go-version-file: go.mod # Dùng đúng phiên bản Go khai báo trong go.mod

      - name: Kiểm tra go.mod/go.sum gọn gàng
        run: |
          go mod tidy
          git diff --exit-code go.mod go.sum

      - name: Kiểm tra format
        run: test -z "$(gofmt -l .)"

      - name: go vet
        run: go vet ./...

      - name: Test (race detector + coverage)
        run: go test -race -coverprofile=coverage.out ./...

      - name: golangci-lint
        uses: golangci/golangci-lint-action@v8
        with:
          version: latest

      - name: Quét lỗ hổng bảo mật trong dependency
        run: go run golang.org/x/vuln/cmd/govulncheck@latest ./...

  docker:
    needs: test # Chỉ build image khi test đã qua
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build image
        run: docker build --build-arg VERSION=${{ github.sha }} -t bookmark-api:${{ github.sha }} .
```

| Bước | Bắt được gì |
|------|-------------|
| `go mod tidy` + `git diff` | Quên cập nhật `go.mod`/`go.sum` |
| `gofmt -l` | Code chưa format |
| `go vet` | Lỗi "khả nghi": `Printf` sai định dạng, copy mutex, `cancel` bị bỏ quên... |
| `go test -race` | Test fail, **data race** ([Bài 8](./08-concurrency.md)) |
| `golangci-lint` | Hàng chục linter: lỗi không kiểm tra, bảo mật, code thừa... |
| `govulncheck` | Dependency (hoặc bản Go) có **lỗ hổng bảo mật đã biết** mà code của bạn **thực sự gọi tới** |

### Cấu hình `golangci-lint`

📄 **`.golangci.yml`**

```yaml
version: "2"

linters:
  # "standard" = errcheck, govet, ineffassign, staticcheck, unused
  enable:
    - bodyclose     # Quên resp.Body.Close()
    - errorlint     # So sánh lỗi bằng == thay vì errors.Is
    - gosec         # Lỗ hổng bảo mật phổ biến
    - noctx         # Gửi HTTP request không có context
    - revive        # Quy ước đặt tên, comment
  settings:
    revive:
      rules:
        - name: exported
          disabled: true # Bài học không bắt buộc comment cho mọi hàm exported

  exclusions:
    presets:
      - std-error-handling # Bỏ qua lỗi không kiểm tra của Close(), fmt.Fprint... (quy ước phổ biến)
    rules:
      - path: _test\.go   # Test được phép "dễ dãi" hơn
        linters: [bodyclose, noctx, gosec, errcheck]

formatters:
  enable:
    - gofmt
    - goimports
```

```bash
golangci-lint run ./...
# 0 issues.
```

> 💡 Khi viết capstone, `golangci-lint` đã bắt được thật: 2 chỗ `db.Close()` bỏ qua lỗi (gosec G104 - sửa thành `_ = db.Close()` để thể hiện **cố ý** bỏ qua) và 1 chỗ so sánh `v == http.ErrAbortHandler` (errorlint - trường hợp này đúng là cần so sánh `==` vì đó là **giá trị panic**, nên dùng `//nolint:errorlint` kèm **lý do**). Luôn ghi lý do khi dùng `//nolint`.

## 📖 14. Makefile - Gom các lệnh hay dùng

Thay vì nhớ `CGO_ENABLED=0 go build -trimpath -ldflags "-s -w -X main.version=..." -o bin/... ./cmd/...`, cả team chỉ cần `make build`.

📄 **`Makefile`** (⚠️ các dòng lệnh phải thụt vào bằng **Tab**, không phải dấu cách)

```makefile
# Biến có thể ghi đè: make build VERSION=1.2.3
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)
BINARY  := bin/bookmark-api
LDFLAGS := -s -w -X main.version=$(VERSION)

.PHONY: help run build test cover lint vet fmt tidy docker clean

help: ## Liệt kê các lệnh
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-8s %s\n", $$1, $$2}'

run: ## Chạy server ở chế độ dev (log dạng text, level debug)
	BOOKMARK_LOG_FORMAT=text BOOKMARK_LOG_LEVEL=debug go run ./cmd/bookmark-api

build: ## Build binary tĩnh kèm version
	CGO_ENABLED=0 go build -trimpath -ldflags "$(LDFLAGS)" -o $(BINARY) ./cmd/bookmark-api

test: ## Chạy test với race detector
	go test -race -count=1 ./...

cover: ## Báo cáo coverage dạng HTML
	go test -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out

lint: ## Chạy golangci-lint
	golangci-lint run ./...

vet: ## Chạy go vet
	go vet ./...

fmt: ## Format code
	gofmt -w .

tidy: ## Dọn go.mod/go.sum
	go mod tidy

docker: ## Build Docker image
	docker build --build-arg VERSION=$(VERSION) -t bookmark-api:$(VERSION) .

clean: ## Xóa file build
	rm -rf bin coverage.out
```

```bash
make help
```

```text
  help     Liệt kê các lệnh
  run      Chạy server ở chế độ dev (log dạng text, level debug)
  build    Build binary tĩnh kèm version
  test     Chạy test với race detector
  cover    Báo cáo coverage dạng HTML
  lint     Chạy golangci-lint
  vet      Chạy go vet
  fmt      Format code
  tidy     Dọn go.mod/go.sum
  docker   Build Docker image
  clean    Xóa file build
```

> 💡 Trên Windows, `make` không có sẵn - có thể cài qua `choco install make`, dùng WSL, hoặc thay bằng công cụ đa nền tảng như [Task](https://taskfile.dev) (`Taskfile.yml`).

## 📖 15. Bảo mật cơ bản

| Nguyên tắc | Cách làm trong Go | Capstone |
|------------|-------------------|----------|
| **Không hardcode secret** | Đọc từ biến môi trường / secret manager (Vault, AWS Secrets Manager, Kubernetes Secret). Không commit file `.env` | ✅ Config từ env |
| **Không log secret** | Không log mật khẩu, token, header `Authorization`. Có thể dùng `slog.LogValuer` để che giá trị | ✅ |
| **Validate mọi input** | Kiểm tra kiểu, độ dài, định dạng; **whitelist** hơn blacklist | ✅ `normalize()` |
| **Giới hạn kích thước** | `http.MaxBytesReader`, `io.LimitReader`, `LIMIT` trong SQL | ✅ 1MB body, limit ≤ 100 |
| **Chống SQL injection** | **Luôn** dùng tham số `?` / `$1`, **không bao giờ** `fmt.Sprintf` giá trị vào câu SQL | ✅ |
| **Chống XSS** | `html/template` ([Bài 15](./15-generics-reflection-stdlib.md)) | (API JSON) |
| **Timeout mọi nơi** | `http.Server` timeouts, `http.Client{Timeout}`, `context.WithTimeout` cho DB | ✅ |
| **Số ngẫu nhiên an toàn** | `crypto/rand` cho token, ID phiên; **không** dùng `math/rand` | ✅ request ID |
| **Băm mật khẩu** | `golang.org/x/crypto/bcrypt` hoặc `argon2`; **không** dùng MD5/SHA-256 thuần | (chưa có user) |
| **So sánh secret** | `crypto/subtle.ConstantTimeCompare` chống tấn công đo thời gian | - |
| **Giới hạn tốc độ** | `rate.Limiter` theo IP ([Bài 14](./14-advanced-concurrency.md)) | Bài tập |
| **Cập nhật dependency** | `govulncheck`, Dependabot/Renovate | ✅ CI |
| **Container tối thiểu, không root** | distroless + `USER nonroot` | ✅ |
| **Lỗi không lộ nội bộ** | 500 chỉ trả thông báo chung + request ID | ✅ |
| **Cổng quản trị riêng** | pprof/expvar chỉ nghe `127.0.0.1` | ✅ |

```go
// ❌ SQL injection: tag = "x' OR '1'='1" → trả về TOÀN BỘ bảng (hoặc tệ hơn: DROP TABLE)
query := fmt.Sprintf("SELECT * FROM bookmarks WHERE tags LIKE '%%%s%%'", tag)

// ✅ Tham số hóa: driver tự xử lý, dữ liệu KHÔNG BAO GIỜ bị hiểu là câu lệnh SQL
db.QueryContext(ctx, "SELECT * FROM bookmarks WHERE tags LIKE ?", "%,"+tag+",%")
```

```bash
# Quét lỗ hổng trong dependency và bản Go đang dùng
go install golang.org/x/vuln/cmd/govulncheck@latest
govulncheck ./...
```

## 📖 16. Capstone: Bookmark API ⭐

Đây là lúc ghép **mọi thứ** lại. Chúng ta xây dựng một REST API lưu trữ bookmark (đường link yêu thích) - nhỏ, nhưng có **đầy đủ** những gì một service production cần.

### Tổng quan

| Method | Đường dẫn | Chức năng | Status |
|--------|-----------|-----------|--------|
| `GET` | `/healthz` | Liveness | 200 |
| `GET` | `/readyz` | Readiness (ping DB, đang shutdown?) | 200 / 503 |
| `POST` | `/v1/bookmarks` | Tạo bookmark | 201 / 400 / 409 / 413 |
| `GET` | `/v1/bookmarks?tag=go&limit=20&offset=0` | Liệt kê, lọc theo tag, phân trang | 200 |
| `GET` | `/v1/bookmarks/{id}` | Lấy một bookmark | 200 / 400 / 404 |
| `DELETE` | `/v1/bookmarks/{id}` | Xóa | 204 / 404 |
| `GET` | `:6060/debug/vars`, `:6060/debug/pprof/` | Metrics, profiling (cổng admin) | 200 |

**Kiến thức sử dụng**:

| Kiến thức | Ở đâu | Bài |
|-----------|-------|-----|
| `cmd/` + `internal/`, chia package theo nghiệp vụ | Toàn bộ | 9, 16 |
| Config 12-factor, `errors.Join` | `internal/config` | 7, 16 |
| Interface nhỏ, DI thủ công | `bookmark.Repository`, `httpapi.Pinger`, `main.go` | 6, 16 |
| Functional options | `httpapi.New(..., WithLogger(...))` | 16 |
| Sentinel error, kiểu lỗi riêng, `%w`, `errors.Is/As` | `bookmark`, `sqlite`, `writeError` | 7 |
| `database/sql`, câu lệnh tham số hóa | `internal/storage/sqlite` | 13 |
| `net/http`, routing Go 1.22, JSON | `internal/httpapi` | 10, 12 |
| Middleware, embedding, `context.WithValue` | `middleware.go` | 6, 10 |
| `slog` JSON, `expvar`, `pprof` | `main.go`, `middleware.go` | 15, 16 |
| `signal.NotifyContext`, `Shutdown`, `atomic.Bool` | `main.go`, `server.go` | 8, 14, 16 |
| Table-driven test, `httptest`, `t.TempDir`, `t.Cleanup` | `*_test.go` | 9, 10 |

### Bước 1: Khởi tạo

```bash
mkdir bookmark-api && cd bookmark-api
go mod init bookmark-api
mkdir -p cmd/bookmark-api internal/{config,bookmark,storage/sqlite,httpapi}
go get modernc.org/sqlite@v1.46.1
```

> 💡 **Tại sao `modernc.org/sqlite`?** Đây là SQLite được **dịch tự động sang Go thuần** - không cần cgo, không cần cài trình biên dịch C, cross-compile và build Docker `CGO_ENABLED=0` dễ dàng. Nhược điểm: chậm hơn bản C (`mattn/go-sqlite3`) một chút - không đáng kể với hầu hết ứng dụng. Phiên bản `v1.46.1` là bản mới nhất còn hỗ trợ Go 1.24; nếu bạn dùng Go mới hơn, có thể dùng `@latest`.

File `go.mod` sau khi chạy `go get` và `go mod tidy` (rút gọn phần `indirect`):

```text
module bookmark-api

go 1.24.0

require modernc.org/sqlite v1.46.1

require (
	github.com/dustin/go-humanize v1.0.1 // indirect
	...
	modernc.org/libc v1.67.6 // indirect
)
```

### Bước 2: Config

📄 **`internal/config/config.go`**

```go
// Package config đọc cấu hình theo 12-factor: mặc định < biến môi trường < cờ dòng lệnh.
package config

import (
	"cmp"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"strconv"
	"time"
)

// Config chứa TOÀN BỘ cấu hình của service - một chỗ duy nhất để tra cứu.
type Config struct {
	Addr            string        // Địa chỉ HTTP API, ví dụ ":8080"
	AdminAddr       string        // Địa chỉ pprof/expvar; rỗng = tắt
	DBPath          string        // Đường dẫn file SQLite
	LogLevel        slog.Level    // debug | info | warn | error
	LogFormat       string        // json | text
	ShutdownTimeout time.Duration // Thời gian tối đa chờ request đang chạy khi tắt
	MaxBodyBytes    int64         // Giới hạn kích thước body của request
}

// Load nhận args và getenv làm THAM SỐ (thay vì gọi thẳng os.Args, os.Getenv)
// → test được mà không phải sửa biến môi trường thật của máy.
func Load(args []string, getenv func(string) string) (Config, error) {
	env := func(key, def string) string { return cmp.Or(getenv(key), def) }

	fs := flag.NewFlagSet("bookmark-api", flag.ContinueOnError)
	addr := fs.String("addr", env("BOOKMARK_ADDR", ":8080"), "địa chỉ HTTP API")
	adminAddr := fs.String("admin-addr", env("BOOKMARK_ADMIN_ADDR", "127.0.0.1:6060"), "địa chỉ admin (pprof, expvar); rỗng để tắt")
	dbPath := fs.String("db", env("BOOKMARK_DB_PATH", "bookmarks.db"), "đường dẫn file SQLite")
	logLevel := fs.String("log-level", env("BOOKMARK_LOG_LEVEL", "info"), "debug|info|warn|error")
	logFormat := fs.String("log-format", env("BOOKMARK_LOG_FORMAT", "json"), "json|text")
	shutdown := fs.String("shutdown-timeout", env("BOOKMARK_SHUTDOWN_TIMEOUT", "15s"), "thời gian chờ khi tắt")
	maxBody := fs.String("max-body-bytes", env("BOOKMARK_MAX_BODY_BYTES", "1048576"), "giới hạn body (byte)")
	if err := fs.Parse(args); err != nil {
		return Config{}, err
	}

	cfg := Config{Addr: *addr, AdminAddr: *adminAddr, DBPath: *dbPath, LogFormat: *logFormat}
	var errs []error // Gom MỌI lỗi cấu hình → sửa một lần là xong

	if err := cfg.LogLevel.UnmarshalText([]byte(*logLevel)); err != nil {
		errs = append(errs, fmt.Errorf("log-level %q không hợp lệ", *logLevel))
	}
	if cfg.LogFormat != "json" && cfg.LogFormat != "text" {
		errs = append(errs, fmt.Errorf("log-format phải là json hoặc text, nhận %q", cfg.LogFormat))
	}
	d, err := time.ParseDuration(*shutdown)
	if err != nil || d <= 0 {
		errs = append(errs, fmt.Errorf("shutdown-timeout %q không hợp lệ", *shutdown))
	}
	cfg.ShutdownTimeout = d
	n, err := strconv.ParseInt(*maxBody, 10, 64)
	if err != nil || n <= 0 {
		errs = append(errs, fmt.Errorf("max-body-bytes %q không hợp lệ", *maxBody))
	}
	cfg.MaxBodyBytes = n
	if cfg.Addr == "" {
		errs = append(errs, errors.New("addr không được rỗng"))
	}
	if cfg.DBPath == "" {
		errs = append(errs, errors.New("db không được rỗng"))
	}

	return cfg, errors.Join(errs...) // nil nếu không có lỗi nào
}
```

📄 **`internal/config/config_test.go`**

```go
package config

import (
	"log/slog"
	"strings"
	"testing"
	"time"
)

// fakeEnv biến một map thành hàm getenv
func fakeEnv(m map[string]string) func(string) string {
	return func(k string) string { return m[k] }
}

func TestLoad_Defaults(t *testing.T) {
	cfg, err := Load(nil, fakeEnv(nil))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Addr != ":8080" || cfg.LogLevel != slog.LevelInfo || cfg.ShutdownTimeout != 15*time.Second {
		t.Fatalf("mặc định sai: %+v", cfg)
	}
}

func TestLoad_Precedence(t *testing.T) {
	env := fakeEnv(map[string]string{"BOOKMARK_ADDR": ":9000", "BOOKMARK_LOG_LEVEL": "debug"})
	cfg, err := Load([]string{"-addr", ":7000"}, env)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Addr != ":7000" { // Cờ thắng biến môi trường
		t.Errorf("Addr = %q; muốn :7000", cfg.Addr)
	}
	if cfg.LogLevel != slog.LevelDebug { // Biến môi trường thắng mặc định
		t.Errorf("LogLevel = %v; muốn DEBUG", cfg.LogLevel)
	}
}

func TestLoad_InvalidReportsAllErrors(t *testing.T) {
	env := fakeEnv(map[string]string{"BOOKMARK_LOG_FORMAT": "xml", "BOOKMARK_SHUTDOWN_TIMEOUT": "soon"})
	_, err := Load(nil, env)
	if err == nil {
		t.Fatal("muốn lỗi, nhận nil")
	}
	for _, want := range []string{"log-format", "shutdown-timeout"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("lỗi %q thiếu %q", err, want)
		}
	}
}
```

**Điểm nhấn**: `flag.NewFlagSet(..., flag.ContinueOnError)` thay vì `flag.Parse()` toàn cục → `Load` trả lỗi thay vì tự `os.Exit`, và có thể gọi nhiều lần trong test. `slog.Level` có sẵn `UnmarshalText` hiểu `"debug"`, `"INFO"`, `"warn"`...

### Bước 3: Nghiệp vụ - package `bookmark`

📄 **`internal/bookmark/bookmark.go`**

```go
// Package bookmark chứa nghiệp vụ (domain): model, quy tắc hợp lệ, lỗi và Service.
// Package này KHÔNG biết gì về HTTP hay SQLite.
package bookmark

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"net/url"
	"regexp"
	"slices"
	"strings"
	"time"
	"unicode/utf8"
)

// Bookmark là một đường link được lưu lại.
type Bookmark struct {
	ID        int64     `json:"id"`
	URL       string    `json:"url"`
	Title     string    `json:"title"`
	Tags      []string  `json:"tags"`
	CreatedAt time.Time `json:"created_at"`
}

// Lỗi nghiệp vụ (sentinel error) - tầng HTTP dùng errors.Is để chọn status code.
var (
	ErrNotFound     = errors.New("bookmark không tồn tại")
	ErrDuplicateURL = errors.New("URL này đã được lưu")
)

// ValidationError chứa lỗi của từng field.
type ValidationError struct {
	Fields map[string]string
}

func (e *ValidationError) Error() string {
	var parts []string
	for _, k := range slices.Sorted(maps.Keys(e.Fields)) {
		parts = append(parts, k+": "+e.Fields[k])
	}
	return "dữ liệu không hợp lệ: " + strings.Join(parts, "; ")
}

// NewBookmark là dữ liệu đầu vào khi tạo bookmark.
type NewBookmark struct {
	URL   string   `json:"url"`
	Title string   `json:"title"`
	Tags  []string `json:"tags"`
}

const (
	maxTitleLen = 200
	maxTags     = 5
)

var tagRe = regexp.MustCompile(`^[a-z0-9-]{1,30}$`)

// normalize làm sạch và kiểm tra dữ liệu; trả về bản đã chuẩn hóa.
func (in NewBookmark) normalize() (NewBookmark, error) {
	errs := map[string]string{}

	in.URL = strings.TrimSpace(in.URL)
	if u, err := url.ParseRequestURI(in.URL); err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		errs["url"] = "phải là URL http(s) đầy đủ"
	}

	in.Title = strings.TrimSpace(in.Title)
	switch n := utf8.RuneCountInString(in.Title); {
	case n == 0:
		errs["title"] = "không được để trống"
	case n > maxTitleLen:
		errs["title"] = fmt.Sprintf("tối đa %d ký tự", maxTitleLen)
	}

	// Tag: chữ thường, bỏ trùng, sắp xếp → "Go", "go ", "GO" là một tag
	tags := make([]string, 0, len(in.Tags))
	for _, t := range in.Tags {
		t = strings.ToLower(strings.TrimSpace(t))
		if !tagRe.MatchString(t) {
			errs["tags"] = "tag chỉ gồm a-z, 0-9, dấu '-' (1-30 ký tự)"
			break
		}
		tags = append(tags, t)
	}
	slices.Sort(tags)
	in.Tags = slices.Compact(tags)
	if len(in.Tags) > maxTags {
		errs["tags"] = fmt.Sprintf("tối đa %d tag", maxTags)
	}

	if len(errs) > 0 {
		return in, &ValidationError{Fields: errs}
	}
	return in, nil
}

// ListFilter là điều kiện lọc và phân trang.
type ListFilter struct {
	Tag    string
	Limit  int
	Offset int
}

// Repository là thứ Service CẦN từ tầng lưu trữ.
// Interface được khai báo ở phía NGƯỜI DÙNG (package này), không phải phía cài đặt (sqlite).
type Repository interface {
	Create(ctx context.Context, b *Bookmark) error // Gán b.ID sau khi lưu
	Get(ctx context.Context, id int64) (Bookmark, error)
	List(ctx context.Context, f ListFilter) ([]Bookmark, error)
	Delete(ctx context.Context, id int64) error
}

// Service chứa logic nghiệp vụ. Mọi phụ thuộc được "tiêm" (inject) qua constructor.
type Service struct {
	repo Repository
	now  func() time.Time // Tiêm đồng hồ → test được thời gian
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo, now: time.Now}
}

func (s *Service) Create(ctx context.Context, in NewBookmark) (Bookmark, error) {
	in, err := in.normalize()
	if err != nil {
		return Bookmark{}, err
	}
	b := Bookmark{URL: in.URL, Title: in.Title, Tags: in.Tags, CreatedAt: s.now().UTC().Truncate(time.Millisecond)}
	if err := s.repo.Create(ctx, &b); err != nil {
		return Bookmark{}, fmt.Errorf("tạo bookmark: %w", err) // Bọc thêm ngữ cảnh, GIỮ lỗi gốc
	}
	return b, nil
}

func (s *Service) Get(ctx context.Context, id int64) (Bookmark, error) {
	b, err := s.repo.Get(ctx, id)
	if err != nil {
		return Bookmark{}, fmt.Errorf("lấy bookmark %d: %w", id, err)
	}
	return b, nil
}

func (s *Service) List(ctx context.Context, f ListFilter) ([]Bookmark, error) {
	f.Tag = strings.ToLower(strings.TrimSpace(f.Tag))
	if f.Limit <= 0 || f.Limit > 100 {
		f.Limit = 20 // Không bao giờ cho client lấy "tất cả" - chống quá tải
	}
	f.Offset = max(f.Offset, 0)
	list, err := s.repo.List(ctx, f)
	if err != nil {
		return nil, fmt.Errorf("liệt kê bookmark: %w", err)
	}
	return list, nil
}

func (s *Service) Delete(ctx context.Context, id int64) error {
	if err := s.repo.Delete(ctx, id); err != nil {
		return fmt.Errorf("xóa bookmark %d: %w", id, err)
	}
	return nil
}
```

📄 **`internal/bookmark/bookmark_test.go`** - test Service với repository **giả**, không cần DB

```go
package bookmark

import (
	"context"
	"errors"
	"slices"
	"testing"
	"time"
)

// fakeRepo: Repository giả trong bộ nhớ - test Service mà không cần database
type fakeRepo struct {
	items      map[int64]Bookmark
	nextID     int64
	lastFilter ListFilter
}

func newFakeRepo() *fakeRepo { return &fakeRepo{items: map[int64]Bookmark{}} }

func (r *fakeRepo) Create(_ context.Context, b *Bookmark) error {
	for _, it := range r.items {
		if it.URL == b.URL {
			return ErrDuplicateURL
		}
	}
	r.nextID++
	b.ID = r.nextID
	r.items[b.ID] = *b
	return nil
}

func (r *fakeRepo) Get(_ context.Context, id int64) (Bookmark, error) {
	b, ok := r.items[id]
	if !ok {
		return Bookmark{}, ErrNotFound
	}
	return b, nil
}

func (r *fakeRepo) List(_ context.Context, f ListFilter) ([]Bookmark, error) {
	r.lastFilter = f
	return nil, nil
}

func (r *fakeRepo) Delete(_ context.Context, id int64) error {
	if _, ok := r.items[id]; !ok {
		return ErrNotFound
	}
	delete(r.items, id)
	return nil
}

func TestService_Create(t *testing.T) {
	svc := NewService(newFakeRepo())
	fixed := time.Date(2026, 9, 25, 8, 0, 0, 0, time.UTC)
	svc.now = func() time.Time { return fixed } // Đồng hồ giả

	b, err := svc.Create(context.Background(), NewBookmark{
		URL: "  https://go.dev/doc  ", Title: " Tài liệu Go ", Tags: []string{"Go", "docs", "go "},
	})
	if err != nil {
		t.Fatal(err)
	}
	if b.ID != 1 || b.URL != "https://go.dev/doc" || b.Title != "Tài liệu Go" {
		t.Errorf("chuẩn hóa sai: %+v", b)
	}
	if !slices.Equal(b.Tags, []string{"docs", "go"}) {
		t.Errorf("Tags = %v; muốn [docs go]", b.Tags)
	}
	if !b.CreatedAt.Equal(fixed) {
		t.Errorf("CreatedAt = %v; muốn %v", b.CreatedAt, fixed)
	}

	_, err = svc.Create(context.Background(), NewBookmark{URL: "https://go.dev/doc", Title: "lần 2"})
	if !errors.Is(err, ErrDuplicateURL) { // Lỗi được bọc nhưng errors.Is vẫn nhận ra
		t.Errorf("err = %v; muốn ErrDuplicateURL", err)
	}
}

func TestService_CreateValidation(t *testing.T) {
	tests := []struct {
		name  string
		in    NewBookmark
		field string
	}{
		{"URL rỗng", NewBookmark{Title: "x"}, "url"},
		{"URL không phải http", NewBookmark{URL: "ftp://a.com", Title: "x"}, "url"},
		{"thiếu title", NewBookmark{URL: "https://a.com"}, "title"},
		{"tag có dấu cách", NewBookmark{URL: "https://a.com", Title: "x", Tags: []string{"lập trình"}}, "tags"},
		{"quá nhiều tag", NewBookmark{URL: "https://a.com", Title: "x", Tags: []string{"a", "b", "c", "d", "e", "f"}}, "tags"},
	}
	svc := NewService(newFakeRepo())
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, err := svc.Create(context.Background(), tc.in)
			var ve *ValidationError
			if !errors.As(err, &ve) {
				t.Fatalf("err = %v; muốn *ValidationError", err)
			}
			if _, ok := ve.Fields[tc.field]; !ok {
				t.Errorf("thiếu lỗi cho field %q: %v", tc.field, ve.Fields)
			}
		})
	}
}

func TestService_ListClampsLimit(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	_, _ = svc.List(context.Background(), ListFilter{Tag: " GO ", Limit: 10_000, Offset: -5})
	want := ListFilter{Tag: "go", Limit: 20, Offset: 0}
	if repo.lastFilter != want {
		t.Errorf("filter = %+v; muốn %+v", repo.lastFilter, want)
	}
}
```

**Điểm nhấn**:
- **Chuẩn hóa trước khi kiểm tra**: `" https://go.dev/doc "` → cắt khoảng trắng; tag `"Go"`, `"go "` → `"go"`, bỏ trùng, sắp xếp. Dữ liệu trong DB luôn **sạch và nhất quán**
- **Tiêm đồng hồ** (`now func() time.Time`): test kiểm tra được chính xác `CreatedAt`. Đây là kỹ thuật bạn đã gặp ở Bài tập 2 của Bài 15
- **`fakeRepo` chỉ ~40 dòng** nhờ interface `Repository` nhỏ - test chạy trong vài mili giây
- Service **không log** - nó trả lỗi đã bọc ngữ cảnh, việc log là của tầng HTTP (quy tắc "log hoặc trả về")

### Bước 4: Lưu trữ - SQLite repository

📄 **`internal/storage/sqlite/sqlite.go`**

```go
// Package sqlite cài đặt bookmark.Repository bằng SQLite (driver thuần Go, không cần cgo).
package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"modernc.org/sqlite"
	sqlite3 "modernc.org/sqlite/lib"

	"bookmark-api/internal/bookmark"
)

const schema = `
CREATE TABLE IF NOT EXISTS bookmarks (
	id         INTEGER PRIMARY KEY AUTOINCREMENT,
	url        TEXT    NOT NULL UNIQUE,
	title      TEXT    NOT NULL,
	tags       TEXT    NOT NULL DEFAULT '',  -- dạng ",go,web," để lọc bằng LIKE
	created_at TEXT    NOT NULL              -- RFC 3339, luôn UTC
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at);`

// Store là Repository dùng SQLite.
type Store struct {
	db *sql.DB
}

// Open mở (hoặc tạo) database và chạy migration.
func Open(ctx context.Context, path string) (*Store, error) {
	// busy_timeout: chờ tối đa 5s khi DB đang bị khóa ghi thay vì lỗi ngay
	// journal_mode(WAL): cho phép đọc song song trong khi đang ghi
	dsn := "file:" + path + "?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=foreign_keys(ON)"
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("sqlite: mở %s: %w", path, err)
	}
	if err := db.PingContext(ctx); err != nil {
		_ = db.Close() // Đã có lỗi chính để trả về; "_ =" cho thấy ta CỐ Ý bỏ qua lỗi đóng
		return nil, fmt.Errorf("sqlite: ping: %w", err)
	}
	if _, err := db.ExecContext(ctx, schema); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("sqlite: migrate: %w", err)
	}
	return &Store{db: db}, nil
}

func (s *Store) Close() error                   { return s.db.Close() }
func (s *Store) Ping(ctx context.Context) error { return s.db.PingContext(ctx) }

func (s *Store) Create(ctx context.Context, b *bookmark.Bookmark) error {
	res, err := s.db.ExecContext(ctx,
		`INSERT INTO bookmarks (url, title, tags, created_at) VALUES (?, ?, ?, ?)`, // ? = tham số → chống SQL injection
		b.URL, b.Title, encodeTags(b.Tags), b.CreatedAt.UTC().Format(time.RFC3339Nano))
	if err != nil {
		if isUniqueViolation(err) {
			return bookmark.ErrDuplicateURL // Dịch lỗi của SQLite sang lỗi nghiệp vụ
		}
		return fmt.Errorf("sqlite: insert: %w", err)
	}
	if b.ID, err = res.LastInsertId(); err != nil {
		return fmt.Errorf("sqlite: last insert id: %w", err)
	}
	return nil
}

func (s *Store) Get(ctx context.Context, id int64) (bookmark.Bookmark, error) {
	row := s.db.QueryRowContext(ctx,
		`SELECT id, url, title, tags, created_at FROM bookmarks WHERE id = ?`, id)
	b, err := scanBookmark(row)
	if errors.Is(err, sql.ErrNoRows) {
		return bookmark.Bookmark{}, bookmark.ErrNotFound
	}
	if err != nil {
		return bookmark.Bookmark{}, fmt.Errorf("sqlite: get %d: %w", id, err)
	}
	return b, nil
}

func (s *Store) List(ctx context.Context, f bookmark.ListFilter) ([]bookmark.Bookmark, error) {
	query := `SELECT id, url, title, tags, created_at FROM bookmarks`
	var args []any
	if f.Tag != "" {
		query += ` WHERE tags LIKE ?`
		args = append(args, "%,"+f.Tag+",%")
	}
	query += ` ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`
	args = append(args, f.Limit, f.Offset)

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("sqlite: list: %w", err)
	}
	defer rows.Close()

	list := []bookmark.Bookmark{} // Slice rỗng (không nil) → JSON là [] thay vì null
	for rows.Next() {
		b, err := scanBookmark(rows)
		if err != nil {
			return nil, fmt.Errorf("sqlite: scan: %w", err)
		}
		list = append(list, b)
	}
	if err := rows.Err(); err != nil { // Lỗi xảy ra GIỮA CHỪNG khi duyệt
		return nil, fmt.Errorf("sqlite: rows: %w", err)
	}
	return list, nil
}

func (s *Store) Delete(ctx context.Context, id int64) error {
	res, err := s.db.ExecContext(ctx, `DELETE FROM bookmarks WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("sqlite: delete %d: %w", id, err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("sqlite: rows affected: %w", err)
	}
	if n == 0 {
		return bookmark.ErrNotFound
	}
	return nil
}

// scanner là điểm chung của *sql.Row và *sql.Rows → một hàm scan dùng cho cả hai
type scanner interface {
	Scan(dest ...any) error
}

func scanBookmark(sc scanner) (bookmark.Bookmark, error) {
	var (
		b                bookmark.Bookmark
		tags, createdStr string
	)
	if err := sc.Scan(&b.ID, &b.URL, &b.Title, &tags, &createdStr); err != nil {
		return b, err
	}
	created, err := time.Parse(time.RFC3339Nano, createdStr)
	if err != nil {
		return b, fmt.Errorf("created_at %q: %w", createdStr, err)
	}
	b.CreatedAt = created
	b.Tags = decodeTags(tags)
	return b, nil
}

func encodeTags(tags []string) string {
	if len(tags) == 0 {
		return ""
	}
	return "," + strings.Join(tags, ",") + ","
}

func decodeTags(s string) []string {
	s = strings.Trim(s, ",")
	if s == "" {
		return []string{}
	}
	return strings.Split(s, ",")
}

func isUniqueViolation(err error) bool {
	var se *sqlite.Error
	return errors.As(err, &se) && se.Code() == sqlite3.SQLITE_CONSTRAINT_UNIQUE
}
```

📄 **`internal/storage/sqlite/sqlite_test.go`**

```go
package sqlite

import (
	"context"
	"errors"
	"path/filepath"
	"slices"
	"testing"
	"time"

	"bookmark-api/internal/bookmark"
)

// newTestStore tạo database MỚI trong thư mục tạm cho mỗi test → các test độc lập
func newTestStore(t *testing.T) *Store {
	t.Helper()
	s, err := Open(context.Background(), filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	return s
}

func TestStore_CRUD(t *testing.T) {
	ctx := context.Background()
	s := newTestStore(t)
	created := time.Date(2026, 9, 25, 8, 30, 0, 0, time.UTC)

	b := bookmark.Bookmark{URL: "https://go.dev", Title: "Go", Tags: []string{"go", "lang"}, CreatedAt: created}
	if err := s.Create(ctx, &b); err != nil {
		t.Fatal(err)
	}
	if b.ID == 0 {
		t.Fatal("ID chưa được gán")
	}

	got, err := s.Get(ctx, b.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.URL != b.URL || !slices.Equal(got.Tags, b.Tags) || !got.CreatedAt.Equal(created) {
		t.Errorf("Get = %+v; muốn %+v", got, b)
	}

	dup := bookmark.Bookmark{URL: "https://go.dev", Title: "trùng", CreatedAt: created}
	if err := s.Create(ctx, &dup); !errors.Is(err, bookmark.ErrDuplicateURL) {
		t.Errorf("tạo trùng: err = %v; muốn ErrDuplicateURL", err)
	}

	if err := s.Delete(ctx, b.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Get(ctx, b.ID); !errors.Is(err, bookmark.ErrNotFound) {
		t.Errorf("Get sau khi xóa: err = %v; muốn ErrNotFound", err)
	}
	if err := s.Delete(ctx, b.ID); !errors.Is(err, bookmark.ErrNotFound) {
		t.Errorf("xóa 2 lần: err = %v; muốn ErrNotFound", err)
	}
}

func TestStore_ListFilterAndPaging(t *testing.T) {
	ctx := context.Background()
	s := newTestStore(t)
	base := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	for i, tags := range [][]string{{"go"}, {"rust"}, {"go", "web"}, {"golang"}} {
		b := bookmark.Bookmark{
			URL: "https://example.com/" + string(rune('a'+i)), Title: "t", Tags: tags,
			CreatedAt: base.Add(time.Duration(i) * time.Hour),
		}
		if err := s.Create(ctx, &b); err != nil {
			t.Fatal(err)
		}
	}

	// Tag "go" KHÔNG được khớp nhầm "golang" - nhờ dấu phẩy bao quanh
	list, err := s.List(ctx, bookmark.ListFilter{Tag: "go", Limit: 10})
	if err != nil {
		t.Fatal(err)
	}
	var urls []string
	for _, b := range list {
		urls = append(urls, b.URL)
	}
	want := []string{"https://example.com/c", "https://example.com/a"} // Mới nhất trước
	if !slices.Equal(urls, want) {
		t.Errorf("List(tag=go) = %v; muốn %v", urls, want)
	}

	page2, err := s.List(ctx, bookmark.ListFilter{Limit: 2, Offset: 2})
	if err != nil {
		t.Fatal(err)
	}
	if len(page2) != 2 || page2[0].URL != "https://example.com/b" {
		t.Errorf("trang 2 sai: %+v", page2)
	}
}
```

**Điểm nhấn**:
- **Migration đơn giản** bằng `CREATE TABLE IF NOT EXISTS` lúc khởi động. Dự án lớn hơn nên dùng công cụ migration có phiên bản như `golang-migrate`, `goose` (và có thể nhúng file `.sql` bằng `embed`)
- **Lưu tag dạng `",go,web,"`**: dấu phẩy hai đầu giúp `LIKE '%,go,%'` **không khớp nhầm** `golang`. (Thiết kế "chuẩn" hơn là bảng `tags` riêng + bảng nối - xem Bài tập 3)
- **Lưu thời gian dạng chuỗi RFC 3339 UTC** - SQLite không có kiểu thời gian riêng; chuỗi RFC 3339 cùng múi giờ UTC sắp xếp đúng theo thứ tự chữ cái
- **Dịch lỗi**: `sql.ErrNoRows` → `bookmark.ErrNotFound`; mã `SQLITE_CONSTRAINT_UNIQUE` → `bookmark.ErrDuplicateURL`. Dùng **ràng buộc UNIQUE của DB** thay vì "kiểm tra rồi mới insert" - tránh race condition khi 2 request cùng lúc (lỗi check-then-act ở [Bài 14](./14-advanced-concurrency.md))
- **`rows.Err()`** sau vòng lặp: lỗi mạng/đĩa **giữa chừng** khi duyệt kết quả chỉ được báo ở đây
- Interface `scanner` nhỏ xíu cho phép **một** hàm `scanBookmark` dùng cho cả `*sql.Row` và `*sql.Rows`
- **Test với DB thật** trong `t.TempDir()` (tự xóa sau test) - SQLite nhanh đến mức không cần giả lập

### Bước 5: Tầng HTTP

📄 **`internal/httpapi/server.go`**

```go
// Package httpapi là tầng HTTP: routing, đọc/ghi JSON, chuyển lỗi thành status code.
package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"sync/atomic"
	"time"

	"bookmark-api/internal/bookmark"
)

// BookmarkService: chỉ những method mà handler THỰC SỰ cần (interface nhỏ → dễ tạo bản giả khi test)
type BookmarkService interface {
	Create(ctx context.Context, in bookmark.NewBookmark) (bookmark.Bookmark, error)
	Get(ctx context.Context, id int64) (bookmark.Bookmark, error)
	List(ctx context.Context, f bookmark.ListFilter) ([]bookmark.Bookmark, error)
	Delete(ctx context.Context, id int64) error
}

// Pinger kiểm tra kết nối database cho /readyz
type Pinger interface {
	Ping(ctx context.Context) error
}

type Server struct {
	svc          BookmarkService
	db           Pinger
	logger       *slog.Logger
	maxBodyBytes int64
	version      string
	shuttingDown atomic.Bool
}

// Option - functional options pattern
type Option func(*Server)

func WithLogger(l *slog.Logger) Option { return func(s *Server) { s.logger = l } }
func WithMaxBodyBytes(n int64) Option  { return func(s *Server) { s.maxBodyBytes = n } }
func WithVersion(v string) Option      { return func(s *Server) { s.version = v } }

func New(svc BookmarkService, db Pinger, opts ...Option) *Server {
	s := &Server{
		svc:          svc,
		db:           db,
		logger:       slog.New(slog.DiscardHandler),
		maxBodyBytes: 1 << 20, // 1 MB
		version:      "dev",
	}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// Handler trả về http.Handler hoàn chỉnh: routes + middleware
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", s.handleHealthz)
	mux.HandleFunc("GET /readyz", s.handleReadyz)
	mux.HandleFunc("GET /v1/bookmarks", s.handleList)
	mux.HandleFunc("POST /v1/bookmarks", s.handleCreate)
	mux.HandleFunc("GET /v1/bookmarks/{id}", s.handleGet)
	mux.HandleFunc("DELETE /v1/bookmarks/{id}", s.handleDelete)

	// Thứ tự: request đi qua requestID → logRequests → recoverPanic → mux
	return s.requestID(s.logRequests(s.recoverPanic(mux)))
}

// StartShutdown báo /readyz trả 503 → load balancer ngừng gửi request mới
func (s *Server) StartShutdown() { s.shuttingDown.Store(true) }

// ===================== Health check =====================

// /healthz (liveness): tiến trình còn sống không? KHÔNG kiểm tra DB -
// nếu DB sập mà healthz lỗi, Kubernetes sẽ restart pod vô ích.
func (s *Server) handleHealthz(w http.ResponseWriter, r *http.Request) {
	s.writeJSON(w, r, http.StatusOK, map[string]string{"status": "ok", "version": s.version})
}

// /readyz (readiness): sẵn sàng nhận traffic chưa? Có kiểm tra phụ thuộc.
func (s *Server) handleReadyz(w http.ResponseWriter, r *http.Request) {
	if s.shuttingDown.Load() {
		s.writeJSON(w, r, http.StatusServiceUnavailable, map[string]string{"status": "shutting down"})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), time.Second)
	defer cancel()
	if err := s.db.Ping(ctx); err != nil {
		s.logger.WarnContext(ctx, "readyz: db ping lỗi", "err", err)
		s.writeJSON(w, r, http.StatusServiceUnavailable, map[string]string{"status": "db unavailable"})
		return
	}
	s.writeJSON(w, r, http.StatusOK, map[string]string{"status": "ready"})
}

// ===================== Bookmark handlers =====================

func (s *Server) handleCreate(w http.ResponseWriter, r *http.Request) {
	var in bookmark.NewBookmark
	if err := s.decodeJSON(w, r, &in); err != nil {
		s.writeError(w, r, err)
		return
	}
	b, err := s.svc.Create(r.Context(), in)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	w.Header().Set("Location", "/v1/bookmarks/"+strconv.FormatInt(b.ID, 10))
	s.writeJSON(w, r, http.StatusCreated, b)
}

func (s *Server) handleGet(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	b, err := s.svc.Get(r.Context(), id)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	s.writeJSON(w, r, http.StatusOK, b)
}

func (s *Server) handleList(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	limit, _ := strconv.Atoi(q.Get("limit"))   // Lỗi → 0 → service dùng mặc định
	offset, _ := strconv.Atoi(q.Get("offset")) // Lỗi → 0
	list, err := s.svc.List(r.Context(), bookmark.ListFilter{Tag: q.Get("tag"), Limit: limit, Offset: offset})
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	s.writeJSON(w, r, http.StatusOK, map[string]any{"items": list, "count": len(list)})
}

func (s *Server) handleDelete(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	if err := s.svc.Delete(r.Context(), id); err != nil {
		s.writeError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ===================== Helpers =====================

// badRequestError: lỗi do client gửi sai (JSON hỏng, id sai...)
type badRequestError struct{ msg string }

func (e *badRequestError) Error() string { return e.msg }

func parseID(r *http.Request) (int64, error) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		return 0, &badRequestError{"id phải là số nguyên dương"}
	}
	return id, nil
}

func (s *Server) decodeJSON(w http.ResponseWriter, r *http.Request, dst any) error {
	r.Body = http.MaxBytesReader(w, r.Body, s.maxBodyBytes) // Chống body khổng lồ làm tràn RAM
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields() // Gõ nhầm "titel" → báo lỗi thay vì lặng lẽ bỏ qua
	if err := dec.Decode(dst); err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			return maxErr
		}
		return &badRequestError{"JSON không hợp lệ: " + err.Error()}
	}
	if err := dec.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return &badRequestError{"body chỉ được chứa một object JSON"}
	}
	return nil
}

func (s *Server) writeJSON(w http.ResponseWriter, r *http.Request, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		s.logger.WarnContext(r.Context(), "ghi response lỗi", "err", err)
	}
}

// writeError là NƠI DUY NHẤT chuyển lỗi thành HTTP status.
// Lỗi nội bộ (500) được log đầy đủ nhưng client chỉ thấy thông báo chung chung.
func (s *Server) writeError(w http.ResponseWriter, r *http.Request, err error) {
	var (
		ve     *bookmark.ValidationError
		bre    *badRequestError
		maxErr *http.MaxBytesError
	)
	switch {
	case errors.As(err, &ve):
		s.writeJSON(w, r, http.StatusBadRequest, map[string]any{"error": "dữ liệu không hợp lệ", "fields": ve.Fields})
	case errors.As(err, &bre):
		s.writeJSON(w, r, http.StatusBadRequest, map[string]string{"error": bre.msg})
	case errors.As(err, &maxErr):
		s.writeJSON(w, r, http.StatusRequestEntityTooLarge, map[string]string{"error": "body quá lớn"})
	case errors.Is(err, bookmark.ErrNotFound):
		s.writeJSON(w, r, http.StatusNotFound, map[string]string{"error": bookmark.ErrNotFound.Error()})
	case errors.Is(err, bookmark.ErrDuplicateURL):
		s.writeJSON(w, r, http.StatusConflict, map[string]string{"error": bookmark.ErrDuplicateURL.Error()})
	case errors.Is(err, context.Canceled):
		// Client đã bỏ đi - không cần trả lời, cũng không phải lỗi của server
		s.logger.InfoContext(r.Context(), "client hủy request", "request_id", requestIDFrom(r.Context()))
	default:
		s.logger.ErrorContext(r.Context(), "lỗi nội bộ", "err", err, "request_id", requestIDFrom(r.Context()))
		s.writeJSON(w, r, http.StatusInternalServerError, map[string]string{
			"error": "lỗi hệ thống", "request_id": requestIDFrom(r.Context()),
		})
	}
}
```

📄 **`internal/httpapi/middleware.go`**

```go
package httpapi

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"expvar"
	"net/http"
	"runtime/debug"
	"time"
)

// Metrics cơ bản qua expvar - xem tại http://<admin-addr>/debug/vars
var (
	metricRequests = expvar.NewMap("http_requests_total") // Đếm theo nhóm status: "2xx", "4xx"...
	metricInFlight = expvar.NewInt("http_requests_in_flight")
	metricPanics   = expvar.NewInt("http_panics_total")
)

type ctxKey int

const requestIDKey ctxKey = 0

func requestIDFrom(ctx context.Context) string {
	id, _ := ctx.Value(requestIDKey).(string)
	return id
}

// requestID gắn một ID cho mỗi request (lấy từ header X-Request-ID nếu proxy phía trước đã tạo)
// → lần theo MỘT request xuyên qua log của nhiều service.
func (s *Server) requestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("X-Request-ID")
		if id == "" || len(id) > 64 {
			b := make([]byte, 8)
			_, _ = rand.Read(b)
			id = hex.EncodeToString(b)
		}
		w.Header().Set("X-Request-ID", id)
		ctx := context.WithValue(r.Context(), requestIDKey, id)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// statusRecorder "nghe lén" status code mà handler ghi (embedding - Bài 6, Bài 10)
type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (rec *statusRecorder) WriteHeader(code int) {
	rec.status = code
	rec.ResponseWriter.WriteHeader(code)
}

// Unwrap cho phép http.ResponseController truy cập ResponseWriter gốc (Flush, deadline...)
func (rec *statusRecorder) Unwrap() http.ResponseWriter { return rec.ResponseWriter }

func (s *Server) logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		metricInFlight.Add(1)
		defer metricInFlight.Add(-1)

		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)

		metricRequests.Add(statusClass(rec.status), 1)
		s.logger.InfoContext(r.Context(), "http request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", rec.status,
			"duration_ms", time.Since(start).Milliseconds(),
			"request_id", requestIDFrom(r.Context()),
		)
	})
}

// recoverPanic: một handler panic KHÔNG được làm sập cả server
func (s *Server) recoverPanic(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				//nolint:errorlint // So sánh GIÁ TRỊ panic, không phải lỗi được bọc
				if v == http.ErrAbortHandler { // Panic "có chủ đích" của net/http → ném tiếp
					panic(v)
				}
				metricPanics.Add(1)
				s.logger.ErrorContext(r.Context(), "panic",
					"value", v, "stack", string(debug.Stack()), "request_id", requestIDFrom(r.Context()))
				w.Header().Set("Connection", "close")
				s.writeJSON(w, r, http.StatusInternalServerError, map[string]string{"error": "lỗi hệ thống"})
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func statusClass(code int) string {
	return string(rune('0'+code/100)) + "xx"
}
```

**Điểm nhấn**:
- **Chuỗi middleware**: `requestID(logRequests(recoverPanic(mux)))` - request đi từ ngoài vào trong. `requestID` ở ngoài cùng để **mọi** middleware khác đều có ID; `recoverPanic` ở trong `logRequests` để request bị panic **vẫn được log** với status 500
- **`writeError` là nơi duy nhất** chuyển lỗi → status code: thêm loại lỗi mới chỉ cần sửa một chỗ
- **`DisallowUnknownFields`** + kiểm tra "chỉ một object JSON" → client gõ nhầm field nhận lỗi rõ ràng thay vì "tạo thành công nhưng thiếu dữ liệu"
- **`http.MaxBytesReader`** → body quá lớn trả **413**, không đọc hết vào RAM
- `Location` header khi tạo thành công (chuẩn REST cho `201 Created`)
- `statusRecorder` có `Unwrap()` để `http.ResponseController` (Go 1.20+) vẫn truy cập được các tính năng của `ResponseWriter` gốc

📄 **`internal/httpapi/server_test.go`** - test tích hợp: HTTP thật + SQLite thật

```go
package httpapi

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"bookmark-api/internal/bookmark"
	"bookmark-api/internal/storage/sqlite"
)

// newTestAPI dựng TOÀN BỘ ứng dụng thật (SQLite trong thư mục tạm) - test tích hợp
func newTestAPI(t *testing.T, opts ...Option) (*httptest.Server, *Server) {
	t.Helper()
	store, err := sqlite.Open(context.Background(), filepath.Join(t.TempDir(), "api.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { store.Close() })

	api := New(bookmark.NewService(store), store, opts...)
	srv := httptest.NewServer(api.Handler())
	t.Cleanup(srv.Close)
	return srv, api
}

// do gửi request và trả về status + body đã decode (nếu là JSON)
func do(t *testing.T, method, url, body string) (*http.Response, map[string]any) {
	t.Helper()
	req, err := http.NewRequest(method, url, strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	var out map[string]any
	_ = json.Unmarshal(raw, &out)
	return resp, out
}

func TestHealthAndReadiness(t *testing.T) {
	srv, api := newTestAPI(t, WithVersion("1.2.3"))

	resp, body := do(t, "GET", srv.URL+"/healthz", "")
	if resp.StatusCode != 200 || body["version"] != "1.2.3" {
		t.Fatalf("healthz: %d %v", resp.StatusCode, body)
	}
	if resp, _ := do(t, "GET", srv.URL+"/readyz", ""); resp.StatusCode != 200 {
		t.Fatalf("readyz = %d; muốn 200", resp.StatusCode)
	}
	api.StartShutdown()
	if resp, _ := do(t, "GET", srv.URL+"/readyz", ""); resp.StatusCode != 503 {
		t.Fatalf("readyz khi đang tắt = %d; muốn 503", resp.StatusCode)
	}
}

func TestBookmarkLifecycle(t *testing.T) {
	srv, _ := newTestAPI(t)
	base := srv.URL + "/v1/bookmarks"

	// Tạo
	resp, body := do(t, "POST", base, `{"url":"https://go.dev","title":"Go","tags":["Go","lang"]}`)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create = %d %v", resp.StatusCode, body)
	}
	loc := resp.Header.Get("Location")
	if loc != "/v1/bookmarks/1" || resp.Header.Get("X-Request-ID") == "" {
		t.Errorf("Location=%q X-Request-ID=%q", loc, resp.Header.Get("X-Request-ID"))
	}

	// Trùng URL → 409
	if resp, _ := do(t, "POST", base, `{"url":"https://go.dev","title":"lại"}`); resp.StatusCode != http.StatusConflict {
		t.Errorf("duplicate = %d; muốn 409", resp.StatusCode)
	}

	// Lấy
	resp, body = do(t, "GET", srv.URL+loc, "")
	if resp.StatusCode != 200 || body["title"] != "Go" {
		t.Errorf("get = %d %v", resp.StatusCode, body)
	}

	// Liệt kê theo tag (tag được chuẩn hóa thành chữ thường)
	_, body = do(t, "GET", base+"?tag=GO", "")
	if body["count"] != float64(1) { // JSON number → float64 khi decode vào any
		t.Errorf("list tag=GO: %v", body)
	}

	// Xóa rồi lấy lại → 404
	if resp, _ := do(t, "DELETE", srv.URL+loc, ""); resp.StatusCode != http.StatusNoContent {
		t.Errorf("delete = %d; muốn 204", resp.StatusCode)
	}
	if resp, _ := do(t, "GET", srv.URL+loc, ""); resp.StatusCode != http.StatusNotFound {
		t.Errorf("get sau khi xóa = %d; muốn 404", resp.StatusCode)
	}
}

func TestCreate_BadRequests(t *testing.T) {
	srv, _ := newTestAPI(t, WithMaxBodyBytes(200))
	tests := []struct {
		name, body string
		want       int
	}{
		{"JSON hỏng", `{"url":`, 400},
		{"field lạ", `{"url":"https://a.com","title":"x","titel":"y"}`, 400},
		{"hai object", `{"url":"https://a.com","title":"x"}{}`, 400},
		{"validation", `{"url":"not-a-url","title":""}`, 400},
		{"body quá lớn", `{"url":"https://a.com","title":"` + strings.Repeat("x", 300) + `"}`, 413},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			resp, body := do(t, "POST", srv.URL+"/v1/bookmarks", tc.body)
			if resp.StatusCode != tc.want {
				t.Errorf("status = %d; muốn %d (%v)", resp.StatusCode, tc.want, body)
			}
		})
	}

	// Lỗi validation phải chỉ rõ TỪNG field
	_, body := do(t, "POST", srv.URL+"/v1/bookmarks", `{"url":"not-a-url","title":""}`)
	fields, _ := body["fields"].(map[string]any)
	if fields["url"] == nil || fields["title"] == nil {
		t.Errorf("thiếu lỗi field: %v", body)
	}
}

func TestGet_InvalidID(t *testing.T) {
	srv, _ := newTestAPI(t)
	for _, id := range []string{"abc", "0", "-1"} {
		if resp, _ := do(t, "GET", srv.URL+"/v1/bookmarks/"+id, ""); resp.StatusCode != 400 {
			t.Errorf("id=%s: status = %d; muốn 400", id, resp.StatusCode)
		}
	}
}

// panicService nhúng interface nhưng để nil → gọi bất kỳ method nào cũng panic
type panicService struct{ BookmarkService }

func TestRecoverPanic(t *testing.T) {
	api := New(panicService{}, nil)
	srv := httptest.NewServer(api.Handler())
	defer srv.Close()

	resp, body := do(t, "GET", srv.URL+"/v1/bookmarks/1", "")
	if resp.StatusCode != 500 || body["error"] != "lỗi hệ thống" {
		t.Fatalf("panic → %d %v; muốn 500", resp.StatusCode, body)
	}
	// Server vẫn sống sau panic
	if resp, _ := do(t, "GET", srv.URL+"/healthz", ""); resp.StatusCode != 200 {
		t.Fatalf("healthz sau panic = %d", resp.StatusCode)
	}
}
```

### Bước 6: `main.go` - Lắp ráp mọi thứ

📄 **`cmd/bookmark-api/main.go`**

```go
// Command bookmark-api chạy HTTP API quản lý bookmark.
package main

import (
	"context"
	"errors"
	"expvar"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/pprof"
	"os"
	"os/signal"
	"syscall"
	"time"

	"bookmark-api/internal/bookmark"
	"bookmark-api/internal/config"
	"bookmark-api/internal/httpapi"
	"bookmark-api/internal/storage/sqlite"
)

// version được ghi đè lúc build: go build -ldflags "-X main.version=1.0.0"
var version = "dev"

func main() {
	// main chỉ làm 2 việc: gọi run và chuyển lỗi thành exit code.
	if err := run(context.Background(), os.Args[1:], os.Getenv, os.Stdout); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return // Người dùng gõ -h: hướng dẫn đã được in, không phải lỗi
		}
		fmt.Fprintln(os.Stderr, "lỗi:", err)
		os.Exit(1)
	}
}

// run chứa toàn bộ logic khởi động. Mọi phụ thuộc bên ngoài (args, env, stdout)
// là tham số → có thể gọi run() từ test.
func run(ctx context.Context, args []string, getenv func(string) string, stdout io.Writer) error {
	// 1. Cấu hình
	cfg, err := config.Load(args, getenv)
	if err != nil {
		return fmt.Errorf("cấu hình: %w", err)
	}

	// 2. Logger
	logger := newLogger(stdout, cfg)
	slog.SetDefault(logger)
	logger.Info("khởi động", "version", version, "addr", cfg.Addr, "db", cfg.DBPath)

	// 3. Tín hiệu dừng
	ctx, stop := signal.NotifyContext(ctx, os.Interrupt, syscall.SIGTERM)
	defer stop()

	// 4. Dependency injection THỦ CÔNG: tạo từ trong ra ngoài, truyền qua constructor
	store, err := sqlite.Open(ctx, cfg.DBPath)
	if err != nil {
		return err
	}
	defer store.Close()

	svc := bookmark.NewService(store)
	api := httpapi.New(svc, store,
		httpapi.WithLogger(logger),
		httpapi.WithVersion(version),
		httpapi.WithMaxBodyBytes(cfg.MaxBodyBytes),
	)

	// 5. HTTP server với timeout đầy đủ
	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           api.Handler(),
		ReadHeaderTimeout: 5 * time.Second,  // Chống Slowloris
		ReadTimeout:       15 * time.Second, // Đọc toàn bộ request
		WriteTimeout:      30 * time.Second, // Ghi response
		IdleTimeout:       60 * time.Second, // Keep-alive
		ErrorLog:          slog.NewLogLogger(logger.Handler(), slog.LevelWarn),
	}
	servers := []*http.Server{srv}

	// 6. Admin server (pprof + expvar) - cổng RIÊNG, mặc định chỉ nghe localhost
	if cfg.AdminAddr != "" {
		servers = append(servers, &http.Server{
			Addr:              cfg.AdminAddr,
			Handler:           adminHandler(),
			ReadHeaderTimeout: 5 * time.Second,
		})
	}

	errCh := make(chan error, len(servers))
	for _, s := range servers {
		go func() {
			logger.Info("lắng nghe", "addr", s.Addr)
			if err := s.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
				errCh <- fmt.Errorf("server %s: %w", s.Addr, err)
			}
		}()
	}

	// 7. Chờ tín hiệu dừng hoặc lỗi khởi động (ví dụ cổng đã bị chiếm)
	select {
	case <-ctx.Done():
		logger.Info("nhận tín hiệu dừng, bắt đầu graceful shutdown")
	case err := <-errCh:
		return err
	}
	stop() // Ctrl+C lần nữa → thoát ngay

	// 8. Graceful shutdown
	api.StartShutdown() // /readyz → 503
	shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()
	var errs []error
	for _, s := range servers {
		if err := s.Shutdown(shutdownCtx); err != nil {
			errs = append(errs, fmt.Errorf("shutdown %s: %w", s.Addr, err))
		}
	}
	logger.Info("đã dừng")
	return errors.Join(errs...)
}

func newLogger(w io.Writer, cfg config.Config) *slog.Logger {
	opts := &slog.HandlerOptions{Level: cfg.LogLevel}
	var h slog.Handler = slog.NewJSONHandler(w, opts)
	if cfg.LogFormat == "text" {
		h = slog.NewTextHandler(w, opts)
	}
	return slog.New(h).With("service", "bookmark-api")
}

func adminHandler() http.Handler {
	mux := http.NewServeMux()
	mux.Handle("GET /debug/vars", expvar.Handler())
	mux.HandleFunc("/debug/pprof/", pprof.Index) // heap, goroutine, allocs, block, mutex...
	mux.HandleFunc("/debug/pprof/cmdline", pprof.Cmdline)
	mux.HandleFunc("/debug/pprof/profile", pprof.Profile) // CPU profile
	mux.HandleFunc("/debug/pprof/symbol", pprof.Symbol)
	mux.HandleFunc("/debug/pprof/trace", pprof.Trace)
	return mux
}
```

📄 **`cmd/bookmark-api/main_test.go`** - khởi động **cả ứng dụng** rồi tắt an toàn

```go
package main

import (
	"bytes"
	"context"
	"net"
	"net/http"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

// TestRun khởi động TOÀN BỘ ứng dụng như thật, gọi /healthz, rồi tắt an toàn.
func TestRun(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0") // Xin một cổng trống
	if err != nil {
		t.Fatal(err)
	}
	addr := ln.Addr().String()
	ln.Close()

	env := map[string]string{
		"BOOKMARK_ADDR":       addr,
		"BOOKMARK_ADMIN_ADDR": "",
		"BOOKMARK_DB_PATH":    filepath.Join(t.TempDir(), "run.db"),
	}
	getenv := func(k string) string { return env[k] }

	ctx, cancel := context.WithCancel(context.Background())
	var logs syncBuffer
	done := make(chan error, 1)
	go func() { done <- run(ctx, nil, getenv, &logs) }()

	// Chờ server sẵn sàng (tối đa 5 giây)
	deadline := time.Now().Add(5 * time.Second)
	for {
		resp, err := http.Get("http://" + addr + "/healthz")
		if err == nil {
			resp.Body.Close()
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("server không khởi động: %v\nlogs:\n%s", err, logs.String())
		}
		time.Sleep(20 * time.Millisecond)
	}

	cancel() // Giống như nhận SIGTERM
	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("run trả lỗi: %v", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("run không dừng sau khi cancel")
	}
	if !strings.Contains(logs.String(), "đã dừng") {
		t.Errorf("log thiếu dòng 'đã dừng':\n%s", logs.String())
	}
}

// syncBuffer: bytes.Buffer an toàn khi nhiều goroutine cùng ghi log
type syncBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *syncBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.Write(p)
}

func (b *syncBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.String()
}
```

**Điểm nhấn - pattern `run()`**:
- `main()` chỉ có 5 dòng: gọi `run`, chuyển lỗi thành exit code. Mọi logic nằm trong `run(ctx, args, getenv, stdout)` - **test được** như một hàm bình thường (xem `TestRun`)
- **`defer` hoạt động đúng**: nếu gọi `os.Exit` ở giữa `main`, các `defer` (như `store.Close()`) **không chạy**. Với `run` trả lỗi, mọi `defer` chạy xong rồi `main` mới `os.Exit(1)`
- `http.Server.ErrorLog` được nối vào `slog` qua `slog.NewLogLogger` → lỗi nội bộ của `net/http` (TLS handshake, header sai...) cũng thành log JSON
- Hai server (API + admin) cùng được shutdown; lỗi gom bằng `errors.Join`

### Bước 7: Chạy thử

```bash
make test        # hoặc: go test -race ./...
```

```text
ok  	bookmark-api/cmd/bookmark-api	1.045s
ok  	bookmark-api/internal/bookmark	1.014s
ok  	bookmark-api/internal/config	1.021s
ok  	bookmark-api/internal/httpapi	1.090s
ok  	bookmark-api/internal/storage/sqlite	1.046s
```

```bash
go test -cover ./...
```

```text
ok  	bookmark-api/cmd/bookmark-api	coverage: 83.0% of statements
ok  	bookmark-api/internal/bookmark	coverage: 73.5% of statements
ok  	bookmark-api/internal/config	coverage: 83.9% of statements
ok  	bookmark-api/internal/httpapi	coverage: 85.9% of statements
ok  	bookmark-api/internal/storage/sqlite	coverage: 78.7% of statements
```

Khởi động server (terminal 1):

```bash
make run    # hoặc: go run ./cmd/bookmark-api
```

Gọi API (terminal 2):

```bash
curl -i -X POST localhost:8080/v1/bookmarks \
  -d '{"url":"https://go.dev/doc/effective_go","title":"Effective Go","tags":["Go","Docs"]}'
```

```text
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8
Location: /v1/bookmarks/1
X-Request-Id: 9b2f6ead6dcb05fe

{"id":1,"url":"https://go.dev/doc/effective_go","title":"Effective Go","tags":["docs","go"],"created_at":"2026-09-25T05:53:38.916Z"}
```

```bash
curl -X POST localhost:8080/v1/bookmarks -d '{"url":"https://pkg.go.dev/log/slog","title":"slog","tags":["go","logging"]}'
curl -X POST localhost:8080/v1/bookmarks -d '{"url":"https://go.dev/doc/effective_go","title":"again"}'
# {"error":"URL này đã được lưu"}

curl -X POST localhost:8080/v1/bookmarks -d '{"url":"go.dev","title":"","tags":["lập trình"]}'
# {"error":"dữ liệu không hợp lệ","fields":{"tags":"tag chỉ gồm a-z, 0-9, dấu '-' (1-30 ký tự)","title":"không được để trống","url":"phải là URL http(s) đầy đủ"}}

curl "localhost:8080/v1/bookmarks?tag=logging"
# {"count":1,"items":[{"id":2,"url":"https://pkg.go.dev/log/slog","title":"slog","tags":["go","logging"],"created_at":"2026-09-25T05:53:38.924Z"}]}

curl localhost:8080/v1/bookmarks/99
# {"error":"bookmark không tồn tại"}

curl -i -X DELETE localhost:8080/v1/bookmarks/2
# HTTP/1.1 204 No Content

curl -s localhost:6060/debug/vars | grep http_
# "http_panics_total": 0,
# "http_requests_in_flight": 0,
# "http_requests_total": {"2xx": 6, "4xx": 3},
```

Log phía server (JSON, mỗi dòng một sự kiện - rút gọn trường `time`):

```text
{"level":"INFO","msg":"khởi động","service":"bookmark-api","version":"dev","addr":":8080","db":"bookmarks.db"}
{"level":"INFO","msg":"lắng nghe","service":"bookmark-api","addr":"127.0.0.1:6060"}
{"level":"INFO","msg":"lắng nghe","service":"bookmark-api","addr":":8080"}
{"level":"INFO","msg":"http request","service":"bookmark-api","method":"POST","path":"/v1/bookmarks","status":201,"duration_ms":1,"request_id":"9b2f6ead6dcb05fe"}
{"level":"INFO","msg":"http request","service":"bookmark-api","method":"POST","path":"/v1/bookmarks","status":409,"duration_ms":0,"request_id":"3db1bf3a97af4213"}
...
{"level":"INFO","msg":"nhận tín hiệu dừng, bắt đầu graceful shutdown","service":"bookmark-api"}
{"level":"INFO","msg":"đã dừng","service":"bookmark-api"}
```

Nhấn `Ctrl+C` ở terminal 1 → hai dòng cuối xuất hiện: server tắt an toàn.

Kiểm tra cấu hình sai:

```bash
go run ./cmd/bookmark-api -log-format xml -shutdown-timeout abc
```

```text
lỗi: cấu hình: log-format phải là json hoặc text, nhận "xml"
shutdown-timeout "abc" không hợp lệ
exit status 1
```

### Bước 8: Đóng gói & CI

Thêm các file đã giới thiệu ở mục 12-14 vào gốc project: `Dockerfile`, `.dockerignore`, `Makefile`, `.golangci.yml`, `.github/workflows/ci.yml`.

📄 **`.dockerignore`**

```text
.git
*.db
*.db-*
bin/
coverage.out
Dockerfile
```

```bash
make docker VERSION=1.0.0
docker run --rm -p 8080:8080 -v bookmark-data:/data bookmark-api:1.0.0
curl localhost:8080/healthz
# {"status":"ok","version":"1.0.0"}
```

Cấu trúc cuối cùng:

```text
bookmark-api/
├── .dockerignore
├── .github/workflows/ci.yml
├── .golangci.yml
├── Dockerfile
├── Makefile
├── go.mod
├── go.sum
├── cmd/bookmark-api/
│   ├── main.go
│   └── main_test.go
└── internal/
    ├── bookmark/
    │   ├── bookmark.go
    │   └── bookmark_test.go
    ├── config/
    │   ├── config.go
    │   └── config_test.go
    ├── httpapi/
    │   ├── middleware.go
    │   ├── server.go
    │   └── server_test.go
    └── storage/sqlite/
        ├── sqlite.go
        └── sqlite_test.go
```

## ⚠️ Lỗi thường gặp

### Lỗi 1: `http.ListenAndServe` không timeout

```go
http.ListenAndServe(":8080", mux) // ❌ Không timeout nào → dễ bị Slowloris, rò kết nối
```

✅ Luôn tạo `&http.Server{ReadHeaderTimeout: ..., ReadTimeout: ..., WriteTimeout: ..., IdleTimeout: ...}`. `gosec` (qua golangci-lint) sẽ cảnh báo G114.

### Lỗi 2: Truyền `ctx` đã bị hủy vào `Shutdown`

```go
<-ctx.Done()
srv.Shutdown(ctx) // ❌ ctx đã hủy → Shutdown trả về NGAY, request đang chạy bị cắt
```

✅ `shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)`.

### Lỗi 3: Coi `http.ErrServerClosed` là lỗi

```go
if err := srv.ListenAndServe(); err != nil {
	log.Fatal(err) // ❌ Mỗi lần tắt bình thường cũng "crash" và bỏ qua mọi defer
}
```

✅ `if err != nil && !errors.Is(err, http.ErrServerClosed)`.

### Lỗi 4: `os.Exit` / `log.Fatal` giữa chừng

`log.Fatal` gọi `os.Exit(1)` → **các `defer` không chạy**: DB không đóng, buffer log không flush. ✅ Dùng pattern `run() error`, chỉ `os.Exit` ở cuối `main`.

### Lỗi 5: Log và trả lỗi ở mọi tầng

```go
if err != nil {
	slog.Error("không lấy được bookmark", "err", err) // ❌ Log ở repo, rồi service log, rồi handler log...
	return err
}
```

✅ Bọc thêm ngữ cảnh (`fmt.Errorf("...: %w", err)`) và **trả về**. Chỉ log **một lần** ở nơi xử lý cuối cùng.

### Lỗi 6: Liveness probe kiểm tra database

DB chập chờn → Kubernetes restart **mọi** pod → sập dây chuyền. ✅ `/healthz` chỉ trả 200; kiểm tra DB đặt ở `/readyz`.

### Lỗi 7: Lộ pprof ra Internet

```go
import _ "net/http/pprof"
http.ListenAndServe(":8080", nil) // ❌ DefaultServeMux có /debug/pprof/ - ai cũng xem được
```

✅ Mux riêng cho API; pprof trên cổng admin chỉ nghe `127.0.0.1`.

### Lỗi 8: Dùng `mattn/go-sqlite3` với `CGO_ENABLED=0`

```text
Binary was compiled with 'CGO_ENABLED=0', go-sqlite3 requires cgo to work. This is a stub
```

✅ Dùng `modernc.org/sqlite` (thuần Go), hoặc build với cgo và image có thư viện C (không dùng được `scratch`/`distroless/static`).

### Lỗi 9: Image Docker chứa cả thư mục `.git`, file DB, secret

✅ Luôn có `.dockerignore`; multi-stage build chỉ copy **binary** sang image cuối.

### Lỗi 10: Tối ưu khi chưa đo

Viết lại code thành phức tạp khó đọc để "nhanh hơn" một hàm chỉ chiếm 0.1% thời gian chạy. ✅ Benchmark + pprof **trước**, tối ưu **sau**.

## 🏋️ Bài tập

### Bài tập 1: Endpoint cập nhật (⭐ Dễ)

Thêm `PATCH /v1/bookmarks/{id}` cho phép sửa `title` và/hoặc `tags` (dùng con trỏ `*string`, `*[]string` để phân biệt "không gửi" và "gửi rỗng"). Viết test cho cả 3 tầng: service (fake repo), sqlite (DB thật), HTTP (`httptest`).

### Bài tập 2: Tìm kiếm & thống kê (⭐ Dễ)

- Thêm `?q=` tìm kiếm trong `title` (không phân biệt hoa thường, dùng tham số `?` - **không** nối chuỗi SQL)
- Thêm `GET /v1/tags` trả về danh sách tag kèm số lượng bookmark: `[{"tag":"go","count":2}]`
- Thêm metric `expvar` đếm số bookmark đã tạo

### Bài tập 3: Chuẩn hóa database (⭐⭐ Trung bình)

Thay cột `tags` dạng chuỗi bằng bảng `tags(id, name)` và bảng nối `bookmark_tags(bookmark_id, tag_id)`. Dùng **transaction** (`db.BeginTx`) khi tạo bookmark cùng tag. Viết migration dạng file `.sql` được **nhúng** bằng `embed` và chạy theo thứ tự phiên bản (lưu phiên bản đã chạy trong bảng `schema_migrations`). Toàn bộ test cũ phải vẫn qua.

### Bài tập 4: Xác thực bằng API key + rate limit (⭐⭐ Trung bình)

- Middleware kiểm tra header `Authorization: Bearer <key>`; danh sách key đọc từ biến môi trường `BOOKMARK_API_KEYS` (phân tách dấu phẩy). So sánh bằng `crypto/subtle.ConstantTimeCompare`
- `/healthz`, `/readyz` không cần key
- Rate limit **theo API key** bằng `golang.org/x/time/rate` ([Bài 14](./14-advanced-concurrency.md)), trả `429` kèm header `Retry-After`
- Đảm bảo API key **không bao giờ** xuất hiện trong log (viết test kiểm tra)

### Bài tập 5: Profiling thực chiến (⭐⭐⭐ Khó)

- Viết chương trình tải (load test) nhỏ bằng Go: 50 goroutine gửi tổng cộng 20.000 request `POST` + `GET` tới server (dùng `errgroup` + `SetLimit`), in ra số request/giây và độ trễ p50/p95/p99
- Trong lúc chạy, thu CPU profile 20 giây qua cổng admin, tìm 3 hàm tốn CPU nhất
- Thử một thay đổi (ví dụ `db.SetMaxOpenConns`, bỏ `json.Encoder` thừa...), đo lại và ghi kết quả trước/sau vào `README.md`

### Bài tập 6: Chuyển sang PostgreSQL (⭐⭐⭐ Khó)

Viết `internal/storage/postgres` cài đặt **cùng** interface `bookmark.Repository` bằng `github.com/jackc/pgx/v5/stdlib`. Chọn backend qua biến môi trường `BOOKMARK_DB_DRIVER=sqlite|postgres`. Viết `docker-compose.yml` chạy API + Postgres. Chạy **cùng một bộ test** (table-driven, hàm nhận `bookmark.Repository`) cho cả hai backend. Nếu làm đúng, package `bookmark` và `httpapi` **không phải sửa dòng nào** - đó là phần thưởng của kiến trúc tốt.

## ✅ Checklist hoàn thành

- [ ] Tổ chức project với `cmd/` + `internal/`, chia package theo nghiệp vụ
- [ ] Đọc config từ mặc định/env/flag, validate và gom lỗi khi khởi động
- [ ] Viết constructor nhận phụ thuộc (DI thủ công) và functional options
- [ ] Khai báo interface nhỏ ở phía người dùng, viết fake để test
- [ ] Bọc lỗi xuyên tầng, dịch lỗi ở ranh giới, chỉ log một lần
- [ ] Graceful shutdown HTTP server với `signal.NotifyContext` + `Shutdown`
- [ ] Phân biệt `/healthz` (liveness) và `/readyz` (readiness)
- [ ] Công khai metric bằng `expvar`, dùng `pprof` qua HTTP và qua benchmark
- [ ] Viết benchmark với `b.Loop()`, `-benchmem`, đọc được `allocs/op`
- [ ] Build với `-ldflags -X`, `-trimpath`, cross-compile cho OS khác
- [ ] Viết Dockerfile multi-stage chạy bằng user không phải root
- [ ] Thiết lập CI: vet, test -race, golangci-lint, govulncheck
- [ ] Hoàn thành capstone Bookmark API, `make test` và `make lint` sạch
- [ ] Hoàn thành ít nhất 3 bài tập

## 🎓 Tổng kết & Lộ trình học tiếp

🎉 **Chúc mừng!** Bạn đã đi hết chặng đường từ `Hello, World` đến một service Go có cấu trúc chuẩn, được test, đóng gói, và sẵn sàng triển khai.

### 🗺️ Lộ trình tiếp theo

| Chủ đề | Học gì | Bắt đầu từ |
|--------|--------|-----------|
| **gRPC & Protocol Buffers** | Giao tiếp giữa các microservice nhanh, có kiểu chặt chẽ; streaming | [grpc.io/docs/languages/go](https://grpc.io/docs/languages/go/), `buf` CLI, ConnectRPC |
| **Message queue** | Xử lý bất đồng bộ, tách rời service: Kafka, RabbitMQ, NATS | `github.com/segmentio/kafka-go`, `github.com/nats-io/nats.go`, pattern outbox |
| **Kubernetes** | Deploy, scale, probe, ConfigMap/Secret, rolling update | Kubernetes docs, `kind`/`minikube` chạy local, Helm |
| **Observability** | Metrics (Prometheus), tracing phân tán, log tập trung | OpenTelemetry Go SDK, Grafana + Loki + Tempo |
| **Database nâng cao** | Connection pool, transaction, migration, sinh code từ SQL | `pgx`, `sqlc`, `golang-migrate`, `goose` |
| **Kiến trúc** | Tổ chức code lớn, DDD, hexagonal (ports & adapters) | Code của Kubernetes, CockroachDB, HashiCorp Vault |
| **Hiệu năng sâu** | GC tuning (`GOGC`, `GOMEMLIMIT`), execution tracer, PGO (profile-guided optimization) | `go tool trace`, [go.dev/doc/pgo](https://go.dev/doc/pgo) |
| **Bảo mật** | OAuth2/OIDC, JWT, mTLS | `golang.org/x/oauth2`, OWASP Top 10 |

### 📚 Sách & tài liệu nên đọc

- 📖 *The Go Programming Language* - Alan Donovan & Brian Kernighan (kinh điển, nền tảng vững chắc)
- 📖 *Learning Go* (2nd edition) - Jon Bodner (Go hiện đại, có generics, iterators)
- 📖 *100 Go Mistakes and How to Avoid Them* - Teiva Harsanyi (cực kỳ thực tế)
- 📖 *Concurrency in Go* - Katherine Cox-Buday (đào sâu Bài 8, 14)
- 📖 *Let's Go* & *Let's Go Further* - Alex Edwards (web app và API production)
- 🌐 [Effective Go](https://go.dev/doc/effective_go), [Go Code Review Comments](https://go.dev/wiki/CodeReviewComments), [Google Go Style Guide](https://google.github.io/styleguide/go/)
- 🌐 [Go Blog](https://go.dev/blog/) - bài viết của chính Go team về mọi tính năng mới
- 🎥 GopherCon trên YouTube - đặc biệt các bài của Rob Pike, Dave Cheney, Mat Ryer ("How I write HTTP services in Go")

### 💪 Cách tiến bộ nhanh nhất

1. **Xây một dự án thật** mà bạn hoặc người quen sẽ dùng - URL shortener, bot Telegram, công cụ backup...
2. **Đọc code mã nguồn mở**: bắt đầu từ thư viện chuẩn (`net/http`, `encoding/json`), rồi `caddy`, `hugo`, `gitea`
3. **Đóng góp mã nguồn mở**: tìm issue "good first issue" trong các dự án Go
4. **Viết blog / chia sẻ** những gì học được - giải thích cho người khác là cách học sâu nhất
5. **Tham gia cộng đồng**: Gophers Việt Nam, Gophers Slack, r/golang

**Bài tiếp theo**: [Bài 17: Docker cho ứng dụng Go](./17-docker.md)

---

💡 **Lời khuyên cuối cùng**:

- **Đơn giản là sức mạnh** - "Clear is better than clever"
- **Đo trước, tối ưu sau** - benchmark và pprof là bạn thân
- **Mọi thứ đều cần giới hạn** - timeout, kích thước, số lượng, tốc độ
- **Lỗi là giá trị** - bọc ngữ cảnh, dịch ở ranh giới, log một lần
- **Test là tấm lưới an toàn** - `go test -race ./...` trước mỗi lần commit
- **Tự động hóa mọi thứ** - CI, lint, format, quét lỗ hổng

**Chúc bạn trở thành một Gopher xuất sắc! 🐹🚀**
