# 📚 Bài 12: HTTP Client & Web API thực tế

## 🎯 Mục tiêu bài học

- Viết **HTTP client "chuẩn production"**: timeout, tái sử dụng `http.Client`, `context`, header
- Đọc response **đúng cách**: kiểm tra status code, luôn đóng body, giới hạn kích thước
- Cài đặt **retry với exponential backoff** - và biết khi nào **không** được retry
- Gọi REST API bên ngoài, parse JSON, và **test hoàn toàn offline** với `httptest`
- Server nâng cao: **routing Go 1.22**, **middleware chain** (logging, recovery, auth, CORS)
- **Validate request** và trả **lỗi theo định dạng chuẩn**
- Cài đặt **phân trang** (pagination), **upload file**, **graceful shutdown**
- Xây dựng 3 ứng dụng thực tế: **client gọi GitHub API**, **webhook receiver xác thực HMAC**, **dịch vụ rút gọn link**

> 💡 **Kiến thức cần có**: Bài này xây trên [Bài 10](./10-final-project.md) (REST API, `net/http` cơ bản) và [Bài 11](./11-files-json-cli.md) (JSON nâng cao, `io.Reader`). Nếu chưa vững, hãy xem lại hai bài đó trước.

> 💡 **Tất cả ví dụ trong bài đều chạy offline**: Thay vì gọi API thật trên internet (có thể chậm, đổi dữ liệu, giới hạn số lần gọi), ta dùng `httptest.NewServer` để dựng một **server giả** ngay trong chương trình. Đây cũng chính là cách các lập trình viên Go chuyên nghiệp **viết test** cho code gọi API.

## 📖 1. HTTP Client - Đừng dùng `http.Get` trên production!

### Vấn đề của `http.Get`

`http.Get(url)` dùng `http.DefaultClient` - một client **không có timeout**. Nếu server bên kia bị treo, goroutine của bạn sẽ **chờ mãi mãi**. Với một web server nhận 1000 request/giây, chỉ vài phút là cạn tài nguyên.

> 💡 **Ví von**: Gọi điện cho nhà cung cấp mà không đặt giới hạn thời gian chờ - nếu họ "để máy đó" rồi đi mất, bạn sẽ cầm máy **cả ngày** và không làm được gì khác. Timeout là "chờ tối đa 10 giây, không ai nghe thì cúp máy, làm việc khác".

### Tạo client với timeout

```go
package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"time"
)

func main() {
	// Server giả: /fast trả lời ngay, /slow ngủ 2 giây
	mux := http.NewServeMux()
	mux.HandleFunc("GET /fast", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, "xin chào từ server")
	})
	mux.HandleFunc("GET /slow", func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-time.After(2 * time.Second):
		case <-r.Context().Done(): // Client đã bỏ đi → dừng sớm
		}
	})
	srv := httptest.NewServer(mux) // Chạy trên cổng ngẫu nhiên, vd http://127.0.0.1:41234
	defer srv.Close()

	// ✅ Tạo MỘT client, có timeout, dùng lại cho mọi request
	client := &http.Client{Timeout: 500 * time.Millisecond}

	resp, err := client.Get(srv.URL + "/fast")
	if err != nil {
		fmt.Println("Lỗi:", err)
		return
	}
	defer resp.Body.Close() // ❗ LUÔN đóng body
	body, _ := io.ReadAll(resp.Body)
	fmt.Println(resp.StatusCode, string(body))

	start := time.Now()
	_, err = client.Get(srv.URL + "/slow")
	fmt.Println("Có lỗi:", err != nil)
	fmt.Println("Là timeout:", errors.Is(err, context.DeadlineExceeded))
	fmt.Println("Chờ dưới 1 giây:", time.Since(start) < time.Second)
}

// Output:
// 200 xin chào từ server
// Có lỗi: true
// Là timeout: true
// Chờ dưới 1 giây: true
```

`Client.Timeout` tính **toàn bộ** thời gian: kết nối + gửi request + chờ header + **đọc hết body**.

### Tại sao phải tái sử dụng `http.Client`?

Mỗi `http.Client` có một `Transport` giữ **bể kết nối** (connection pool). Mở kết nối TCP + bắt tay TLS (HTTPS) tốn hàng chục đến hàng trăm mili giây. Khi dùng lại client, request sau **tái sử dụng kết nối cũ** (keep-alive) → nhanh hơn rất nhiều.

> 💡 **Ví von**: Mỗi lần tạo client mới giống mỗi chuyến đi lại **mua một chiếc xe mới**. Dùng lại client giống có **một đội xe** sẵn trong gara - cần là lấy ra chạy ngay.

```go
// ❌ Tạo client mới cho mỗi request → không tái sử dụng kết nối, rò rỉ tài nguyên
func fetch(url string) { c := &http.Client{}; c.Get(url) }

// ✅ Tạo một lần (biến package hoặc field của struct), dùng chung - http.Client an toàn cho nhiều goroutine
var apiClient = &http.Client{
	Timeout: 10 * time.Second,
	Transport: &http.Transport{
		MaxIdleConns:        100,              // Tổng số kết nối rảnh giữ lại
		MaxIdleConnsPerHost: 10,               // Mặc định chỉ 2! Tăng lên nếu gọi nhiều tới cùng 1 host
		IdleConnTimeout:     90 * time.Second, // Đóng kết nối rảnh quá lâu
		TLSHandshakeTimeout: 5 * time.Second,
	},
}
```

> ⚠️ Kết nối chỉ được **trả về pool** khi bạn **đọc hết body và đóng nó**. Quên `resp.Body.Close()` = rò rỉ kết nối, lâu dần chương trình sẽ hết file descriptor.

## 📖 2. Request đầy đủ: context, header, query, body JSON

Trong thực tế bạn cần kiểm soát nhiều hơn `client.Get`: gắn **context** (để hủy theo request của người dùng), thêm **header** (xác thực, định dạng), **query string**, gửi **body JSON**. Công cụ: `http.NewRequestWithContext` + `client.Do`.

```go
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"net/url"
	"time"
)

func main() {
	// Server giả "soi gương": trả lại những gì nó nhận được
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		fmt.Fprintf(w, "method=%s path=%s\n", r.Method, r.URL.Path)
		fmt.Fprintf(w, "query q=%q page=%q\n", r.URL.Query().Get("q"), r.URL.Query().Get("page"))
		fmt.Fprintf(w, "auth=%q content-type=%q\n", r.Header.Get("Authorization"), r.Header.Get("Content-Type"))
		fmt.Fprintf(w, "body=%s\n", body)
	}))
	defer srv.Close()

	client := &http.Client{Timeout: 5 * time.Second}

	// Context có hạn chót 3 giây - thường lấy từ r.Context() của request đang xử lý
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	// 1. Tạo query string an toàn (tự mã hóa ký tự đặc biệt, dấu tiếng Việt)
	q := url.Values{}
	q.Set("q", "bàn phím & chuột")
	q.Set("page", "2")
	u := srv.URL + "/api/search?" + q.Encode()

	// 2. Body JSON
	payload, _ := json.Marshal(map[string]any{"name": "An", "age": 25})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, u, bytes.NewReader(payload))
	if err != nil {
		log.Fatal(err)
	}
	// 3. Header
	req.Header.Set("Authorization", "Bearer secret-token")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "bai12-demo/1.0") // Nhiều API (GitHub) BẮT BUỘC có User-Agent

	resp, err := client.Do(req)
	if err != nil {
		log.Fatal(err)
	}
	defer resp.Body.Close()
	out, _ := io.ReadAll(resp.Body)
	fmt.Print(string(out))
	fmt.Println("encoded query:", q.Encode())
}

// Output:
// method=POST path=/api/search
// query q="bàn phím & chuột" page="2"
// auth="Bearer secret-token" content-type="application/json"
// body={"age":25,"name":"An"}
// encoded query: page=2&q=b%C3%A0n+ph%C3%ADm+%26+chu%E1%BB%99t
```

> ⚠️ **Không bao giờ tự nối chuỗi** để tạo query: `"?q=" + keyword`. Nếu `keyword` chứa `&` hay `#`, URL sẽ bị hiểu sai (thậm chí thành lỗ hổng bảo mật). Luôn dùng `url.Values` + `Encode()`, hoặc `url.QueryEscape`.

## 📖 3. Đọc response đúng cách ⭐

### Status code 4xx/5xx KHÔNG phải là `err`!

Đây là hiểu lầm phổ biến nhất: `client.Do` chỉ trả `err` khi **không nói chuyện được** với server (mất mạng, timeout, DNS sai...). Server trả `404` hay `500` vẫn là "nói chuyện thành công" → `err == nil`. **Bạn phải tự kiểm tra `resp.StatusCode`.**

| Tình huống | `err` | `resp.StatusCode` |
|------------|-------|-------------------|
| Thành công | `nil` | `200`, `201`... |
| Server báo không tìm thấy | `nil` ⚠️ | `404` |
| Server lỗi | `nil` ⚠️ | `500`, `503` |
| Timeout, mất mạng, sai DNS | **khác nil** | (không có `resp`) |

### Một hàm `doJSON` dùng cho mọi request

Thay vì lặp lại "gửi → kiểm tra status → đọc body → đóng → decode" ở khắp nơi, hãy gom vào **một hàm**:

```go
package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"time"
)

// APIError mô tả lỗi server trả về (status 4xx/5xx)
type APIError struct {
	StatusCode int
	Message    string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("API lỗi %d: %s", e.StatusCode, e.Message)
}

const maxBody = 1 << 20 // 1MB - không tin tưởng server bên ngoài gửi bao nhiêu cũng đọc

// doJSON gửi request, kiểm tra status, decode JSON vào out
func doJSON(c *http.Client, req *http.Request, out any) error {
	resp, err := c.Do(req)
	if err != nil {
		return fmt.Errorf("gửi request: %w", err)
	}
	defer func() {
		io.Copy(io.Discard, resp.Body) // Đọc nốt phần thừa → kết nối được tái sử dụng
		resp.Body.Close()
	}()

	body := io.LimitReader(resp.Body, maxBody)
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		var e struct {
			Error string `json:"error"`
		}
		msg, _ := io.ReadAll(body)
		if json.Unmarshal(msg, &e) == nil && e.Error != "" {
			return &APIError{StatusCode: resp.StatusCode, Message: e.Error}
		}
		return &APIError{StatusCode: resp.StatusCode, Message: string(msg)}
	}
	if out == nil {
		return nil
	}
	if err := json.NewDecoder(body).Decode(out); err != nil {
		return fmt.Errorf("đọc JSON: %w", err)
	}
	return nil
}

type Product struct {
	ID    int    `json:"id"`
	Name  string `json:"name"`
	Price int64  `json:"price"`
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /products/1", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"id":1,"name":"Bàn phím","price":1250000}`)
	})
	mux.HandleFunc("GET /products/99", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		fmt.Fprint(w, `{"error":"không tìm thấy sản phẩm"}`)
	})
	mux.HandleFunc("GET /boom", func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
	})
	srv := httptest.NewServer(mux)
	defer srv.Close()
	client := &http.Client{Timeout: 5 * time.Second}

	for _, path := range []string{"/products/1", "/products/99", "/boom"} {
		req, _ := http.NewRequest(http.MethodGet, srv.URL+path, nil)
		var p Product
		err := doJSON(client, req, &p)

		var apiErr *APIError
		switch {
		case err == nil:
			fmt.Printf("✅ %s → %+v\n", path, p)
		case errors.As(err, &apiErr) && apiErr.StatusCode == http.StatusNotFound:
			fmt.Printf("🔍 %s → không có: %s\n", path, apiErr.Message)
		default:
			fmt.Printf("❌ %s → %v\n", path, err)
		}
	}
}

// Output:
// ✅ /products/1 → {ID:1 Name:Bàn phím Price:1250000}
// 🔍 /products/99 → không có: không tìm thấy sản phẩm
// ❌ /boom → API lỗi 500: Internal Server Error
```

**Điểm đáng chú ý**:

- `defer` ngay sau khi có `resp` → mọi nhánh `return` đều đóng body
- `io.LimitReader` bảo vệ bạn khỏi server trả về response "khổng lồ" (vô tình hoặc cố ý)
- `*APIError` là **kiểu lỗi tùy chỉnh** ([Bài 7](./07-error-handling.md)) → người gọi dùng `errors.As` để phân loại xử lý: 404 thì báo "không có", 5xx thì retry...

## 📖 4. Retry với Exponential Backoff ⭐

### Khi nào nên thử lại?

Mạng không hoàn hảo: server bên kia có thể đang khởi động lại, quá tải tạm thời, hay mạng chập chờn. Thử lại **đúng cách** giúp hệ thống bền bỉ hơn nhiều.

| Tình huống | Retry? | Lý do |
|------------|:------:|-------|
| Lỗi mạng, timeout kết nối | ✅ | Có thể chỉ là chập chờn |
| `429 Too Many Requests` | ✅ | Chờ theo header `Retry-After` |
| `502`, `503`, `504` | ✅ | Server tạm thời quá tải/đang khởi động |
| `500 Internal Server Error` | ⚠️ | Tùy - thường là bug, thử lại cũng lỗi |
| `400`, `401`, `403`, `404`, `422` | ❌ | Lỗi do **request của bạn** - thử 100 lần vẫn sai |
| Context bị hủy | ❌ | Người dùng đã bỏ đi |

> ⚠️ **Idempotent (lặp lại an toàn)**: `GET`, `PUT`, `DELETE` gọi nhiều lần cho kết quả như gọi một lần. `POST` (tạo đơn hàng, chuyển tiền) **không** - retry `POST` có thể tạo **2 đơn hàng**! Chỉ retry `POST` khi API hỗ trợ **Idempotency-Key** (như Stripe).

### Exponential backoff + jitter

- **Exponential backoff**: lần 1 chờ 100ms, lần 2 chờ 200ms, lần 3 chờ 400ms... (nhân đôi) → cho server thời gian hồi phục
- **Jitter** (ngẫu nhiên hóa): cộng thêm một khoảng ngẫu nhiên → tránh 10.000 client **cùng lúc** thử lại đúng một thời điểm (hiệu ứng "đàn gia súc chạy loạn" - *thundering herd*)

> 💡 **Ví von**: Gọi tổng đài báo bận. Bạn không bấm gọi lại liên tục mỗi giây (làm tổng đài nghẽn thêm), mà chờ 1 phút, rồi 2 phút, rồi 4 phút... Và mỗi người chờ lệch nhau một chút, để không phải cả nghìn người cùng gọi lại đúng 9:00:00.

```go
package main

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync/atomic"
	"time"
)

// retryable quyết định lỗi/status nào đáng thử lại
func retryable(resp *http.Response, err error) bool {
	if err != nil {
		// Context bị hủy/hết hạn bởi NGƯỜI GỌI → không thử lại
		return !errors.Is(err, context.Canceled) && !errors.Is(err, context.DeadlineExceeded)
	}
	switch resp.StatusCode {
	case http.StatusTooManyRequests, http.StatusBadGateway,
		http.StatusServiceUnavailable, http.StatusGatewayTimeout:
		return true
	}
	return false
}

// getWithRetry gọi GET tối đa maxAttempts lần với exponential backoff + jitter
func getWithRetry(ctx context.Context, c *http.Client, url string, maxAttempts int) (*http.Response, error) {
	base := 50 * time.Millisecond
	for attempt := 1; ; attempt++ {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return nil, err
		}
		resp, err := c.Do(req)
		if !retryable(resp, err) || attempt == maxAttempts {
			return resp, err // Thành công, lỗi không đáng retry, hoặc đã hết lượt
		}

		// Tính thời gian chờ: base * 2^(attempt-1), tối đa 2 giây
		wait := min(base<<(attempt-1), 2*time.Second)
		status := "lỗi mạng"
		if resp != nil {
			status = resp.Status
			// Server bảo chờ bao lâu (Retry-After: số giây) → tôn trọng nó
			if s, err := strconv.Atoi(resp.Header.Get("Retry-After")); err == nil {
				wait = time.Duration(s) * time.Second
			}
			resp.Body.Close() // Đóng body của lần thất bại trước khi thử lại
		}
		fmt.Printf("  lần %d: %s → chờ ~%v rồi thử lại\n", attempt, status, wait)
		wait += rand.N(wait / 2) // Jitter: cộng ngẫu nhiên 0-50%

		select {
		case <-time.After(wait):
		case <-ctx.Done(): // Người gọi hủy trong lúc đang chờ → dừng ngay
			return nil, ctx.Err()
		}
	}
}

func main() {
	var calls atomic.Int32
	// Server "ốm": 2 lần đầu trả 503, lần 3 mới khỏe
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if calls.Add(1) <= 2 {
			http.Error(w, "đang bảo trì", http.StatusServiceUnavailable)
			return
		}
		fmt.Fprint(w, "OK")
	}))
	defer srv.Close()
	client := &http.Client{Timeout: 2 * time.Second}
	ctx := context.Background()

	fmt.Println("Gọi server ốm:")
	resp, err := getWithRetry(ctx, client, srv.URL, 5)
	if err != nil {
		fmt.Println("Thất bại:", err)
		return
	}
	resp.Body.Close()
	fmt.Println("Kết quả:", resp.Status, "sau", calls.Load(), "lần gọi")

	// Server trả 404 → không retry
	calls.Store(0)
	notFound := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		http.NotFound(w, r)
	}))
	defer notFound.Close()
	fmt.Println("Gọi URL không tồn tại:")
	resp, _ = getWithRetry(ctx, client, notFound.URL, 5)
	resp.Body.Close()
	fmt.Println("Kết quả:", resp.Status, "sau", calls.Load(), "lần gọi")
}

// Output:
// Gọi server ốm:
//   lần 1: 503 Service Unavailable → chờ ~50ms rồi thử lại
//   lần 2: 503 Service Unavailable → chờ ~100ms rồi thử lại
// Kết quả: 200 OK sau 3 lần gọi
// Gọi URL không tồn tại:
// Kết quả: 404 Not Found sau 1 lần gọi
```

> 💡 Trong dự án thật, bạn có thể dùng thư viện như `github.com/hashicorp/go-retryablehttp` hoặc `github.com/cenkalti/backoff`. Nhưng tự viết một lần giúp bạn hiểu **tại sao** chúng được thiết kế như vậy.

## 📖 5. `httptest` - Test code HTTP không cần mạng

Bạn đã dùng `httptest` ở mọi ví dụ trên. Tóm tắt hai công cụ chính:

| Công cụ | Làm gì | Dùng để test |
|---------|--------|--------------|
| `httptest.NewServer(handler)` | Chạy server **thật** trên `127.0.0.1:<cổng ngẫu nhiên>` | **Client** của bạn (gọi API bên ngoài) |
| `httptest.NewRecorder()` | Một `ResponseWriter` giả, ghi lại status/header/body | **Handler** của bạn (không cần mở cổng) |
| `httptest.NewRequest(method, url, body)` | Tạo `*http.Request` cho test handler | Handler |

> 💡 **Ví von**: `NewServer` là **sân tập** có đối thủ giả - cầu thủ (client) ra sân đá thật. `NewRecorder` là **máy quay** đặt trước cầu thủ (handler) - ghi lại mọi động tác mà không cần ra sân.

Mẫu test client với server giả (bạn sẽ thấy đầy đủ ở Ứng dụng 1 và 3):

```go
func TestGetProduct(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/products/1" {
			t.Errorf("path = %q; want /products/1", r.URL.Path) // Kiểm tra client gửi ĐÚNG request
		}
		fmt.Fprint(w, `{"id":1,"name":"Bàn phím"}`)
	}))
	defer srv.Close()

	c := NewClient(srv.URL) // ⭐ Client nhận baseURL qua tham số → trỏ vào server giả được
	p, err := c.GetProduct(context.Background(), 1)
	if err != nil || p.Name != "Bàn phím" {
		t.Fatalf("got %+v, %v", p, err)
	}
}
```

> ⭐ **Bí quyết thiết kế**: Đừng viết cứng `"https://api.github.com"` trong code. Cho client nhận **`baseURL`** qua constructor → production truyền URL thật, test truyền `srv.URL`.

## 📖 6. Routing nâng cao với Go 1.22+

Từ Go 1.22, `http.ServeMux` hỗ trợ **method** và **wildcard** trong pattern - đủ mạnh cho hầu hết API mà không cần framework.

| Pattern | Khớp | Ghi chú |
|---------|------|---------|
| `"GET /users/{id}"` | `GET /users/42` | `r.PathValue("id")` → `"42"`. `GET` tự khớp cả `HEAD` |
| `"GET /users/me"` | `GET /users/me` | **Cụ thể hơn** `{id}` → được ưu tiên |
| `"GET /files/{path...}"` | `GET /files/a/b/c.txt` | Wildcard `...` ăn **phần còn lại** của đường dẫn |
| `"GET /{$}"` | Chỉ `GET /` | `{$}` = kết thúc. Thiếu nó, `/` khớp **mọi** đường dẫn |
| `"/static/"` | `/static/...` mọi method | Kết thúc bằng `/` = khớp tiền tố |
| `"api.example.com/"` | Theo host | Hiếm dùng |

```go
package main

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
)

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /{$}", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, "trang chủ")
	})
	mux.HandleFunc("GET /users/{id}", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, "user có id=", r.PathValue("id"))
	})
	mux.HandleFunc("GET /users/me", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, "user đang đăng nhập")
	})
	mux.HandleFunc("POST /users", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
		fmt.Fprint(w, "đã tạo user")
	})
	mux.HandleFunc("GET /files/{path...}", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, "file: ", r.PathValue("path"))
	})

	tests := []struct{ method, path string }{
		{"GET", "/"},
		{"GET", "/abc"},
		{"GET", "/users/42"},
		{"GET", "/users/me"},
		{"POST", "/users"},
		{"DELETE", "/users/42"},
		{"GET", "/files/2026/09/report.pdf"},
	}
	for _, tt := range tests {
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, httptest.NewRequest(tt.method, tt.path, nil))
		body := strings.TrimSpace(rec.Body.String()) // Body lỗi mặc định có "\n" ở cuối
		if allow := rec.Header().Get("Allow"); allow != "" {
			body += " (Allow: " + allow + ")"
		}
		fmt.Printf("%-6s %-26s → %d %s\n", tt.method, tt.path, rec.Code, body)
	}
}

// Output:
// GET    /                          → 200 trang chủ
// GET    /abc                       → 404 404 page not found
// GET    /users/42                  → 200 user có id=42
// GET    /users/me                  → 200 user đang đăng nhập
// POST   /users                     → 201 đã tạo user
// DELETE /users/42                  → 405 Method Not Allowed (Allow: GET, HEAD)
// GET    /files/2026/09/report.pdf  → 200 file: 2026/09/report.pdf
```

**Nhận xét**:

- `/users/me` thắng `/users/{id}` vì **cụ thể hơn** - không phụ thuộc thứ tự đăng ký
- Sai method → mux **tự** trả `405` kèm header `Allow` liệt kê method hợp lệ - chuẩn HTTP
- Body lỗi mặc định là **text thuần** (`404 page not found`). API JSON chuyên nghiệp nên trả lỗi dạng JSON - ta sẽ làm ở mục 8

## 📖 7. Middleware Chain ⭐

### Middleware là gì?

**Middleware** là hàm "bọc" quanh handler để thêm hành vi **chung** cho mọi request: ghi log, bắt panic, kiểm tra đăng nhập, thêm header CORS...

> 💡 **Ví von**: Request đi vào như khách vào **tòa nhà**: qua **bảo vệ** (auth) → **lễ tân ghi sổ** (logging) → **camera an ninh** (recovery) → mới tới **phòng làm việc** (handler). Trên đường ra, response đi ngược lại qua từng lớp. Mỗi lớp là một middleware, có thể **chặn** khách lại (trả 401) hoặc cho đi tiếp.

```text
Request → [Recovery → [Logging → [CORS → [Auth → Handler]]]] → Response
```

Trong Go, middleware có "chữ ký" chuẩn:

```go
type Middleware func(http.Handler) http.Handler
```

Nhận một handler, trả về handler mới "bọc" quanh nó. Nhờ vậy middleware **ghép nối** được với nhau như lắp Lego.

```go
package main

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
)

type Middleware func(http.Handler) http.Handler

// Chain áp dụng middleware theo thứ tự: Chain(h, A, B, C) → A(B(C(h)))
// Request đi qua A trước, rồi B, rồi C, rồi tới h
func Chain(h http.Handler, mws ...Middleware) http.Handler {
	for i := len(mws) - 1; i >= 0; i-- {
		h = mws[i](h)
	}
	return h
}

// statusRecorder "nghe lén" status code mà handler ghi ra
type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

// Unwrap giúp http.ResponseController truy cập writer gốc (Flush, SetDeadline...)
func (r *statusRecorder) Unwrap() http.ResponseWriter { return r.ResponseWriter }

// 1. Logging - ghi lại method, path, status
func Logging(out io.Writer) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(rec, r)
			fmt.Fprintf(out, "  [log] %s %s → %d (req_id=%s)\n", r.Method, r.URL.Path, rec.status, RequestID(r.Context()))
		})
	}
}

// 2. Recovery - bắt panic, trả 500 thay vì làm sập kết nối
func Recovery(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				if err == http.ErrAbortHandler { // Panic "có chủ đích" của net/http → để nguyên
					panic(err)
				}
				fmt.Fprintf(os.Stdout, "  [recovery] panic: %v\n", err) // Thực tế: log kèm stack trace
				http.Error(w, `{"error":"lỗi hệ thống"}`, http.StatusInternalServerError)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// 3. RequestID - gắn mã định danh cho mỗi request (để truy vết log)
type ctxKey string // Kiểu riêng cho key → không đụng key của package khác

const requestIDKey ctxKey = "request_id"

func WithRequestID(next http.Handler) http.Handler {
	var counter int
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("X-Request-ID") // Dùng lại ID từ hệ thống phía trước nếu có
		if id == "" {
			counter++ // (Demo - thực tế dùng UUID/ID ngẫu nhiên và an toàn đồng thời)
			id = fmt.Sprintf("req-%d", counter)
		}
		w.Header().Set("X-Request-ID", id)
		ctx := context.WithValue(r.Context(), requestIDKey, id)
		next.ServeHTTP(w, r.WithContext(ctx)) // Truyền context mới xuống các lớp sau
	})
}

func RequestID(ctx context.Context) string {
	id, _ := ctx.Value(requestIDKey).(string)
	return id
}

// 4. Auth - kiểm tra token "Bearer <token>"
func Auth(validToken string) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
			if !ok || token != validToken {
				w.Header().Set("WWW-Authenticate", "Bearer")
				http.Error(w, `{"error":"chưa đăng nhập"}`, http.StatusUnauthorized)
				return // ❗ CHẶN - không gọi next
			}
			next.ServeHTTP(w, r)
		})
	}
}

// 5. CORS - cho phép frontend ở domain khác gọi API
func CORS(allowed ...string) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			for _, a := range allowed {
				if origin == a {
					w.Header().Set("Access-Control-Allow-Origin", origin)
					w.Header().Set("Vary", "Origin")
					break
				}
			}
			// Trình duyệt gửi "preflight" OPTIONS trước request thật để hỏi quyền
			if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE")
				w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/profile", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, `{"name":"An","req":"%s"}`, RequestID(r.Context()))
	})
	mux.HandleFunc("GET /api/panic", func(w http.ResponseWriter, r *http.Request) {
		var m map[string]int
		m["x"] = 1 // 💥 panic: assignment to entry in nil map
	})

	// Recovery ngoài cùng → bắt được panic của MỌI lớp bên trong
	handler := Chain(mux,
		Recovery,
		WithRequestID,
		Logging(os.Stdout),
		CORS("https://shop.example.com"),
		Auth("secret"),
	)

	send := func(method, path, token, origin string) {
		req := httptest.NewRequest(method, path, nil)
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		if origin != "" {
			req.Header.Set("Origin", origin)
		}
		if method == http.MethodOptions {
			req.Header.Set("Access-Control-Request-Method", "GET")
		}
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		fmt.Printf("%s %s → %d %s | CORS=%q\n", method, path, rec.Code,
			strings.TrimSpace(rec.Body.String()), rec.Header().Get("Access-Control-Allow-Origin"))
	}

	send("GET", "/api/profile", "secret", "https://shop.example.com")
	send("GET", "/api/profile", "sai-token", "")
	send("OPTIONS", "/api/profile", "", "https://shop.example.com")
	send("GET", "/api/profile", "secret", "https://evil.example.com")
	send("GET", "/api/panic", "secret", "")
}

// Output:
//   [log] GET /api/profile → 200 (req_id=req-1)
// GET /api/profile → 200 {"name":"An","req":"req-1"} | CORS="https://shop.example.com"
//   [log] GET /api/profile → 401 (req_id=req-2)
// GET /api/profile → 401 {"error":"chưa đăng nhập"} | CORS=""
//   [log] OPTIONS /api/profile → 204 (req_id=req-3)
// OPTIONS /api/profile → 204  | CORS="https://shop.example.com"
//   [log] GET /api/profile → 200 (req_id=req-4)
// GET /api/profile → 200 {"name":"An","req":"req-4"} | CORS=""
//   [recovery] panic: assignment to entry in nil map
// GET /api/panic → 500 {"error":"lỗi hệ thống"} | CORS=""
```

**Phân tích từng tình huống**:

1. Token đúng, origin hợp lệ → qua hết các lớp, có header CORS
2. Token sai → `Auth` **chặn**, handler không bao giờ chạy; `Logging` vẫn ghi lại status `401`
3. Preflight `OPTIONS` → `CORS` trả lời luôn `204` (đặt **trước** `Auth` vì trình duyệt không gửi token trong preflight)
4. Origin lạ → vẫn trả dữ liệu nhưng **không có** header CORS → **trình duyệt** sẽ chặn trang web độc hại đọc kết quả
5. Handler panic → `Recovery` bắt được, trả `500`. Để ý: dòng `[log]` **không** xuất hiện vì panic "bay" qua `Logging` trước khi nó kịp ghi - đặt `Recovery` bên trong `Logging` nếu muốn log cả request panic

> 💡 **Thứ tự middleware rất quan trọng!** Hãy tự đổi chỗ `CORS` và `Auth` rồi chạy lại để thấy preflight bị trả `401`.

> ⚠️ **Không dùng `http.Error` cho JSON trên production**: nó đặt `Content-Type: text/plain`. Ở ví dụ trên dùng cho gọn; mục tiếp theo sẽ viết hàm `writeError` chuẩn.

## 📖 8. Validation và định dạng lỗi chuẩn

### Vì sao cần định dạng lỗi thống nhất?

Nếu mỗi endpoint trả lỗi một kiểu (`"not found"`, `{"msg":"..."}`, `{"error":{"text":...}}`), frontend phải viết code xử lý riêng cho từng chỗ - cực khổ. Hãy **thống nhất một định dạng** cho toàn bộ API:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Dữ liệu không hợp lệ",
    "details": {"email": "email không hợp lệ", "age": "tuổi phải từ 13 đến 120"}
  }
}
```

- `code`: chuỗi **cố định** cho máy đọc (frontend dùng để rẽ nhánh, dịch đa ngôn ngữ)
- `message`: câu cho **người** đọc
- `details`: lỗi theo từng field → frontend hiện lỗi ngay dưới ô nhập tương ứng

### Đọc JSON an toàn + validate

```go
package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/mail"
	"strings"
)

// ===== Định dạng lỗi chuẩn =====

type APIError struct {
	Status  int               `json:"-"`
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Details map[string]string `json:"details,omitempty"`
}

func (e *APIError) Error() string { return e.Message }

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, err error) {
	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		// Lỗi không lường trước → KHÔNG lộ chi tiết nội bộ cho client
		apiErr = &APIError{Status: 500, Code: "internal", Message: "Lỗi hệ thống"}
	}
	writeJSON(w, apiErr.Status, map[string]any{"error": apiErr})
}

// ===== Đọc JSON an toàn =====

func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) error {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // Tối đa 1MB - chống gửi body khổng lồ
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields() // Field lạ → báo lỗi (bắt lỗi chính tả của client)

	if err := dec.Decode(dst); err != nil {
		var syntaxErr *json.SyntaxError
		var typeErr *json.UnmarshalTypeError
		var maxErr *http.MaxBytesError
		msg := "JSON không hợp lệ"
		switch {
		case errors.As(err, &syntaxErr):
			msg = fmt.Sprintf("JSON sai cú pháp tại vị trí %d", syntaxErr.Offset)
		case errors.As(err, &typeErr):
			msg = fmt.Sprintf("field %q phải là kiểu %s", typeErr.Field, typeErr.Type)
		case strings.HasPrefix(err.Error(), "json: unknown field "):
			msg = "field không được hỗ trợ: " + strings.TrimPrefix(err.Error(), "json: unknown field ")
		case errors.Is(err, io.EOF):
			msg = "body rỗng"
		case errors.As(err, &maxErr):
			return &APIError{Status: 413, Code: "body_too_large", Message: "Body vượt quá 1MB"}
		}
		return &APIError{Status: 400, Code: "bad_json", Message: msg}
	}
	// Body chỉ được chứa MỘT object JSON
	if dec.More() {
		return &APIError{Status: 400, Code: "bad_json", Message: "body chỉ được chứa một object JSON"}
	}
	return nil
}

// ===== Validation =====

// Validator gom TẤT CẢ lỗi thay vì dừng ở lỗi đầu tiên → người dùng sửa một lần là xong
type Validator map[string]string

func (v Validator) Check(ok bool, field, msg string) {
	if !ok {
		if _, exists := v[field]; !exists { // Giữ lỗi đầu tiên của mỗi field
			v[field] = msg
		}
	}
}

func (v Validator) Err() error {
	if len(v) == 0 {
		return nil
	}
	return &APIError{Status: 422, Code: "validation_failed", Message: "Dữ liệu không hợp lệ", Details: v}
}

type SignupRequest struct {
	Email    string `json:"email"`
	Name     string `json:"name"`
	Age      int    `json:"age"`
	Password string `json:"password"`
}

func (s *SignupRequest) Validate() error {
	s.Email = strings.TrimSpace(strings.ToLower(s.Email)) // Chuẩn hóa trước khi kiểm tra
	s.Name = strings.TrimSpace(s.Name)

	v := Validator{}
	_, err := mail.ParseAddress(s.Email)
	v.Check(s.Email != "", "email", "email là bắt buộc")
	v.Check(err == nil, "email", "email không hợp lệ")
	v.Check(s.Name != "", "name", "tên là bắt buộc")
	v.Check(len([]rune(s.Name)) <= 50, "name", "tên tối đa 50 ký tự")
	v.Check(s.Age >= 13 && s.Age <= 120, "age", "tuổi phải từ 13 đến 120")
	v.Check(len(s.Password) >= 8, "password", "mật khẩu tối thiểu 8 ký tự")
	return v.Err()
}

func signup(w http.ResponseWriter, r *http.Request) {
	var req SignupRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, err)
		return
	}
	if err := req.Validate(); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"email": req.Email, "name": req.Name})
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /signup", signup)

	bodies := []string{
		`{"email":" An@Mail.com ","name":"An","age":25,"password":"12345678"}`,
		`{"email":"an@","name":"","age":7,"password":"123"}`,
		`{"email":"an@mail.com","name":"An","age":"hai lăm"}`,
		`{"email":"an@mail.com","nmae":"An"}`,
		`{"email": "an@mail.com",`,
		``,
	}
	for _, b := range bodies {
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, httptest.NewRequest("POST", "/signup", strings.NewReader(b)))
		fmt.Printf("%d %s", rec.Code, rec.Body.String())
	}
}

// Output:
// 201 {"email":"an@mail.com","name":"An"}
// 422 {"error":{"code":"validation_failed","message":"Dữ liệu không hợp lệ","details":{"age":"tuổi phải từ 13 đến 120","email":"email không hợp lệ","name":"tên là bắt buộc","password":"mật khẩu tối thiểu 8 ký tự"}}}
// 400 {"error":{"code":"bad_json","message":"field \"age\" phải là kiểu int"}}
// 400 {"error":{"code":"bad_json","message":"field không được hỗ trợ: \"nmae\""}}
// 400 {"error":{"code":"bad_json","message":"JSON không hợp lệ"}}
// 400 {"error":{"code":"bad_json","message":"body rỗng"}}
```

**Vì sao `400` và `422` khác nhau?**

- `400 Bad Request`: request **không đọc được** (JSON hỏng, sai kiểu)
- `422 Unprocessable Entity`: đọc được nhưng **dữ liệu vi phạm quy tắc nghiệp vụ** (email sai định dạng, tuổi âm)

Nhiều API chỉ dùng `400` cho cả hai - cũng không sao, miễn **nhất quán**.

> 💡 JSON bị cắt giữa chừng (`{"email": "an@mail.com",`) trả về lỗi `unexpected EOF` - không phải `*json.SyntaxError`, nên rơi vào thông báo chung. Bạn có thể thêm nhánh `errors.Is(err, io.ErrUnexpectedEOF)` để báo rõ hơn.

## 📖 9. Phân trang (Pagination)

Không API nào trả **toàn bộ** 1 triệu bản ghi trong một response. Có hai kiểu phân trang phổ biến:

| Kiểu | Request | Ưu điểm | Nhược điểm |
|------|---------|---------|------------|
| **Offset** | `?page=3&limit=20` | Dễ hiểu, nhảy tới trang bất kỳ | Chậm với trang sâu (DB phải bỏ qua N dòng); dữ liệu bị lệch khi có bản ghi mới chen vào |
| **Cursor** | `?after=abc123&limit=20` | Nhanh, ổn định với dữ liệu thay đổi liên tục | Không nhảy tới "trang 50" được |

> 💡 **Ví von**: Offset giống nói "mở sách tới **trang 50**" - nếu ai đó chèn thêm trang vào đầu sách, trang 50 giờ là nội dung khác. Cursor giống **kẹp bookmark** - "đọc tiếp từ chỗ kẹp", sách có thêm trang phía trước cũng không sao. Facebook, Twitter dùng cursor cho news feed.

```go
package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
)

type Page[T any] struct {
	Data []T      `json:"data"`
	Meta PageMeta `json:"meta"`
}

type PageMeta struct {
	Page       int `json:"page"`
	Limit      int `json:"limit"`
	Total      int `json:"total"`
	TotalPages int `json:"total_pages"`
}

// parsePagination đọc ?page=&limit= với giá trị mặc định và giới hạn trên
func parsePagination(r *http.Request) (page, limit int, err error) {
	page, limit = 1, 10 // Mặc định
	if s := r.URL.Query().Get("page"); s != "" {
		if page, err = strconv.Atoi(s); err != nil || page < 1 {
			return 0, 0, fmt.Errorf("page phải là số nguyên ≥ 1")
		}
	}
	if s := r.URL.Query().Get("limit"); s != "" {
		if limit, err = strconv.Atoi(s); err != nil || limit < 1 {
			return 0, 0, fmt.Errorf("limit phải là số nguyên ≥ 1")
		}
	}
	limit = min(limit, 100) // ❗ Chặn trên: không cho client xin 1 triệu dòng một lần
	return page, limit, nil
}

func paginate[T any](items []T, page, limit int) Page[T] {
	total := len(items)
	start := min((page-1)*limit, total)
	end := min(start+limit, total)
	return Page[T]{
		Data: items[start:end],
		Meta: PageMeta{Page: page, Limit: limit, Total: total, TotalPages: (total + limit - 1) / limit},
	}
}

func main() {
	var products []string
	for i := 1; i <= 23; i++ {
		products = append(products, fmt.Sprintf("SP%02d", i))
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /products", func(w http.ResponseWriter, r *http.Request) {
		page, limit, err := parsePagination(r)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(paginate(products, page, limit))
	})

	for _, q := range []string{"", "?page=3&limit=10", "?page=2&limit=5", "?page=9", "?limit=500", "?page=0"} {
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, httptest.NewRequest("GET", "/products"+q, nil))
		fmt.Printf("%-18s %d %s", q, rec.Code, rec.Body.String())
	}
}

// Output:
//                    200 {"data":["SP01","SP02","SP03","SP04","SP05","SP06","SP07","SP08","SP09","SP10"],"meta":{"page":1,"limit":10,"total":23,"total_pages":3}}
// ?page=3&limit=10   200 {"data":["SP21","SP22","SP23"],"meta":{"page":3,"limit":10,"total":23,"total_pages":3}}
// ?page=2&limit=5    200 {"data":["SP06","SP07","SP08","SP09","SP10"],"meta":{"page":2,"limit":5,"total":23,"total_pages":5}}
// ?page=9            200 {"data":[],"meta":{"page":9,"limit":10,"total":23,"total_pages":3}}
// ?limit=500         200 {"data":["SP01","SP02","SP03","SP04","SP05","SP06","SP07","SP08","SP09","SP10","SP11","SP12","SP13","SP14","SP15","SP16","SP17","SP18","SP19","SP20","SP21","SP22","SP23"],"meta":{"page":1,"limit":100,"total":23,"total_pages":1}}
// ?page=0            400 page phải là số nguyên ≥ 1
```

> 💡 Trang vượt quá (`?page=9`) trả `"data":[]` chứ không phải `null` - vì `items[23:23]` là slice **rỗng nhưng không nil**. Frontend sẽ cảm ơn bạn! Với database, phân trang được làm bằng `LIMIT ? OFFSET ?` - xem [Bài 13](./13-database-sql.md).

## 📖 10. Upload file

Upload file dùng định dạng **`multipart/form-data`** - cùng định dạng với `<form enctype="multipart/form-data">` trong HTML. Những điều **bắt buộc** khi nhận file từ người dùng:

1. **Giới hạn kích thước** (`http.MaxBytesReader`) - không thì ai đó upload file 50GB làm đầy ổ đĩa
2. **Kiểm tra loại file thật** bằng nội dung (`http.DetectContentType`), **không tin** phần đuôi tên file hay header `Content-Type` client gửi
3. **Không dùng tên file của client** để lưu: tên `../../etc/passwd` có thể ghi đè file hệ thống (*path traversal*). Tự đặt tên mới

```go
package main

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync/atomic"
)

const maxUpload = 1 << 20 // 1MB

var allowedTypes = map[string]string{ // content type → phần mở rộng
	"image/png":  ".png",
	"image/jpeg": ".jpg",
	"image/gif":  ".gif",
}

func uploadHandler(dir string) http.HandlerFunc {
	var seq atomic.Int64
	return func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, maxUpload+1024) // +1KB cho phần header của form
		if err := r.ParseMultipartForm(maxUpload); err != nil {
			var maxErr *http.MaxBytesError
			if errors.As(err, &maxErr) {
				http.Error(w, "file quá lớn (tối đa 1MB)", http.StatusRequestEntityTooLarge)
				return
			}
			http.Error(w, "form không hợp lệ", http.StatusBadRequest)
			return
		}
		file, header, err := r.FormFile("avatar") // "avatar" = tên field trong form
		if err != nil {
			http.Error(w, "thiếu field 'avatar'", http.StatusBadRequest)
			return
		}
		defer file.Close()

		// Đọc 512 byte đầu để "đánh hơi" loại file thật
		head := make([]byte, 512)
		n, _ := io.ReadFull(file, head)
		contentType := http.DetectContentType(head[:n])
		ext, ok := allowedTypes[contentType]
		if !ok {
			http.Error(w, "chỉ nhận ảnh PNG/JPEG/GIF, bạn gửi: "+contentType, http.StatusUnsupportedMediaType)
			return
		}

		// Tự đặt tên file - KHÔNG dùng header.Filename
		name := fmt.Sprintf("avatar-%d%s", seq.Add(1), ext)
		dst, err := os.Create(filepath.Join(dir, name))
		if err != nil {
			http.Error(w, "lỗi lưu file", http.StatusInternalServerError)
			return
		}
		defer dst.Close()
		// Ghi lại 512 byte đã đọc + phần còn lại
		size, err := io.Copy(dst, io.MultiReader(bytes.NewReader(head[:n]), file))
		if err != nil {
			http.Error(w, "lỗi lưu file", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusCreated)
		fmt.Fprintf(w, "đã lưu %s (%d byte, tên gốc %q)", name, size, header.Filename)
	}
}

// upload là phía CLIENT: tạo body multipart và gửi lên
func upload(url, filename string, content []byte) {
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	mw.WriteField("user_id", "42") // Field văn bản thường
	part, _ := mw.CreateFormFile("avatar", filename)
	part.Write(content)
	mw.Close() // ❗ Ghi dòng kết thúc form - quên là server báo form hỏng

	resp, err := http.Post(url, mw.FormDataContentType(), &body) // Content-Type kèm "boundary"
	if err != nil {
		fmt.Println("lỗi:", err)
		return
	}
	defer resp.Body.Close()
	msg, _ := io.ReadAll(resp.Body)
	fmt.Printf("%-22s → %d %s\n", filename, resp.StatusCode, bytes.TrimSpace(msg))
}

func main() {
	dir, _ := os.MkdirTemp("", "uploads-*")
	defer os.RemoveAll(dir)

	mux := http.NewServeMux()
	mux.HandleFunc("POST /avatar", uploadHandler(dir))
	srv := httptest.NewServer(mux)
	defer srv.Close()

	png := append([]byte("\x89PNG\r\n\x1a\n"), make([]byte, 2000)...) // "Chữ ký" của file PNG
	upload(srv.URL+"/avatar", "me.png", png)
	upload(srv.URL+"/avatar", "../../etc/passwd.png", png)
	upload(srv.URL+"/avatar", "virus.png", []byte("#!/bin/sh\nrm -rf /"))
	upload(srv.URL+"/avatar", "huge.png", append(png, make([]byte, 2<<20)...))

	entries, _ := os.ReadDir(dir)
	for _, e := range entries {
		fmt.Println("📁", e.Name())
	}
}

// Output:
// me.png                 → 201 đã lưu avatar-1.png (2008 byte, tên gốc "me.png")
// ../../etc/passwd.png   → 201 đã lưu avatar-2.png (2008 byte, tên gốc "passwd.png")
// virus.png              → 415 chỉ nhận ảnh PNG/JPEG/GIF, bạn gửi: text/plain; charset=utf-8
// huge.png               → 413 file quá lớn (tối đa 1MB)
// 📁 avatar-1.png
// 📁 avatar-2.png
```

> 💡 Để ý dòng 2: Go đã tự "làm sạch" tên file thành `passwd.png` (bỏ phần đường dẫn). Dù vậy, **đừng bao giờ dựa vào đó** - tự đặt tên file là cách an toàn nhất.

## 📖 11. Graceful Shutdown và cấu hình server production

Ở [Bài 10](./10-final-project.md) bạn đã làm quen với graceful shutdown. Đây là "khung" server chuẩn production mà bạn có thể copy cho mọi dự án:

```go
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	if err := run(); err != nil {
		slog.Error("server dừng với lỗi", "err", err)
		os.Exit(1)
	}
}

func run() error {
	logger := slog.New(slog.NewTextHandler(os.Stderr, nil))

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, "ok")
	})
	mux.HandleFunc("GET /slow", func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(3 * time.Second) // Giả lập request xử lý lâu
		fmt.Fprintln(w, "xong việc chậm")
	})

	srv := &http.Server{
		Addr:              ":8080",
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,  // Chống tấn công Slowloris (gửi header rất chậm)
		ReadTimeout:       10 * time.Second, // Thời gian tối đa đọc cả request
		WriteTimeout:      30 * time.Second, // Thời gian tối đa ghi response
		IdleTimeout:       60 * time.Second, // Đóng kết nối keep-alive rảnh
		MaxHeaderBytes:    1 << 20,
	}

	// Context bị hủy khi nhận Ctrl+C (SIGINT) hoặc SIGTERM (Docker/Kubernetes gửi khi dừng container)
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	errCh := make(chan error, 1)
	go func() {
		logger.Info("server đang chạy", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err // Lỗi thật (vd: cổng đã bị chiếm)
		}
		close(errCh)
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
		logger.Info("nhận tín hiệu dừng, đang chờ các request đang xử lý...")
	}

	// Cho các request đang dở tối đa 10 giây để hoàn thành
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("shutdown: %w", err)
	}
	logger.Info("đã dừng an toàn")
	return nil
}
```

Thử nghiệm: chạy server, gọi `/slow` rồi **ngay lập tức** nhấn Ctrl+C:

```bash
$ go run . &
$ curl localhost:8080/slow &     # Request mất 3 giây
$ kill -INT %1                    # Gửi Ctrl+C khi request đang chạy
time=... level=INFO msg="server đang chạy" addr=:8080
time=... level=INFO msg="nhận tín hiệu dừng, đang chờ các request đang xử lý..."
xong việc chậm                    ← Request vẫn được trả lời đầy đủ!
time=... level=INFO msg="đã dừng an toàn"
```

**Vì sao quan trọng?** Mỗi lần deploy phiên bản mới, server cũ bị dừng. Không có graceful shutdown → người dùng đang thanh toán dở bị **cắt ngang** → lỗi, mất đơn hàng. Với graceful shutdown, server **ngừng nhận** request mới nhưng **hoàn thành** request đang xử lý.

### 💡 Tips quan trọng

- ✅ **Một `http.Client` dùng chung**, luôn có `Timeout`; truyền `context` từ request vào các lời gọi ra ngoài
- ✅ **Luôn `defer resp.Body.Close()`**, kiểm tra `StatusCode`, giới hạn kích thước body đọc vào
- ✅ **Client nhận `baseURL`** qua constructor → test được bằng `httptest.NewServer`
- ✅ Retry chỉ với lỗi **tạm thời** và request **idempotent**, có backoff + jitter + giới hạn số lần
- ✅ Server: **luôn** đặt các timeout, `MaxBytesReader` cho body, graceful shutdown
- ✅ Một định dạng lỗi JSON **thống nhất** cho toàn bộ API, không lộ lỗi nội bộ ra ngoài
- ⚠️ Không log token, mật khẩu, header `Authorization`

## 🌍 Ứng dụng thực tế

### Ứng dụng 1: Client gọi GitHub API (test offline)

**Bài toán**: Viết package client lấy thông tin user và danh sách repository từ GitHub API, sắp xếp repo theo số sao. Client phải xử lý: 404 (user không tồn tại), **rate limit** (GitHub giới hạn số lần gọi/giờ, trả `403` hoặc `429` kèm header `X-RateLimit-Reset`), timeout.

**Thiết kế**:
- `Client` struct với `baseURL`, `token`, `*http.Client` → production dùng `https://api.github.com`, demo/test dùng server giả
- Lỗi được phân loại: `ErrNotFound` (sentinel), `*RateLimitError` (kiểu lỗi mang thêm thông tin thời điểm reset)
- Mọi method nhận `context.Context` làm tham số đầu tiên

```go
package main

import (
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"slices"
	"strconv"
	"time"
)

// ===================== Package client (thực tế nằm ở internal/github) =====================

var ErrNotFound = errors.New("không tìm thấy")

type RateLimitError struct {
	ResetAt time.Time
}

func (e *RateLimitError) Error() string {
	return "vượt giới hạn gọi API, thử lại lúc " + e.ResetAt.UTC().Format("15:04:05")
}

type User struct {
	Login       string `json:"login"`
	Name        string `json:"name"`
	PublicRepos int    `json:"public_repos"`
	Followers   int    `json:"followers"`
}

type Repo struct {
	Name     string `json:"name"`
	Stars    int    `json:"stargazers_count"`
	Language string `json:"language"`
	Fork     bool   `json:"fork"`
}

type Client struct {
	baseURL string
	token   string
	http    *http.Client
}

func NewClient(baseURL, token string) *Client {
	return &Client{
		baseURL: baseURL,
		token:   token,
		http:    &http.Client{Timeout: 10 * time.Second},
	}
}

// get là hàm dùng chung: tạo request, gắn header, kiểm tra status, decode JSON
func (c *Client) get(ctx context.Context, path string, query url.Values, out any) error {
	u := c.baseURL + path
	if len(query) > 0 {
		u += "?" + query.Encode()
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "bai12-github-client")
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("GET %s: %w", path, err)
	}
	defer resp.Body.Close()

	switch {
	case resp.StatusCode == http.StatusNotFound:
		return fmt.Errorf("GET %s: %w", path, ErrNotFound)
	case (resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusTooManyRequests) &&
		resp.Header.Get("X-RateLimit-Remaining") == "0":
		reset, _ := strconv.ParseInt(resp.Header.Get("X-RateLimit-Reset"), 10, 64)
		return &RateLimitError{ResetAt: time.Unix(reset, 0)}
	case resp.StatusCode != http.StatusOK:
		msg, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("GET %s: status %d: %s", path, resp.StatusCode, msg)
	}
	return json.NewDecoder(io.LimitReader(resp.Body, 10<<20)).Decode(out)
}

func (c *Client) GetUser(ctx context.Context, login string) (*User, error) {
	var u User
	if err := c.get(ctx, "/users/"+url.PathEscape(login), nil, &u); err != nil {
		return nil, err
	}
	return &u, nil
}

// TopRepos trả về n repo (không phải fork) nhiều sao nhất
func (c *Client) TopRepos(ctx context.Context, login string, n int) ([]Repo, error) {
	var repos []Repo
	q := url.Values{"per_page": {"100"}, "type": {"owner"}}
	if err := c.get(ctx, "/users/"+url.PathEscape(login)+"/repos", q, &repos); err != nil {
		return nil, err
	}
	repos = slices.DeleteFunc(repos, func(r Repo) bool { return r.Fork })
	slices.SortFunc(repos, func(a, b Repo) int { return cmp.Compare(b.Stars, a.Stars) })
	return repos[:min(n, len(repos))], nil
}

// ===================== Server giả mô phỏng GitHub =====================

func fakeGitHub() *httptest.Server {
	users := map[string]User{
		"gopher": {Login: "gopher", Name: "Gopher Việt", PublicRepos: 4, Followers: 1200},
	}
	repos := map[string][]Repo{
		"gopher": {
			{Name: "todo-api", Stars: 150, Language: "Go"},
			{Name: "awesome-go-vn", Stars: 980, Language: "Markdown"},
			{Name: "gin", Stars: 80000, Language: "Go", Fork: true},
			{Name: "logstat", Stars: 320, Language: "Go"},
		},
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /users/{login}", func(w http.ResponseWriter, r *http.Request) {
		login := r.PathValue("login")
		if login == "spammer" { // Giả lập bị rate limit
			w.Header().Set("X-RateLimit-Remaining", "0")
			w.Header().Set("X-RateLimit-Reset", "1790000000")
			w.WriteHeader(http.StatusForbidden)
			return
		}
		u, ok := users[login]
		if !ok {
			http.Error(w, `{"message":"Not Found"}`, http.StatusNotFound)
			return
		}
		json.NewEncoder(w).Encode(u)
	})
	mux.HandleFunc("GET /users/{login}/repos", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("User-Agent") == "" || r.URL.Query().Get("per_page") != "100" {
			http.Error(w, "bad request", http.StatusBadRequest) // Kiểm tra client gửi đúng
			return
		}
		json.NewEncoder(w).Encode(repos[r.PathValue("login")])
	})
	return httptest.NewServer(mux)
}

// ===================== Chương trình chính =====================

func main() {
	srv := fakeGitHub()
	defer srv.Close()

	// Production: NewClient("https://api.github.com", os.Getenv("GITHUB_TOKEN"))
	gh := NewClient(srv.URL, "test-token")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	for _, login := range []string{"gopher", "khong-ton-tai", "spammer"} {
		fmt.Printf("🔎 %s\n", login)
		u, err := gh.GetUser(ctx, login)

		var rl *RateLimitError
		switch {
		case errors.Is(err, ErrNotFound):
			fmt.Println("   ❓ user không tồn tại")
			continue
		case errors.As(err, &rl):
			fmt.Println("   ⏳", rl)
			continue
		case err != nil:
			fmt.Println("   ❌", err)
			continue
		}
		fmt.Printf("   👤 %s (%d repo, %d followers)\n", u.Name, u.PublicRepos, u.Followers)

		repos, err := gh.TopRepos(ctx, login, 3)
		if err != nil {
			fmt.Println("   ❌", err)
			continue
		}
		for i, r := range repos {
			fmt.Printf("   %d. ⭐ %-6d %-15s %s\n", i+1, r.Stars, r.Name, r.Language)
		}
	}
}

// Output:
// 🔎 gopher
//    👤 Gopher Việt (4 repo, 1200 followers)
//    1. ⭐ 980    awesome-go-vn   Markdown
//    2. ⭐ 320    logstat         Go
//    3. ⭐ 150    todo-api        Go
// 🔎 khong-ton-tai
//    ❓ user không tồn tại
// 🔎 spammer
//    ⏳ vượt giới hạn gọi API, thử lại lúc 14:13:20
```

> 💡 **Thử với GitHub thật**: thay `NewClient(srv.URL, ...)` bằng `NewClient("https://api.github.com", "")` và gọi `gh.GetUser(ctx, "golang")`. Không có token bạn được gọi 60 lần/giờ; có token (tạo ở GitHub → Settings → Developer settings) được 5000 lần/giờ.

> 💡 **API thời tiết**: Cấu trúc hoàn toàn tương tự - chỉ đổi `baseURL` (vd `https://api.open-meteo.com`), struct kết quả và query (`latitude`, `longitude`). Đó là sức mạnh của việc tách hàm `get` dùng chung.

### Ứng dụng 2: Webhook receiver xác thực chữ ký HMAC

**Bài toán**: Cổng thanh toán (Stripe, MoMo, VNPay...) hoặc GitHub gọi **webhook** tới server của bạn khi có sự kiện: "đơn hàng #123 đã thanh toán". Nhưng URL webhook là **công khai** - kẻ xấu có thể giả mạo request "đã thanh toán" để lấy hàng miễn phí! Làm sao biết request **thật sự** từ cổng thanh toán?

**Giải pháp: chữ ký HMAC**. Bạn và cổng thanh toán cùng giữ một **khóa bí mật** (secret). Khi gửi, họ tính `HMAC-SHA256(secret, timestamp + "." + body)` và gửi kèm trong header. Bạn tính lại với secret của mình và so sánh.

> 💡 **Ví von**: HMAC giống **con dấu giáp lai** chỉ hai bên có. Kẻ gian có thể đọc nội dung thư, nhưng không có con dấu thì không làm giả được, và nếu **sửa dù một chữ** trong thư thì dấu sẽ không khớp nữa.

**Các lớp bảo vệ**:
1. **Chữ ký HMAC** → xác thực người gửi và nội dung không bị sửa
2. **So sánh thời gian hằng định** (`hmac.Equal`) → chống tấn công đo thời gian (*timing attack*)
3. **Timestamp** trong chữ ký, từ chối nếu lệch > 5 phút → chống **phát lại** (*replay attack*: kẻ gian bắt được một request hợp lệ và gửi lại)
4. **Delivery ID** đã xử lý thì bỏ qua → **idempotent** (cổng thanh toán có thể gửi lại cùng một sự kiện nhiều lần)

```go
package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"time"
)

const tolerance = 5 * time.Minute

// sign tính chữ ký: HMAC-SHA256(secret, "<timestamp>.<body>") dạng hex
func sign(secret []byte, ts string, body []byte) string {
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(ts + "."))
	mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil))
}

type WebhookHandler struct {
	secret []byte
	now    func() time.Time // Tiêm "đồng hồ" để test được

	mu        sync.Mutex
	processed map[string]bool // delivery ID đã xử lý (thực tế: lưu DB/Redis có TTL)
}

func (h *WebhookHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// 1. Đọc body THÔ (tối đa 64KB) - phải xác thực trên đúng từng byte nhận được
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 64<<10))
	if err != nil {
		http.Error(w, "body quá lớn", http.StatusRequestEntityTooLarge)
		return
	}

	// 2. Kiểm tra timestamp
	ts := r.Header.Get("X-Webhook-Timestamp")
	sec, err := strconv.ParseInt(ts, 10, 64)
	if err != nil {
		http.Error(w, "thiếu timestamp", http.StatusBadRequest)
		return
	}
	if age := h.now().Sub(time.Unix(sec, 0)); age > tolerance || age < -tolerance {
		http.Error(w, "timestamp quá cũ/không hợp lệ", http.StatusUnauthorized)
		return
	}

	// 3. Kiểm tra chữ ký
	got, ok := strings.CutPrefix(r.Header.Get("X-Webhook-Signature"), "sha256=")
	gotBytes, err := hex.DecodeString(got)
	if !ok || err != nil {
		http.Error(w, "thiếu chữ ký", http.StatusUnauthorized)
		return
	}
	want, _ := hex.DecodeString(sign(h.secret, ts, body))
	if !hmac.Equal(gotBytes, want) { // ❗ KHÔNG dùng == hay bytes.Equal
		http.Error(w, "chữ ký sai", http.StatusUnauthorized)
		return
	}

	// 4. Chống xử lý trùng
	id := r.Header.Get("X-Delivery-ID")
	h.mu.Lock()
	dup := h.processed[id]
	h.processed[id] = true
	h.mu.Unlock()
	if dup {
		w.WriteHeader(http.StatusOK) // Vẫn trả 200 để bên gửi không gửi lại nữa
		fmt.Fprint(w, "đã xử lý trước đó, bỏ qua")
		return
	}

	// 5. Chữ ký hợp lệ → giờ mới tin và parse JSON
	var event struct {
		Type    string `json:"type"`
		OrderID int    `json:"order_id"`
		Amount  int64  `json:"amount"`
	}
	if err := json.Unmarshal(body, &event); err != nil {
		http.Error(w, "JSON không hợp lệ", http.StatusBadRequest)
		return
	}
	// Thực tế: đẩy vào hàng đợi xử lý nền, trả 200 thật NHANH (bên gửi thường timeout sau vài giây)
	fmt.Fprintf(w, "OK: %s đơn #%d số tiền %d", event.Type, event.OrderID, event.Amount)
}

// ===== Phía người gửi (mô phỏng cổng thanh toán) =====

type delivery struct {
	name   string
	id     string
	secret string
	ts     time.Time
	body   string
	tamper string // Nếu khác rỗng: kẻ gian thay body SAU khi đã ký
	noSig  bool
}

func send(url string, d delivery) {
	ts := strconv.FormatInt(d.ts.Unix(), 10)
	sig := sign([]byte(d.secret), ts, []byte(d.body))
	body := d.body
	if d.tamper != "" {
		body = d.tamper
	}
	req, _ := http.NewRequest(http.MethodPost, url, bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Webhook-Timestamp", ts)
	req.Header.Set("X-Delivery-ID", d.id)
	if !d.noSig {
		req.Header.Set("X-Webhook-Signature", "sha256="+sig)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Println("lỗi:", err)
		return
	}
	defer resp.Body.Close()
	msg, _ := io.ReadAll(resp.Body)
	fmt.Printf("%-24s → %d %s\n", d.name, resp.StatusCode, strings.TrimSpace(string(msg)))
}

func main() {
	secret := "whsec_bi_mat_chi_hai_ben_biet"
	h := &WebhookHandler{secret: []byte(secret), now: time.Now, processed: map[string]bool{}}
	srv := httptest.NewServer(h)
	defer srv.Close()

	now := time.Now()
	paid := `{"type":"payment.succeeded","order_id":123,"amount":1250000}`
	for _, d := range []delivery{
		{name: "Hợp lệ", id: "evt_1", secret: secret, ts: now, body: paid},
		{name: "Gửi lại (trùng ID)", id: "evt_1", secret: secret, ts: now, body: paid},
		{name: "Sửa số tiền sau khi ký", id: "evt_2", secret: secret, ts: now, body: paid,
			tamper: `{"type":"payment.succeeded","order_id":123,"amount":1}`},
		{name: "Sai secret", id: "evt_3", secret: "doan-bua", ts: now, body: paid},
		{name: "Phát lại sau 10 phút", id: "evt_4", secret: secret, ts: now.Add(-10 * time.Minute), body: paid},
		{name: "Không có chữ ký", id: "evt_5", secret: secret, ts: now, body: paid, noSig: true},
	} {
		send(srv.URL, d)
	}
}

// Output:
// Hợp lệ                   → 200 OK: payment.succeeded đơn #123 số tiền 1250000
// Gửi lại (trùng ID)       → 200 đã xử lý trước đó, bỏ qua
// Sửa số tiền sau khi ký   → 401 chữ ký sai
// Sai secret               → 401 chữ ký sai
// Phát lại sau 10 phút     → 401 timestamp quá cũ/không hợp lệ
// Không có chữ ký          → 401 thiếu chữ ký
```

> ⚠️ **Tại sao không dùng `==` để so sánh chữ ký?** `==` dừng ngay ở byte **đầu tiên khác nhau**. Kẻ tấn công đo thời gian phản hồi có thể đoán dần từng byte của chữ ký đúng. `hmac.Equal` luôn so sánh **hết** các byte, thời gian không phụ thuộc dữ liệu.

> 💡 GitHub dùng header `X-Hub-Signature-256: sha256=<hex>` (ký trên body), Stripe dùng `Stripe-Signature: t=<ts>,v1=<hex>` (ký trên `ts.body` - giống ví dụ này). Đọc tài liệu của từng nhà cung cấp để biết chính xác định dạng.

### Ứng dụng 3: Dịch vụ rút gọn link (URL shortener)

**Bài toán**: Xây dựng dịch vụ kiểu bit.ly: gửi link dài, nhận link ngắn; truy cập link ngắn → chuyển hướng tới link gốc và đếm lượt click.

| Method | Đường dẫn | Chức năng | Auth |
|--------|-----------|-----------|:----:|
| `POST` | `/api/links` | Tạo link ngắn `{"url": "...", "alias": "tuy-chon"}` | 🔒 |
| `GET` | `/api/links?page=&limit=` | Danh sách link (phân trang) | 🔒 |
| `GET` | `/api/links/{code}` | Thống kê một link | 🔒 |
| `DELETE` | `/api/links/{code}` | Xóa link | 🔒 |
| `GET` | `/{code}` | Chuyển hướng `302` tới link gốc | |

Kết hợp **mọi thứ** trong bài: routing Go 1.22, middleware chain, validation, lỗi JSON chuẩn, phân trang, graceful shutdown, `httptest`.

**File `main.go`**:

```go
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"os/signal"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

// ============ Store ============

type Link struct {
	Code      string    `json:"code"`
	URL       string    `json:"url"`
	Clicks    int       `json:"clicks"`
	CreatedAt time.Time `json:"created_at"`
}

var (
	ErrNotFound  = errors.New("link không tồn tại")
	ErrCodeTaken = errors.New("mã đã được sử dụng")
)

type Store struct {
	mu    sync.Mutex
	links map[string]*Link
	order []string // Giữ thứ tự tạo để phân trang ổn định
	seq   uint64
}

func NewStore() *Store { return &Store{links: map[string]*Link{}} }

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

// base62 đổi số thành chuỗi ngắn: 125 → "21"
func base62(n uint64) string {
	if n == 0 {
		return "0"
	}
	var b []byte
	for n > 0 {
		b = append([]byte{alphabet[n%62]}, b...)
		n /= 62
	}
	return string(b)
}

func (s *Store) Create(rawURL, alias string) (Link, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	code := alias
	if code == "" {
		for { // Sinh mã tự động, bỏ qua mã trùng với alias người dùng đã đặt
			s.seq++
			code = base62(s.seq + 3843) // Bắt đầu từ "100" cho đẹp (3844 = 62²)
			if _, taken := s.links[code]; !taken {
				break
			}
		}
	} else if _, taken := s.links[code]; taken {
		return Link{}, ErrCodeTaken
	}
	l := &Link{Code: code, URL: rawURL, CreatedAt: time.Now().UTC()}
	s.links[code] = l
	s.order = append(s.order, code)
	return *l, nil // Trả BẢN SAO - bên ngoài không sửa được dữ liệu trong store
}

// Resolve trả link gốc và tăng click (dùng khi chuyển hướng)
func (s *Store) Resolve(code string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	l, ok := s.links[code]
	if !ok {
		return "", ErrNotFound
	}
	l.Clicks++
	return l.URL, nil
}

func (s *Store) Get(code string) (Link, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	l, ok := s.links[code]
	if !ok {
		return Link{}, ErrNotFound
	}
	return *l, nil
}

func (s *Store) Delete(code string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.links[code]; !ok {
		return ErrNotFound
	}
	delete(s.links, code)
	for i, c := range s.order {
		if c == code {
			s.order = append(s.order[:i], s.order[i+1:]...)
			break
		}
	}
	return nil
}

func (s *Store) List(offset, limit int) ([]Link, int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	total := len(s.order)
	out := []Link{}
	for i := offset; i < min(offset+limit, total); i++ {
		out = append(out, *s.links[s.order[i]])
	}
	return out, total
}

// ============ HTTP helpers ============

type apiError struct {
	status  int
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Details map[string]string `json:"details,omitempty"`
}

func (e *apiError) Error() string { return e.Message }

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, err error) {
	var e *apiError
	switch {
	case errors.As(err, &e):
	case errors.Is(err, ErrNotFound):
		e = &apiError{status: 404, Code: "not_found", Message: err.Error()}
	case errors.Is(err, ErrCodeTaken):
		e = &apiError{status: 409, Code: "conflict", Message: err.Error()}
	default:
		log.Printf("lỗi nội bộ: %v", err)
		e = &apiError{status: 500, Code: "internal", Message: "lỗi hệ thống"}
	}
	writeJSON(w, e.status, map[string]any{"error": e})
}

// ============ Handlers ============

var aliasRe = regexp.MustCompile(`^[a-zA-Z0-9_-]{3,30}$`)

type Server struct {
	store   *Store
	baseURL string // vd: https://go.vn - dùng để tạo short_url
}

type createReq struct {
	URL   string `json:"url"`
	Alias string `json:"alias"`
}

func (req *createReq) validate() error {
	details := map[string]string{}
	u, err := url.ParseRequestURI(strings.TrimSpace(req.URL))
	switch {
	case req.URL == "":
		details["url"] = "url là bắt buộc"
	case err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "":
		details["url"] = "url phải bắt đầu bằng http:// hoặc https:// và có tên miền"
	case len(req.URL) > 2048:
		details["url"] = "url tối đa 2048 ký tự"
	}
	if req.Alias != "" && !aliasRe.MatchString(req.Alias) {
		details["alias"] = "alias gồm 3-30 ký tự: chữ, số, - hoặc _"
	}
	if req.Alias == "api" || req.Alias == "health" { // Tránh đè lên route hệ thống
		details["alias"] = "alias này đã được hệ thống dùng"
	}
	if len(details) > 0 {
		return &apiError{status: 422, Code: "validation_failed", Message: "dữ liệu không hợp lệ", Details: details}
	}
	return nil
}

func (s *Server) createLink(w http.ResponseWriter, r *http.Request) {
	var req createReq
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		writeError(w, &apiError{status: 400, Code: "bad_json", Message: "JSON không hợp lệ: " + err.Error()})
		return
	}
	if err := req.validate(); err != nil {
		writeError(w, err)
		return
	}
	link, err := s.store.Create(strings.TrimSpace(req.URL), req.Alias)
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Location", "/api/links/"+link.Code)
	writeJSON(w, http.StatusCreated, map[string]any{
		"code": link.Code, "url": link.URL, "short_url": s.baseURL + "/" + link.Code,
	})
}

func (s *Server) listLinks(w http.ResponseWriter, r *http.Request) {
	page, limit := 1, 20
	var err error
	if v := r.URL.Query().Get("page"); v != "" {
		if page, err = strconv.Atoi(v); err != nil || page < 1 {
			writeError(w, &apiError{status: 400, Code: "bad_query", Message: "page phải là số nguyên ≥ 1"})
			return
		}
	}
	if v := r.URL.Query().Get("limit"); v != "" {
		if limit, err = strconv.Atoi(v); err != nil || limit < 1 || limit > 100 {
			writeError(w, &apiError{status: 400, Code: "bad_query", Message: "limit phải từ 1 đến 100"})
			return
		}
	}
	links, total := s.store.List((page-1)*limit, limit)
	writeJSON(w, http.StatusOK, map[string]any{
		"data": links,
		"meta": map[string]int{"page": page, "limit": limit, "total": total},
	})
}

func (s *Server) getLink(w http.ResponseWriter, r *http.Request) {
	link, err := s.store.Get(r.PathValue("code"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, link)
}

func (s *Server) deleteLink(w http.ResponseWriter, r *http.Request) {
	if err := s.store.Delete(r.PathValue("code")); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) redirect(w http.ResponseWriter, r *http.Request) {
	target, err := s.store.Resolve(r.PathValue("code"))
	if err != nil {
		http.NotFound(w, r) // Người dùng cuối mở bằng trình duyệt → trang lỗi thường là đủ
		return
	}
	// 302 (Found): trình duyệt KHÔNG cache → mọi click đều về server → đếm được
	// 301 (Moved Permanently) sẽ bị cache → click lần sau không qua server nữa
	http.Redirect(w, r, target, http.StatusFound)
}

// ============ Middleware ============

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func logging(out io.Writer, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rec := &statusRecorder{ResponseWriter: w, status: 200}
		next.ServeHTTP(rec, r)
		fmt.Fprintf(out, "   [log] %s %s → %d\n", r.Method, r.URL.RequestURI(), rec.status)
	})
}

func recovery(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				if v == http.ErrAbortHandler {
					panic(v)
				}
				writeError(w, fmt.Errorf("panic: %v", v))
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func requireToken(token string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		got, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
		if !ok || got != token {
			writeError(w, &apiError{status: 401, Code: "unauthorized", Message: "thiếu hoặc sai token"})
			return
		}
		next(w, r)
	}
}

// Routes lắp ráp toàn bộ ứng dụng - dùng chung cho main và test
func (s *Server) Routes(token string, logOut io.Writer) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/links", requireToken(token, s.createLink))
	mux.HandleFunc("GET /api/links", requireToken(token, s.listLinks))
	mux.HandleFunc("GET /api/links/{code}", requireToken(token, s.getLink))
	mux.HandleFunc("DELETE /api/links/{code}", requireToken(token, s.deleteLink))
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("GET /{code}", s.redirect)
	return recovery(logging(logOut, mux))
}

// ============ main ============

func main() {
	addr := flag.String("addr", "", "địa chỉ lắng nghe, vd :8080 (để trống = chạy demo)")
	flag.Parse()

	token := os.Getenv("API_TOKEN")
	if token == "" {
		token = "dev-token"
	}

	if *addr == "" {
		demo(token)
		return
	}
	if err := serve(*addr, token); err != nil {
		log.Fatal(err)
	}
}

func serve(addr, token string) error {
	s := &Server{store: NewStore(), baseURL: "http://localhost" + addr}
	srv := &http.Server{
		Addr:              addr,
		Handler:           s.Routes(token, os.Stderr),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		srv.Shutdown(shutdownCtx)
	}()
	log.Printf("URL shortener chạy tại %s", addr)
	if err := srv.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	log.Println("đã dừng an toàn")
	return nil
}

// demo gửi một loạt request tới server chạy bằng httptest
func demo(token string) {
	s := &Server{store: NewStore(), baseURL: "https://go.vn"}
	srv := httptest.NewServer(s.Routes(token, os.Stdout))
	defer srv.Close()

	client := &http.Client{
		Timeout: 5 * time.Second,
		// Không tự đi theo redirect → để thấy được status 302 và header Location
		CheckRedirect: func(req *http.Request, via []*http.Request) error { return http.ErrUseLastResponse },
	}
	call := func(method, path, tok, body string) {
		req, _ := http.NewRequest(method, srv.URL+path, strings.NewReader(body))
		if tok != "" {
			req.Header.Set("Authorization", "Bearer "+tok)
		}
		resp, err := client.Do(req)
		if err != nil {
			fmt.Println("lỗi:", err)
			return
		}
		defer resp.Body.Close()
		b, _ := io.ReadAll(resp.Body)
		extra := ""
		if loc := resp.Header.Get("Location"); resp.StatusCode == http.StatusFound {
			extra = " Location: " + loc
		}
		fmt.Printf("%s %s → %d%s %s\n\n", method, path, resp.StatusCode, extra, strings.TrimSpace(string(b)))
	}

	call("POST", "/api/links", token, `{"url":"https://go.dev/doc/effective_go"}`)
	call("POST", "/api/links", token, `{"url":"https://pkg.go.dev/net/http","alias":"nethttp"}`)
	call("POST", "/api/links", token, `{"url":"https://example.com","alias":"nethttp"}`)
	call("POST", "/api/links", token, `{"url":"javascript:alert(1)","alias":"x"}`)
	call("POST", "/api/links", "", `{"url":"https://go.dev"}`)
	call("GET", "/nethttp", "", "")
	call("GET", "/nethttp", "", "")
	call("GET", "/khong-co", "", "")
	call("GET", "/api/links/nethttp", token, "")
	call("GET", "/api/links?limit=1&page=2", token, "")
}
```

Chạy demo:

```bash
go run .
```

```text
   [log] POST /api/links → 201
POST /api/links → 201 {"code":"100","short_url":"https://go.vn/100","url":"https://go.dev/doc/effective_go"}

   [log] POST /api/links → 201
POST /api/links → 201 {"code":"nethttp","short_url":"https://go.vn/nethttp","url":"https://pkg.go.dev/net/http"}

   [log] POST /api/links → 409
POST /api/links → 409 {"error":{"code":"conflict","message":"mã đã được sử dụng"}}

   [log] POST /api/links → 422
POST /api/links → 422 {"error":{"code":"validation_failed","message":"dữ liệu không hợp lệ","details":{"alias":"alias gồm 3-30 ký tự: chữ, số, - hoặc _","url":"url phải bắt đầu bằng http:// hoặc https:// và có tên miền"}}}

   [log] POST /api/links → 401
POST /api/links → 401 {"error":{"code":"unauthorized","message":"thiếu hoặc sai token"}}

   [log] GET /nethttp → 302
GET /nethttp → 302 Location: https://pkg.go.dev/net/http <a href="https://pkg.go.dev/net/http">Found</a>.

   [log] GET /nethttp → 302
GET /nethttp → 302 Location: https://pkg.go.dev/net/http <a href="https://pkg.go.dev/net/http">Found</a>.

   [log] GET /khong-co → 404
GET /khong-co → 404 404 page not found

   [log] GET /api/links/nethttp → 200
GET /api/links/nethttp → 200 {"code":"nethttp","url":"https://pkg.go.dev/net/http","clicks":2,"created_at":"2026-09-25T08:30:00.123456Z"}

   [log] GET /api/links?limit=1&page=2 → 200
GET /api/links?limit=1&page=2 → 200 {"data":[{"code":"nethttp","url":"https://pkg.go.dev/net/http","clicks":2,"created_at":"2026-09-25T08:30:00.123456Z"}],"meta":{"limit":1,"page":2,"total":2}}
```

(Giá trị `created_at` sẽ là thời điểm bạn chạy.)

Chạy như một server thật và thử bằng `curl`:

```bash
API_TOKEN=bi-mat go run . -addr :8080

# Terminal khác:
curl -X POST localhost:8080/api/links -H "Authorization: Bearer bi-mat" \
     -d '{"url":"https://go.dev","alias":"godev"}'
curl -i localhost:8080/godev        # HTTP/1.1 302 Found, Location: https://go.dev
```

**File `main_test.go`** - test toàn bộ luồng qua `httptest.NewRecorder`:

```go
package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

const testToken = "test-token"

func newTestHandler() http.Handler {
	s := &Server{store: NewStore(), baseURL: "https://go.vn"}
	return s.Routes(testToken, io.Discard) // Bỏ log trong test cho gọn
}

func do(t *testing.T, h http.Handler, method, path, body string, auth bool) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if auth {
		req.Header.Set("Authorization", "Bearer "+testToken)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestCreateAndRedirect(t *testing.T) {
	h := newTestHandler()

	rec := do(t, h, "POST", "/api/links", `{"url":"https://go.dev","alias":"godev"}`, true)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create: status = %d; body = %s", rec.Code, rec.Body)
	}
	var created struct {
		ShortURL string `json:"short_url"`
	}
	json.NewDecoder(rec.Body).Decode(&created)
	if created.ShortURL != "https://go.vn/godev" {
		t.Errorf("short_url = %q", created.ShortURL)
	}

	for range 3 {
		rec = do(t, h, "GET", "/godev", "", false)
		if rec.Code != http.StatusFound || rec.Header().Get("Location") != "https://go.dev" {
			t.Fatalf("redirect: status = %d, Location = %q", rec.Code, rec.Header().Get("Location"))
		}
	}

	rec = do(t, h, "GET", "/api/links/godev", "", true)
	var link Link
	json.NewDecoder(rec.Body).Decode(&link)
	if link.Clicks != 3 {
		t.Errorf("clicks = %d; want 3", link.Clicks)
	}
}

func TestCreateErrors(t *testing.T) {
	tests := []struct {
		name     string
		body     string
		auth     bool
		wantCode int
		wantErr  string
	}{
		{"không có token", `{"url":"https://go.dev"}`, false, 401, "unauthorized"},
		{"JSON hỏng", `{"url":`, true, 400, "bad_json"},
		{"field lạ", `{"link":"https://go.dev"}`, true, 400, "bad_json"},
		{"thiếu url", `{}`, true, 422, "validation_failed"},
		{"scheme nguy hiểm", `{"url":"javascript:alert(1)"}`, true, 422, "validation_failed"},
		{"alias quá ngắn", `{"url":"https://go.dev","alias":"a"}`, true, 422, "validation_failed"},
		{"alias hệ thống", `{"url":"https://go.dev","alias":"api"}`, true, 422, "validation_failed"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := do(t, newTestHandler(), "POST", "/api/links", tt.body, tt.auth)
			var resp struct {
				Error struct {
					Code string `json:"code"`
				} `json:"error"`
			}
			json.NewDecoder(rec.Body).Decode(&resp)
			if rec.Code != tt.wantCode || resp.Error.Code != tt.wantErr {
				t.Errorf("got %d %q; want %d %q", rec.Code, resp.Error.Code, tt.wantCode, tt.wantErr)
			}
		})
	}
}

func TestDuplicateAliasAndDelete(t *testing.T) {
	h := newTestHandler()
	do(t, h, "POST", "/api/links", `{"url":"https://go.dev","alias":"dup"}`, true)
	if rec := do(t, h, "POST", "/api/links", `{"url":"https://x.dev","alias":"dup"}`, true); rec.Code != 409 {
		t.Errorf("trùng alias: status = %d; want 409", rec.Code)
	}
	if rec := do(t, h, "DELETE", "/api/links/dup", "", true); rec.Code != 204 {
		t.Errorf("delete: status = %d; want 204", rec.Code)
	}
	if rec := do(t, h, "GET", "/dup", "", false); rec.Code != 404 {
		t.Errorf("sau khi xóa: status = %d; want 404", rec.Code)
	}
}
```

```bash
$ go test -race -v ./...
=== RUN   TestCreateAndRedirect
--- PASS: TestCreateAndRedirect (0.00s)
=== RUN   TestCreateErrors
=== RUN   TestCreateErrors/không_có_token
...
--- PASS: TestCreateErrors (0.00s)
=== RUN   TestDuplicateAliasAndDelete
--- PASS: TestDuplicateAliasAndDelete (0.00s)
PASS
ok  	shortener	1.035s
```

> 💡 **Bảo mật**: validate scheme `http`/`https` là **bắt buộc** - nếu cho phép `javascript:alert(1)`, link rút gọn của bạn thành công cụ tấn công XSS. Dịch vụ thật còn kiểm tra link với danh sách website lừa đảo (Google Safe Browsing).

## ⚠️ Lỗi thường gặp

### Lỗi 1: Dùng `http.Get` / `http.DefaultClient` không có timeout

Server bên kia treo → goroutine của bạn treo theo mãi mãi. ✅ `&http.Client{Timeout: 10 * time.Second}`.

### Lỗi 2: Quên đóng body, hoặc đóng trước khi kiểm tra `err`

```go
resp, err := client.Get(url)
defer resp.Body.Close() // ❌ err != nil thì resp == nil → panic!
if err != nil { return err }

resp, err := client.Get(url)
if err != nil { return err }
defer resp.Body.Close() // ✅ Sau khi kiểm tra err
```

### Lỗi 3: Coi status 4xx/5xx là thành công

```go
resp, err := client.Get(url)
if err != nil { return err }
json.NewDecoder(resp.Body).Decode(&user) // ❌ Nếu 404/500, body là trang lỗi → decode lỗi khó hiểu hoặc user rỗng
```

✅ Luôn kiểm tra `resp.StatusCode` trước khi decode.

### Lỗi 4: Tạo `http.Client` mới cho mỗi request

Mất lợi ích connection pool, mỗi request tốn thêm TCP + TLS handshake. ✅ Tạo một lần, dùng chung (an toàn cho nhiều goroutine).

### Lỗi 5: Retry request không idempotent

Retry `POST /payments` sau timeout → khách bị **trừ tiền hai lần**. ✅ Chỉ retry `GET`/`PUT`/`DELETE`, hoặc dùng `Idempotency-Key`.

### Lỗi 6: Sai thứ tự middleware

`Auth` đặt ngoài `CORS` → preflight `OPTIONS` (không có token) bị `401` → trình duyệt chặn mọi request. `Recovery` đặt trong cùng → không bắt được panic của các middleware bên ngoài. ✅ Suy nghĩ kỹ "request đi qua lớp nào trước".

### Lỗi 7: Dùng kiểu `string` làm key của `context.WithValue`

```go
ctx = context.WithValue(ctx, "user", u) // ❌ Dễ đụng key của package khác (go vet cảnh báo)
type ctxKey string
ctx = context.WithValue(ctx, ctxKey("user"), u) // ✅ Kiểu riêng, không ai đụng được
```

### Lỗi 8: So sánh chữ ký/token bằng `==`

✅ Dùng `hmac.Equal` hoặc `subtle.ConstantTimeCompare` để chống timing attack.

### Lỗi 9: Tin tên file và Content-Type của client khi upload

✅ Tự đặt tên file, dùng `http.DetectContentType` để kiểm tra nội dung thật, giới hạn kích thước bằng `MaxBytesReader`.

### Lỗi 10: Lộ lỗi nội bộ ra ngoài

```go
http.Error(w, err.Error(), 500) // ❌ "pq: password authentication failed for user admin" → lộ thông tin cho kẻ tấn công
```

✅ Log chi tiết ở server, trả client thông báo chung `"lỗi hệ thống"` kèm request ID để tra cứu.

## 🏋️ Bài tập

### Bài tập 1: Client API thời tiết (⭐ Dễ)

Viết `WeatherClient` với method `Current(ctx, city string) (*Weather, error)` gọi `GET /v1/current?city=...` và trả về nhiệt độ, độ ẩm, mô tả. Dựng server giả bằng `httptest` trả dữ liệu cho `"hanoi"`, `"hcm"`, và `404` cho thành phố khác. Viết test kiểm tra client gửi **đúng query** và xử lý 404 thành `ErrCityNotFound`.

### Bài tập 2: Middleware đo thời gian & giới hạn tốc độ (⭐⭐ Trung bình)

- `Timing`: thêm header `Server-Timing: app;dur=12.5` (mili giây xử lý)
- `RateLimit(n int, per time.Duration)`: mỗi IP (`r.RemoteAddr`) chỉ được `n` request mỗi `per`, vượt quá trả `429` kèm `Retry-After`. Gợi ý: `map[string]*bucket` + `sync.Mutex`, hoặc package `golang.org/x/time/rate`
- Viết test cho cả hai bằng `httptest.NewRecorder`

### Bài tập 3: Retry thông minh hơn (⭐⭐ Trung bình)

Nâng cấp `getWithRetry` thành `DoWithRetry(ctx, client, req, policy)`:
- `policy` gồm `MaxAttempts`, `BaseDelay`, `MaxDelay`
- Hỗ trợ `Retry-After` dạng **ngày giờ** (`Wed, 21 Oct 2026 07:28:00 GMT`) bằng `http.ParseTime`
- Với request có body, dùng `req.GetBody` để tạo lại body cho mỗi lần thử
- Test với server giả đếm số lần gọi, kiểm tra hủy context giữa chừng

### Bài tập 4: Webhook GitHub (⭐⭐ Trung bình)

Viết handler nhận webhook GitHub: xác thực header `X-Hub-Signature-256` (HMAC-SHA256 trên **body**, không có timestamp), đọc `X-GitHub-Event`, và với sự kiện `push` in ra tên nhánh + số commit. Viết test với payload mẫu lấy từ tài liệu GitHub.

### Bài tập 5: Nâng cấp URL shortener (⭐⭐⭐ Nâng cao)

- Thêm `expires_at` (tùy chọn): link hết hạn trả `410 Gone`
- Thống kê click theo ngày: `GET /api/links/{code}/stats` → `{"2026-09-25": 12, ...}`
- Lưu dữ liệu ra file JSON khi shutdown và nạp lại khi khởi động ([Bài 11](./11-files-json-cli.md))
- Viết client Go `shortener.Client` gọi API của chính mình, test bằng `httptest.NewServer(s.Routes(...))`

### Bài tập 6: API Gateway mini (⭐⭐⭐ Nâng cao)

Viết server nhận `GET /api/dashboard/{user}`, gọi **song song** ([Bài 8](./08-concurrency.md)) 3 API giả (thông tin user, đơn hàng gần đây, điểm thưởng), gộp kết quả trả về. Yêu cầu: toàn bộ phải xong trong 2 giây (dùng `context.WithTimeout`); API nào lỗi/chậm thì phần đó trả `null` kèm danh sách `"warnings"` chứ không làm hỏng cả response.

## ✅ Checklist hoàn thành

- [ ] Giải thích được vì sao không dùng `http.Get` trên production
- [ ] Tạo `http.Client` có timeout, dùng lại cho mọi request
- [ ] Tạo request với `http.NewRequestWithContext`, header, `url.Values`, body JSON
- [ ] Luôn đóng body, kiểm tra `StatusCode`, giới hạn kích thước đọc
- [ ] Viết hàm `doJSON` và kiểu lỗi `APIError` dùng `errors.As`
- [ ] Cài đặt retry với exponential backoff + jitter, biết khi nào không retry
- [ ] Test client với `httptest.NewServer`, test handler với `httptest.NewRecorder`
- [ ] Dùng routing Go 1.22: method, `{id}`, `{path...}`, `{$}`, `r.PathValue`
- [ ] Viết middleware logging, recovery, request ID, auth, CORS và ghép bằng `Chain`
- [ ] Validate request, trả lỗi JSON theo định dạng thống nhất
- [ ] Cài đặt phân trang với giá trị mặc định và giới hạn trên
- [ ] Nhận upload file an toàn: giới hạn kích thước, kiểm tra loại file, tự đặt tên
- [ ] Cấu hình timeout cho `http.Server` và graceful shutdown
- [ ] Xác thực webhook bằng HMAC + timestamp + chống trùng
- [ ] Chạy thành công URL shortener và `go test -race`
- [ ] Hoàn thành ít nhất 4 bài tập

## 🚀 Tiếp theo

Các ứng dụng trong bài đều lưu dữ liệu **trong bộ nhớ** - tắt server là mất sạch. Bài tiếp theo sẽ giải quyết vấn đề này với **database**:

- SQL cơ bản cho người mới: `CREATE`, `INSERT`, `SELECT`, `JOIN`, index
- `database/sql`: connection pool, query, transaction, xử lý `NULL`
- Phòng chống SQL injection, repository pattern, migration
- Xây dựng hệ thống quản lý đơn hàng với transaction trừ tồn kho

**Bài tiếp theo**: [Làm việc với Database](./13-database-sql.md)

---

💡 **Tips ghi nhớ**:

- **Timeout ở mọi nơi**: client, server, context - không có timeout là có ngày treo
- **Mở body thì phải đóng**, status code thì phải kiểm tra
- **Retry có kỷ luật**: chỉ lỗi tạm thời, chỉ request idempotent, luôn có backoff
- **`baseURL` qua constructor** → test offline với `httptest`
- **Middleware = các lớp bảo vệ** - thứ tự quyết định hành vi
- **Không tin client**: validate mọi input, giới hạn kích thước, ký và kiểm tra chữ ký
