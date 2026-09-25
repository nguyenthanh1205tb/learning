# 📚 Bài 10: Dự án tổng hợp phần cơ bản - Todo REST API

## 🎯 Mục tiêu bài học

- Tổng hợp **toàn bộ kiến thức** của Phần 1 (Bài 1-9) vào một dự án thực tế
- Hiểu **REST API** là gì và các HTTP method, status code phổ biến
- Xây dựng web server **chỉ với thư viện chuẩn** `net/http`
- Sử dụng **routing pattern mới của Go 1.22**: `"GET /todos/{id}"`
- Đọc/ghi JSON với `encoding/json` và struct tags
- Lưu dữ liệu **in-memory** an toàn với `sync.Mutex`
- Viết **middleware** ghi log bằng closure và embedding
- **Tắt server an toàn** (graceful shutdown) với `context` và signal
- Viết **test cho HTTP handler** với `net/http/httptest`
- Chạy và kiểm thử API bằng `curl`

## 📖 1. Tổng quan dự án

### Chúng ta sẽ xây dựng gì?

Một **REST API quản lý công việc (Todo)** với các chức năng:

| Method | Đường dẫn | Chức năng | Status thành công |
|--------|-----------|-----------|-------------------|
| `GET` | `/health` | Kiểm tra server còn sống | `200 OK` |
| `GET` | `/todos` | Lấy danh sách todo (lọc được `?done=true`) | `200 OK` |
| `POST` | `/todos` | Tạo todo mới | `201 Created` |
| `GET` | `/todos/{id}` | Lấy một todo | `200 OK` |
| `PATCH` | `/todos/{id}` | Cập nhật title và/hoặc trạng thái | `200 OK` |
| `DELETE` | `/todos/{id}` | Xóa todo | `204 No Content` |

### Kiến thức sử dụng từ các bài trước

| Kiến thức | Dùng ở đâu | Bài |
|-----------|-----------|-----|
| Struct, struct tags | `Todo`, request/response | [Bài 6](./06-structs-methods-interfaces.md) |
| Map, slice, `slices.SortFunc` | Lưu trữ và sắp xếp todo | [Bài 5](./05-arrays-slices-maps.md) |
| Method, pointer receiver | `Store`, `Server` | [Bài 6](./06-structs-methods-interfaces.md) |
| Sentinel error, `errors.Is`, `%w` | `ErrNotFound` → 404 | [Bài 7](./07-error-handling.md) |
| `sync.Mutex`, goroutine | Store an toàn đồng thời | [Bài 8](./08-concurrency.md) |
| `context`, signal | Graceful shutdown | [Bài 8](./08-concurrency.md) |
| Closure, hàm là giá trị | Middleware, handler | [Bài 4](./04-functions.md) |
| Embedding | `statusRecorder` bọc `ResponseWriter` | [Bài 6](./06-structs-methods-interfaces.md) |
| Table-driven test, `t.Run` | Test handler | [Bài 9](./09-packages-modules-testing.md) |
| `strconv`, `strings` | Parse ID, validate title | [Bài 2](./02-variables-types.md) |

### Cấu trúc dự án

```text
todo-api/
├── go.mod              ← module todo-api
├── main.go             ← Khởi động server, graceful shutdown
├── todo.go             ← Model Todo + validation
├── store.go            ← Lưu trữ in-memory với sync.Mutex
├── handlers.go         ← HTTP handlers + các hàm hỗ trợ JSON
├── middleware.go       ← Middleware ghi log
├── store_test.go       ← Test cho Store
└── handlers_test.go    ← Test cho HTTP handlers
```

> 💡 Để đơn giản, tất cả file nằm trong **package `main`**. Ở mục "Ý tưởng mở rộng", bạn sẽ tách thành các package riêng (`internal/store`, `internal/handler`...) như dự án thực tế.

## 📖 2. Kiến thức nền: REST API và HTTP

### REST API là gì?

**API** (Application Programming Interface) là "cửa giao tiếp" để các chương trình nói chuyện với nhau. **REST** là một phong cách thiết kế API dựa trên HTTP, trong đó:

- Mỗi **tài nguyên** (resource) có một **URL**: `/todos`, `/todos/1`
- Dùng **HTTP method** để nói **hành động**: `GET` (đọc), `POST` (tạo), `PATCH`/`PUT` (sửa), `DELETE` (xóa)
- Dữ liệu trao đổi thường ở dạng **JSON**
- Kết quả được báo bằng **status code**

> 💡 **Ví von nhà hàng**: Client (khách hàng) gửi **request** (gọi món) tới Server (nhà bếp) theo **menu** (API). Nhà bếp trả về **response** (món ăn) kèm **status** ("Có ngay" = 200, "Đã nhận đơn" = 201, "Hết món này" = 404, "Món không có trong menu" = 400).

### Các status code sẽ dùng

| Code | Tên | Khi nào |
|------|-----|---------|
| `200` | OK | Đọc/sửa thành công |
| `201` | Created | Tạo mới thành công |
| `204` | No Content | Xóa thành công (không có body) |
| `400` | Bad Request | Dữ liệu gửi lên sai (JSON lỗi, title rỗng, id không phải số) |
| `404` | Not Found | Không tìm thấy todo/route |
| `405` | Method Not Allowed | Sai method (ví dụ `PUT /todos/1`) |
| `500` | Internal Server Error | Lỗi phía server không mong đợi |

### Routing pattern của Go 1.22

Trước Go 1.22, `http.ServeMux` rất hạn chế: không phân biệt method, không có tham số trên đường dẫn - mọi người phải dùng thư viện ngoài như `gorilla/mux`, `chi`. Từ **Go 1.22**, `ServeMux` đã mạnh hơn nhiều:

```go
mux.HandleFunc("GET /todos/{id}", handler)   // Chỉ khớp method GET
//              ^^^ ^^^^^^^^^^^^
//            method   {id} là "wildcard" - khớp một đoạn đường dẫn bất kỳ

id := r.PathValue("id") // Lấy giá trị của {id} bên trong handler
```

| Pattern | Khớp với | Không khớp |
|---------|----------|------------|
| `"GET /todos"` | `GET /todos` | `POST /todos`, `GET /todos/1` |
| `"GET /todos/{id}"` | `GET /todos/1`, `GET /todos/abc` | `GET /todos/1/x` |
| `"/static/"` | `/static/`, `/static/a/b.css` (dấu `/` cuối = tiền tố) | `/other` |
| `"GET /files/{path...}"` | `/files/a/b/c` (`{x...}` khớp phần còn lại) | |

✅ Bonus: nếu đường dẫn khớp nhưng **sai method**, Go tự trả về **`405 Method Not Allowed`** kèm header `Allow`. Pattern có `GET` cũng tự động xử lý `HEAD`.

## 📖 3. Bước 1: Khởi tạo dự án

```bash
mkdir todo-api
cd todo-api
go mod init todo-api
```

File `go.mod`:

```text
module todo-api

go 1.24
```

> ⚠️ Routing pattern có method và `{id}` yêu cầu `go 1.22` trở lên trong `go.mod`. Với phiên bản cũ hơn, pattern `"GET /todos"` sẽ bị hiểu sai.

## 📖 4. Bước 2: Model `Todo`

📄 **`todo.go`**

```go
package main

import (
	"errors"
	"strings"
	"time"
	"unicode/utf8"
)

// Todo là một công việc cần làm.
// Struct tag `json:"..."` quy định tên field khi chuyển sang JSON.
type Todo struct {
	ID        int       `json:"id"`
	Title     string    `json:"title"`
	Done      bool      `json:"done"`
	CreatedAt time.Time `json:"created_at"`
}

const maxTitleLength = 200

// Các lỗi validation - dùng errors.Is để kiểm tra.
var (
	ErrEmptyTitle   = errors.New("title không được để trống")
	ErrTitleTooLong = errors.New("title không được dài quá 200 ký tự")
)

// normalizeTitle xóa khoảng trắng thừa và kiểm tra title hợp lệ.
func normalizeTitle(title string) (string, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		return "", ErrEmptyTitle
	}
	if utf8.RuneCountInString(title) > maxTitleLength {
		return "", ErrTitleTooLong
	}
	return title, nil
}
```

**Giải thích**:

- **Struct tags** `json:"created_at"`: khi encode thành JSON, field `CreatedAt` sẽ có tên `created_at` (theo quy ước snake_case của JSON API). Không có tag, tên JSON sẽ là `CreatedAt`
- `time.Time` được encode thành chuỗi chuẩn **RFC 3339**: `"2026-09-25T03:17:46.489Z"`
- Validation đặt ở một hàm riêng để **dùng lại** cho cả tạo mới (POST) và cập nhật (PATCH)
- `utf8.RuneCountInString` đếm **ký tự**, không phải byte - để "Học Go" được tính đúng 6 ký tự ([Bài 2](./02-variables-types.md))

### Thử nghiệm nhanh `encoding/json`

```go
package main

import (
	"encoding/json"
	"fmt"
)

type Todo struct {
	ID    int    `json:"id"`
	Title string `json:"title"`
	Done  bool   `json:"done"`
}

func main() {
	// Struct → JSON (Marshal / Encode)
	t := Todo{ID: 1, Title: "Học Go", Done: false}
	data, _ := json.Marshal(t)
	fmt.Println(string(data))

	// JSON → Struct (Unmarshal / Decode)
	var parsed Todo
	err := json.Unmarshal([]byte(`{"id":2,"title":"Viết API","done":true}`), &parsed)
	fmt.Printf("%+v %v\n", parsed, err)

	// Slice → JSON array
	list, _ := json.Marshal([]Todo{t, parsed})
	fmt.Println(string(list))

	// nil slice → null, slice rỗng → []
	var nilSlice []Todo
	a, _ := json.Marshal(nilSlice)
	b, _ := json.Marshal([]Todo{})
	fmt.Println(string(a), string(b))
}

// Output:
// {"id":1,"title":"Học Go","done":false}
// {ID:2 Title:Viết API Done:true} <nil>
// [{"id":1,"title":"Học Go","done":false},{"id":2,"title":"Viết API","done":true}]
// null []
```

> ⚠️ `encoding/json` chỉ xử lý được **field exported** (chữ HOA). Field `title string` (chữ thường) sẽ bị **bỏ qua âm thầm**!

## 📖 5. Bước 3: Store - Lưu trữ an toàn với `sync.Mutex`

📄 **`store.go`**

```go
package main

import (
	"errors"
	"slices"
	"sync"
	"time"
)

// ErrNotFound được trả về khi không tìm thấy todo theo ID.
var ErrNotFound = errors.New("không tìm thấy todo")

// Store lưu todo trong bộ nhớ (in-memory).
// Mọi method đều khóa mutex vì HTTP server xử lý mỗi request
// trong một goroutine riêng → nhiều goroutine cùng truy cập map.
type Store struct {
	mu     sync.Mutex
	todos  map[int]Todo
	nextID int
}

// NewStore tạo một Store rỗng, sẵn sàng sử dụng.
func NewStore() *Store {
	return &Store{
		todos:  make(map[int]Todo),
		nextID: 1,
	}
}

// Create thêm todo mới và trả về todo đã được gán ID.
func (s *Store) Create(title string) Todo {
	s.mu.Lock()
	defer s.mu.Unlock()

	todo := Todo{
		ID:        s.nextID,
		Title:     title,
		Done:      false,
		CreatedAt: time.Now().UTC(),
	}
	s.todos[todo.ID] = todo
	s.nextID++
	return todo
}

// List trả về tất cả todo, sắp xếp theo ID tăng dần.
// Nếu done khác nil, chỉ trả về các todo có Done == *done.
func (s *Store) List(done *bool) []Todo {
	s.mu.Lock()
	defer s.mu.Unlock()

	result := make([]Todo, 0, len(s.todos)) // Không dùng nil để JSON ra [] thay vì null
	for _, t := range s.todos {
		if done != nil && t.Done != *done {
			continue
		}
		result = append(result, t)
	}
	slices.SortFunc(result, func(a, b Todo) int { return a.ID - b.ID })
	return result
}

// Get trả về todo theo ID, hoặc ErrNotFound.
func (s *Store) Get(id int) (Todo, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	todo, ok := s.todos[id]
	if !ok {
		return Todo{}, ErrNotFound
	}
	return todo, nil
}

// Update cập nhật title và/hoặc done. Tham số nil nghĩa là "không thay đổi".
func (s *Store) Update(id int, title *string, done *bool) (Todo, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	todo, ok := s.todos[id]
	if !ok {
		return Todo{}, ErrNotFound
	}
	if title != nil {
		todo.Title = *title
	}
	if done != nil {
		todo.Done = *done
	}
	s.todos[id] = todo // Map lưu bản sao của struct → phải gán lại
	return todo, nil
}

// Delete xóa todo theo ID, hoặc trả về ErrNotFound.
func (s *Store) Delete(id int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.todos[id]; !ok {
		return ErrNotFound
	}
	delete(s.todos, id)
	return nil
}
```

**Tại sao cần `sync.Mutex`?**

`net/http` xử lý **mỗi request trong một goroutine riêng**. Nếu 100 người cùng tạo todo, sẽ có 100 goroutine cùng ghi vào `s.todos` và `s.nextID` → **data race** và thậm chí `fatal error: concurrent map writes` ([Bài 8](./08-concurrency.md)). Mutex đảm bảo mỗi lúc chỉ một goroutine được thao tác trên store.

**Những điểm đáng chú ý**:

- `defer s.mu.Unlock()` ngay sau `Lock()` - không bao giờ quên mở khóa, kể cả khi `return` sớm
- `make([]Todo, 0, len(s.todos))` thay vì `var result []Todo` - để API trả về `[]` thay vì `null` khi danh sách rỗng
- `slices.SortFunc` vì **thứ tự duyệt map là ngẫu nhiên** ([Bài 5](./05-arrays-slices-maps.md))
- `Update` nhận **con trỏ** `*string`, `*bool`: `nil` nghĩa là "không thay đổi field này"
- `s.todos[id] = todo`: map lưu **bản sao** của struct, sửa biến `todo` không tự cập nhật vào map

## 📖 6. Bước 4: HTTP Handlers

Đây là phần "trái tim" của API. Chúng ta chia `handlers.go` thành 3 phần để dễ theo dõi.

### Phần 1: Server, routes và các hàm hỗ trợ

📄 **`handlers.go`** (phần 1)

```go
package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
)

// Server gom các dependency mà handler cần dùng.
type Server struct {
	store *Store
}

// NewServer tạo Server với store cho trước.
func NewServer(store *Store) *Server {
	return &Server{store: store}
}

// routes đăng ký tất cả route và trả về http.Handler hoàn chỉnh.
func (s *Server) routes() http.Handler {
	mux := http.NewServeMux()

	// Routing pattern của Go 1.22+: "METHOD /đường/dẫn/{tham_số}"
	mux.HandleFunc("GET /health", s.handleHealth)
	mux.HandleFunc("GET /todos", s.handleListTodos)
	mux.HandleFunc("POST /todos", s.handleCreateTodo)
	mux.HandleFunc("GET /todos/{id}", s.handleGetTodo)
	mux.HandleFunc("PATCH /todos/{id}", s.handleUpdateTodo)
	mux.HandleFunc("DELETE /todos/{id}", s.handleDeleteTodo)

	return logRequests(mux) // Bọc toàn bộ mux bằng middleware ghi log
}

// ===== Các hàm hỗ trợ =====

// writeJSON ghi v dưới dạng JSON với status code cho trước.
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("ghi JSON thất bại: %v", err)
	}
}

// errorResponse là định dạng JSON thống nhất cho mọi lỗi.
type errorResponse struct {
	Error string `json:"error"`
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, errorResponse{Error: message})
}

// writeStoreError chuyển lỗi của Store thành HTTP status code phù hợp.
func writeStoreError(w http.ResponseWriter, err error) {
	if errors.Is(err, ErrNotFound) {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	log.Printf("lỗi không mong đợi: %v", err)
	writeError(w, http.StatusInternalServerError, "lỗi hệ thống")
}

// parseID đọc tham số {id} trên URL và chuyển sang int.
func parseID(r *http.Request) (int, error) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil || id <= 0 {
		return 0, fmt.Errorf("id %q không hợp lệ", r.PathValue("id"))
	}
	return id, nil
}

// decodeJSON đọc body JSON vào dst, giới hạn kích thước 1MB
// và từ chối các field lạ.
func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) error {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return fmt.Errorf("body JSON không hợp lệ: %w", err)
	}
	return nil
}
```

**Giải thích**:

- **`Server` struct** chứa các dependency (ở đây là `store`). Handler là **method** của `Server` nên truy cập được `s.store`. Cách này dễ test hơn nhiều so với dùng biến toàn cục
- **Handler** trong Go là hàm có chữ ký `func(w http.ResponseWriter, r *http.Request)`:
  - `r` chứa mọi thứ về request: method, URL, header, body
  - `w` dùng để viết response: header, status code, body
- **Thứ tự quan trọng**: `w.Header().Set(...)` → `w.WriteHeader(status)` → ghi body. Sau khi `WriteHeader` hoặc ghi body, header không thể thay đổi nữa
- **`writeStoreError`** chuyển lỗi nghiệp vụ thành status code bằng `errors.Is` - đúng mẫu bạn học ở [Bài 7](./07-error-handling.md)
- **`http.MaxBytesReader`**: giới hạn body 1MB, chống client gửi dữ liệu khổng lồ làm tràn RAM
- **`DisallowUnknownFields`**: báo lỗi nếu client gửi field lạ (ví dụ gõ nhầm `"titel"`) thay vì âm thầm bỏ qua

### Phần 2: Health check, danh sách và tạo mới

📄 **`handlers.go`** (phần 2)

```go
// ===== Handlers =====

// GET /health - kiểm tra server còn sống.
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// GET /todos và GET /todos?done=true|false
func (s *Server) handleListTodos(w http.ResponseWriter, r *http.Request) {
	var done *bool
	if v := r.URL.Query().Get("done"); v != "" {
		b, err := strconv.ParseBool(v)
		if err != nil {
			writeError(w, http.StatusBadRequest, "tham số done phải là true hoặc false")
			return
		}
		done = &b
	}
	writeJSON(w, http.StatusOK, s.store.List(done))
}

type createTodoRequest struct {
	Title string `json:"title"`
}

// POST /todos
func (s *Server) handleCreateTodo(w http.ResponseWriter, r *http.Request) {
	var req createTodoRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	title, err := normalizeTitle(req.Title)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	todo := s.store.Create(title)
	w.Header().Set("Location", fmt.Sprintf("/todos/%d", todo.ID))
	writeJSON(w, http.StatusCreated, todo)
}
```

**Giải thích**:

- `r.URL.Query().Get("done")` đọc **query parameter** `?done=true`. Trả về `""` nếu không có
- Biến `done *bool` = `nil` nghĩa là "không lọc" - cùng ý tưởng "con trỏ nil = không có giá trị" ở [Bài 6](./06-structs-methods-interfaces.md)
- Mỗi lỗi đều `return` ngay sau khi `writeError` - **quên `return`** là lỗi rất hay gặp (xem mục Lỗi thường gặp)
- Header `Location` chỉ đến tài nguyên vừa tạo - quy ước chuẩn của REST cho `201 Created`

### Phần 3: Lấy, cập nhật và xóa theo ID

📄 **`handlers.go`** (phần 3)

```go
// GET /todos/{id}
func (s *Server) handleGetTodo(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	todo, err := s.store.Get(id)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, todo)
}

// updateTodoRequest dùng CON TRỎ để phân biệt
// "không gửi field" (nil) với "gửi giá trị rỗng/false".
type updateTodoRequest struct {
	Title *string `json:"title"`
	Done  *bool   `json:"done"`
}

// PATCH /todos/{id}
func (s *Server) handleUpdateTodo(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	var req updateTodoRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if req.Title == nil && req.Done == nil {
		writeError(w, http.StatusBadRequest, "cần ít nhất một field: title hoặc done")
		return
	}
	if req.Title != nil {
		title, err := normalizeTitle(*req.Title)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		req.Title = &title
	}

	todo, err := s.store.Update(id, req.Title, req.Done)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, todo)
}

// DELETE /todos/{id}
func (s *Server) handleDeleteTodo(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := s.store.Delete(id); err != nil {
		writeStoreError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent) // 204: thành công, không có body
}
```

**Tại sao `updateTodoRequest` dùng con trỏ?**

Với `PATCH`, client chỉ gửi **những field muốn đổi**. Hãy xem sự khác biệt:

| JSON gửi lên | Nếu dùng `Done bool` | Nếu dùng `Done *bool` |
|--------------|---------------------|----------------------|
| `{"done": true}` | `true` | con trỏ tới `true` |
| `{"done": false}` | `false` | con trỏ tới `false` |
| `{"title": "Mới"}` (không có done) | `false` ⚠️ Không phân biệt được với "gửi false" | `nil` ✅ "không đổi" |

## 📖 7. Bước 5: Middleware ghi log

**Middleware** là hàm "bọc" quanh handler để thêm chức năng chung cho mọi request: ghi log, xác thực, CORS, đo thời gian, recover panic...

> 💡 **Ví von**: Middleware giống **nhân viên lễ tân**: mọi khách (request) đều phải đi qua lễ tân để ghi sổ trước khi vào gặp người cần gặp (handler), và ghi giờ ra khi về.

📄 **`middleware.go`**

```go
package main

import (
	"log"
	"net/http"
	"time"
)

// statusRecorder "bọc" ResponseWriter để ghi nhớ status code đã trả về.
type statusRecorder struct {
	http.ResponseWriter // Embedding: kế thừa mọi method của ResponseWriter
	status              int
}

// WriteHeader "ghi đè" method của ResponseWriter để lưu lại status.
func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

// logRequests là middleware: nhận một handler, trả về handler mới
// có thêm chức năng ghi log mỗi request.
func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}

		next.ServeHTTP(rec, r) // Gọi handler thật

		log.Printf("%s %s → %d (%v)", r.Method, r.URL.Path, rec.status, time.Since(start))
	})
}
```

**Giải thích**:

- `logRequests` nhận `http.Handler` và trả về `http.Handler` mới - đây là **closure** ([Bài 4](./04-functions.md)): hàm bên trong "nhớ" biến `next`
- `http.HandlerFunc(func...)` chuyển một hàm thường thành kiểu thỏa mãn interface `http.Handler` (có method `ServeHTTP`)
- `statusRecorder` **nhúng** `http.ResponseWriter` ([Bài 6](./06-structs-methods-interfaces.md)): nó tự động có các method `Header()`, `Write()` của writer gốc, và chỉ "ghi đè" `WriteHeader` để ghi nhớ status code
- Có thể xếp chồng nhiều middleware: `logRequests(authMiddleware(corsMiddleware(mux)))`

## 📖 8. Bước 6: `main.go` - Khởi động và tắt server an toàn

📄 **`main.go`**

```go
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	srv := NewServer(NewStore())
	httpServer := &http.Server{
		Addr:              ":" + port,
		Handler:           srv.routes(),
		ReadHeaderTimeout: 5 * time.Second,  // Chống client gửi header quá chậm
		ReadTimeout:       10 * time.Second, // Thời gian tối đa đọc cả request
		WriteTimeout:      10 * time.Second, // Thời gian tối đa ghi response
		IdleTimeout:       60 * time.Second, // Giữ kết nối keep-alive tối đa
	}

	// ctx bị hủy khi nhận Ctrl+C (SIGINT) hoặc SIGTERM (Docker/Kubernetes dừng app)
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Chạy server trong goroutine riêng để main có thể chờ tín hiệu tắt
	go func() {
		log.Printf("🚀 Todo API đang chạy tại http://localhost:%s", port)
		if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server lỗi: %v", err)
		}
	}()

	<-ctx.Done() // Chờ đến khi nhận tín hiệu tắt
	log.Println("⏳ Đang tắt server...")

	// Cho các request đang xử lý tối đa 5 giây để hoàn thành
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		log.Printf("tắt server không thành công: %v", err)
	}
	log.Println("👋 Server đã tắt")
}
```

**Giải thích**:

- **Đọc cấu hình từ biến môi trường** `PORT` - chuẩn khi deploy lên cloud (Heroku, Cloud Run, Docker...)
- **Timeouts**: `http.ListenAndServe(":8080", h)` đơn giản **không có timeout** → client chậm/độc hại có thể giữ kết nối mãi mãi. Luôn tạo `http.Server` với timeout trong môi trường thật
- **Graceful shutdown** (tắt nhẹ nhàng):
  1. `signal.NotifyContext` tạo context bị hủy khi nhấn `Ctrl+C`
  2. Server chạy trong **goroutine** riêng, main **chờ** `<-ctx.Done()`
  3. Khi nhận tín hiệu, `Shutdown` **ngừng nhận request mới** nhưng **chờ request đang xử lý** hoàn thành (tối đa 5 giây)
- `http.ErrServerClosed` là lỗi "bình thường" khi `Shutdown` được gọi - không phải lỗi thật, nên bỏ qua bằng `errors.Is`

## 📖 9. Bước 7: Chạy và kiểm thử bằng `curl`

### Khởi động server

```bash
go run .
```

```text
2026/09/25 03:17:45 🚀 Todo API đang chạy tại http://localhost:8080
```

Mở **một terminal khác** để gửi request.

> 💡 **Windows**: PowerShell có alias `curl` trỏ tới `Invoke-WebRequest` với cú pháp khác. Hãy gõ `curl.exe` thay vì `curl`, và dùng dấu nháy kép với escape cho JSON: `-d "{\"title\":\"Học Go\"}"`. Hoặc dùng Git Bash / WSL / Postman.

### Health check

```bash
curl http://localhost:8080/health
```

```text
{"status":"ok"}
```

### Tạo todo (POST)

```bash
curl -i -X POST http://localhost:8080/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Học Go"}'
```

```text
HTTP/1.1 201 Created
Content-Type: application/json
Location: /todos/1
Date: Fri, 25 Sep 2026 03:17:46 GMT
Content-Length: 87

{"id":1,"title":"Học Go","done":false,"created_at":"2026-09-25T03:17:46.489390329Z"}
```

(`-i` để xem cả status line và header.) Tạo thêm một todo nữa:

```bash
curl -X POST http://localhost:8080/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Viết Todo API"}'
```

```text
{"id":2,"title":"Viết Todo API","done":false,"created_at":"2026-09-25T03:17:46.49628398Z"}
```

### Lấy danh sách (GET)

```bash
curl http://localhost:8080/todos
```

```text
[{"id":1,"title":"Học Go","done":false,"created_at":"2026-09-25T03:17:46.489390329Z"},{"id":2,"title":"Viết Todo API","done":false,"created_at":"2026-09-25T03:17:46.49628398Z"}]
```

> 💡 Muốn JSON dễ đọc hơn? Cài công cụ `jq` và dùng `curl -s http://localhost:8080/todos | jq`.

### Lấy một todo

```bash
curl http://localhost:8080/todos/1
```

```text
{"id":1,"title":"Học Go","done":false,"created_at":"2026-09-25T03:17:46.489390329Z"}
```

### Đánh dấu hoàn thành (PATCH)

```bash
curl -X PATCH http://localhost:8080/todos/1 \
  -H "Content-Type: application/json" \
  -d '{"done":true}'
```

```text
{"id":1,"title":"Học Go","done":true,"created_at":"2026-09-25T03:17:46.489390329Z"}
```

### Lọc theo trạng thái

```bash
curl "http://localhost:8080/todos?done=false"
```

```text
[{"id":2,"title":"Viết Todo API","done":false,"created_at":"2026-09-25T03:17:46.49628398Z"}]
```

(Nhớ đặt URL trong dấu nháy vì shell hiểu `?` là ký tự đặc biệt.)

### Các trường hợp lỗi

```bash
curl -X POST http://localhost:8080/todos -H "Content-Type: application/json" -d '{"title":""}'
# {"error":"title không được để trống"}

curl http://localhost:8080/todos/99
# {"error":"không tìm thấy todo"}

curl http://localhost:8080/todos/abc
# {"error":"id \"abc\" không hợp lệ"}

curl -i -X PUT http://localhost:8080/todos/1
# HTTP/1.1 405 Method Not Allowed
# Allow: DELETE, GET, HEAD, PATCH
# ...
```

### Xóa (DELETE)

```bash
curl -i -X DELETE http://localhost:8080/todos/2
```

```text
HTTP/1.1 204 No Content
Date: Fri, 25 Sep 2026 03:17:46 GMT
```

### Log phía server

Quay lại terminal đang chạy server, bạn sẽ thấy middleware đã ghi lại mọi request:

```text
2026/09/25 03:17:46 GET /health → 200 (49.19µs)
2026/09/25 03:17:46 POST /todos → 201 (173.266µs)
2026/09/25 03:17:46 POST /todos → 201 (63.419µs)
2026/09/25 03:17:46 GET /todos → 200 (56.171µs)
2026/09/25 03:17:46 GET /todos/1 → 200 (53.528µs)
2026/09/25 03:17:46 PATCH /todos/1 → 200 (103.701µs)
2026/09/25 03:17:46 GET /todos → 200 (53.618µs)
2026/09/25 03:17:46 POST /todos → 400 (79.952µs)
2026/09/25 03:17:46 GET /todos/99 → 404 (11.018µs)
2026/09/25 03:17:46 GET /todos/abc → 400 (13.218µs)
2026/09/25 03:17:46 PUT /todos/1 → 405 (14.431µs)
2026/09/25 03:17:46 DELETE /todos/2 → 204 (30.976µs)
```

Nhấn **`Ctrl+C`** để tắt server:

```text
2026/09/25 03:17:50 ⏳ Đang tắt server...
2026/09/25 03:17:50 👋 Server đã tắt
```

> ⚠️ Vì dữ liệu lưu **trong bộ nhớ**, tắt server là **mất hết todo**. Xem mục "Ý tưởng mở rộng" để lưu vào file hoặc database.

## 📖 10. Bước 8: Viết test với `httptest`

Test bằng `curl` thủ công rất chậm và dễ quên. Package **`net/http/httptest`** cho phép test handler **mà không cần chạy server thật**:

- `httptest.NewRequest(method, url, body)`: tạo request giả
- `httptest.NewRecorder()`: một `ResponseWriter` "ghi âm" lại mọi thứ handler viết ra (status, header, body)

### Test cho Store

📄 **`store_test.go`**

```go
package main

import (
	"errors"
	"sync"
	"testing"
)

func TestStoreCRUD(t *testing.T) {
	s := NewStore()

	// Create
	a := s.Create("Học Go")
	b := s.Create("Viết API")
	if a.ID != 1 || b.ID != 2 {
		t.Fatalf("ID = %d, %d; want 1, 2", a.ID, b.ID)
	}

	// Get
	got, err := s.Get(a.ID)
	if err != nil || got.Title != "Học Go" {
		t.Fatalf("Get(%d) = %+v, %v", a.ID, got, err)
	}

	// Update
	done := true
	updated, err := s.Update(a.ID, nil, &done)
	if err != nil || !updated.Done || updated.Title != "Học Go" {
		t.Fatalf("Update = %+v, %v", updated, err)
	}

	// List có lọc
	if n := len(s.List(&done)); n != 1 {
		t.Errorf("List(done=true) có %d todo; want 1", n)
	}

	// Delete
	if err := s.Delete(a.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, err := s.Get(a.ID); !errors.Is(err, ErrNotFound) {
		t.Errorf("Get sau khi xóa: err = %v; want ErrNotFound", err)
	}
	if err := s.Delete(999); !errors.Is(err, ErrNotFound) {
		t.Errorf("Delete(999): err = %v; want ErrNotFound", err)
	}
}

// Chạy với: go test -race ./...
func TestStoreConcurrentCreate(t *testing.T) {
	s := NewStore()
	var wg sync.WaitGroup
	for range 100 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			s.Create("việc song song")
		}()
	}
	wg.Wait()

	if n := len(s.List(nil)); n != 100 {
		t.Errorf("có %d todo; want 100", n)
	}
}
```

### Test cho HTTP handlers

📄 **`handlers_test.go`**

```go
package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// newTestServer tạo handler mới với store rỗng cho mỗi test.
func newTestServer() http.Handler {
	return NewServer(NewStore()).routes()
}

// doRequest gửi một request giả tới handler và trả về response đã ghi lại.
func doRequest(t *testing.T, h http.Handler, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestCreateTodo(t *testing.T) {
	tests := []struct {
		name       string
		body       string
		wantStatus int
		wantInBody string
	}{
		{"hợp lệ", `{"title":"Học Go"}`, http.StatusCreated, `"title":"Học Go"`},
		{"xóa khoảng trắng thừa", `{"title":"  Đi chợ  "}`, http.StatusCreated, `"title":"Đi chợ"`},
		{"title rỗng", `{"title":"   "}`, http.StatusBadRequest, "không được để trống"},
		{"JSON sai cú pháp", `{"title":`, http.StatusBadRequest, "body JSON không hợp lệ"},
		{"field lạ", `{"title":"A","priority":1}`, http.StatusBadRequest, "unknown field"},
		{"title quá dài", `{"title":"` + strings.Repeat("a", 201) + `"}`, http.StatusBadRequest, "200 ký tự"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := doRequest(t, newTestServer(), http.MethodPost, "/todos", tt.body)

			if rec.Code != tt.wantStatus {
				t.Errorf("status = %d; want %d (body: %s)", rec.Code, tt.wantStatus, rec.Body)
			}
			if !strings.Contains(rec.Body.String(), tt.wantInBody) {
				t.Errorf("body = %s; muốn chứa %q", rec.Body, tt.wantInBody)
			}
		})
	}
}

func TestTodoLifecycle(t *testing.T) {
	h := newTestServer()

	// 1. Tạo todo
	rec := doRequest(t, h, http.MethodPost, "/todos", `{"title":"Viết test"}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("POST status = %d; want 201", rec.Code)
	}
	if loc := rec.Header().Get("Location"); loc != "/todos/1" {
		t.Errorf("Location = %q; want /todos/1", loc)
	}
	var created Todo
	if err := json.NewDecoder(rec.Body).Decode(&created); err != nil {
		t.Fatalf("decode: %v", err)
	}

	// 2. Lấy todo vừa tạo
	rec = doRequest(t, h, http.MethodGet, "/todos/1", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("GET status = %d; want 200", rec.Code)
	}

	// 3. Đánh dấu hoàn thành
	rec = doRequest(t, h, http.MethodPatch, "/todos/1", `{"done":true}`)
	var updated Todo
	json.NewDecoder(rec.Body).Decode(&updated)
	if rec.Code != http.StatusOK || !updated.Done || updated.Title != "Viết test" {
		t.Fatalf("PATCH = %d %+v", rec.Code, updated)
	}

	// 4. Lọc danh sách theo trạng thái
	rec = doRequest(t, h, http.MethodGet, "/todos?done=false", "")
	if body := strings.TrimSpace(rec.Body.String()); body != "[]" {
		t.Errorf("GET ?done=false = %s; want []", body)
	}

	// 5. Xóa
	rec = doRequest(t, h, http.MethodDelete, "/todos/1", "")
	if rec.Code != http.StatusNoContent {
		t.Fatalf("DELETE status = %d; want 204", rec.Code)
	}

	// 6. Lấy lại → 404
	rec = doRequest(t, h, http.MethodGet, "/todos/1", "")
	if rec.Code != http.StatusNotFound {
		t.Errorf("GET sau khi xóa: status = %d; want 404", rec.Code)
	}
}

func TestErrorCases(t *testing.T) {
	tests := []struct {
		name       string
		method     string
		path       string
		body       string
		wantStatus int
	}{
		{"id không phải số", http.MethodGet, "/todos/abc", "", http.StatusBadRequest},
		{"id âm", http.MethodGet, "/todos/-1", "", http.StatusBadRequest},
		{"todo không tồn tại", http.MethodGet, "/todos/42", "", http.StatusNotFound},
		{"xóa todo không tồn tại", http.MethodDelete, "/todos/42", "", http.StatusNotFound},
		{"PATCH không có field", http.MethodPatch, "/todos/1", `{}`, http.StatusBadRequest},
		{"done không hợp lệ", http.MethodGet, "/todos?done=maybe", "", http.StatusBadRequest},
		{"sai method", http.MethodPut, "/todos/1", "", http.StatusMethodNotAllowed},
		{"route không tồn tại", http.MethodGet, "/users", "", http.StatusNotFound},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := doRequest(t, newTestServer(), tt.method, tt.path, tt.body)
			if rec.Code != tt.wantStatus {
				t.Errorf("%s %s: status = %d; want %d", tt.method, tt.path, rec.Code, tt.wantStatus)
			}
		})
	}
}
```

**Điểm đáng chú ý**:

- `newTestServer()` tạo **store mới cho mỗi test** → các test **độc lập**, không ảnh hưởng nhau
- `doRequest` là **helper** với `t.Helper()` - báo lỗi đúng dòng gọi
- Test gọi thẳng `h.ServeHTTP(rec, req)` - **không mở cổng mạng**, chạy cực nhanh
- `TestErrorCases` kiểm tra cả hành vi **tự động** của `ServeMux`: 405 cho sai method, 404 cho route lạ
- `TestTodoLifecycle` kiểm tra **cả vòng đời** của một todo - loại test này bắt được lỗi khi các phần kết hợp với nhau

### Chạy test

```bash
go test ./...
```

```text
ok  	todo-api	0.006s
```

Chạy với race detector và coverage (**nên làm trước mỗi lần commit**):

```bash
go test -race -cover ./...
```

```text
ok  	todo-api	1.022s	coverage: 76.7% of statements
```

Xem chi tiết với `-v`:

```bash
go test -v -run TestCreateTodo ./...
```

```text
=== RUN   TestCreateTodo
=== RUN   TestCreateTodo/hợp_lệ
2026/09/25 03:17:46 POST /todos → 201 (61.3µs)
=== RUN   TestCreateTodo/xóa_khoảng_trắng_thừa
2026/09/25 03:17:46 POST /todos → 201 (20.1µs)
=== RUN   TestCreateTodo/title_rỗng
2026/09/25 03:17:46 POST /todos → 400 (18.2µs)
...
--- PASS: TestCreateTodo (0.00s)
    --- PASS: TestCreateTodo/hợp_lệ (0.00s)
    --- PASS: TestCreateTodo/xóa_khoảng_trắng_thừa (0.00s)
    --- PASS: TestCreateTodo/title_rỗng (0.00s)
    --- PASS: TestCreateTodo/JSON_sai_cú_pháp (0.00s)
    --- PASS: TestCreateTodo/field_lạ (0.00s)
    --- PASS: TestCreateTodo/title_quá_dài (0.00s)
PASS
ok  	todo-api	0.005s
```

> 💡 Coverage chưa đạt 100% vì `main()` và một số nhánh lỗi hiếm (lỗi ghi JSON, lỗi 500) chưa được test. Đó là điều bình thường - hãy tập trung vào logic quan trọng.

## 📖 11. Build và triển khai

```bash
# Build ra file thực thi
go build -o todo-api .

# Chạy với cổng khác
PORT=3000 ./todo-api

# Build cho Linux server (từ máy Mac/Windows)
GOOS=linux GOARCH=amd64 go build -o todo-api-linux .
```

File `todo-api` chỉ khoảng **vài MB**, không cần cài Go hay bất cứ thứ gì trên server - copy lên và chạy!

### Bonus: Dockerfile tối giản

```dockerfile
# Giai đoạn 1: build
FROM golang:1.24 AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /todo-api .

# Giai đoạn 2: image chạy, chỉ chứa file binary
FROM gcr.io/distroless/static-debian12
COPY --from=build /todo-api /todo-api
EXPOSE 8080
ENTRYPOINT ["/todo-api"]
```

```bash
docker build -t todo-api .
docker run -p 8080:8080 todo-api
```

Image cuối cùng chỉ khoảng **10-20 MB** - so với hàng trăm MB của ứng dụng Node.js hay Java.

## 🌍 Ứng dụng thực tế

Todo API là "bộ khung" của hầu hết backend thực tế. Khi đưa lên production, hai tính năng gần như luôn được yêu cầu đầu tiên là **tìm kiếm + phân trang** và **xác thực client**. Hai ví dụ dưới đây là các chương trình độc lập (dùng `httptest` để gửi request thử, không cần mở cổng mạng), bạn có thể chạy ngay rồi ghép vào dự án Todo.

### Ví dụ 1: Tìm kiếm và phân trang `GET /todos?q=&page=&limit=`

Không API thật nào trả về **toàn bộ** dữ liệu trong một lần - với 1 triệu todo, response sẽ nặng hàng trăm MB. Phân trang cần: đọc và **kiểm tra** tham số query, chặn `limit` quá lớn, trả về `total` để frontend vẽ nút chuyển trang:

```go
package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
)

type Todo struct {
	ID    int    `json:"id"`
	Title string `json:"title"`
	Done  bool   `json:"done"`
}

// pageResponse: định dạng trả về cho danh sách có phân trang
type pageResponse struct {
	Items []Todo `json:"items"`
	Page  int    `json:"page"`
	Limit int    `json:"limit"`
	Total int    `json:"total"` // Tổng số kết quả (để frontend vẽ nút trang)
}

// queryInt đọc tham số số nguyên từ URL, dùng giá trị mặc định nếu không có
func queryInt(r *http.Request, name string, def, lo, hi int) (int, error) {
	raw := r.URL.Query().Get(name)
	if raw == "" {
		return def, nil
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n < lo || n > hi {
		return 0, fmt.Errorf("%s phải là số từ %d đến %d", name, lo, hi)
	}
	return n, nil
}

// paginate cắt slice theo trang - generic, dùng được cho mọi kiểu
func paginate[T any](items []T, page, limit int) []T {
	start := (page - 1) * limit
	if start >= len(items) {
		return []T{} // Trang vượt quá → mảng rỗng (JSON: [] chứ không phải null)
	}
	end := min(start+limit, len(items))
	return items[start:end]
}

// writeJSON giống hàm cùng tên trong dự án Todo
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// GET /todos?q=<từ khóa>&page=<trang>&limit=<số mục mỗi trang>
func listTodos(todos []Todo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		page, err := queryInt(r, "page", 1, 1, 1_000_000)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		limit, err := queryInt(r, "limit", 10, 1, 50) // Chặn limit quá lớn làm nặng server
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		// Tìm kiếm không phân biệt hoa thường; q rỗng thì khớp tất cả
		q := strings.ToLower(r.URL.Query().Get("q"))
		var matched []Todo
		for _, t := range todos {
			if strings.Contains(strings.ToLower(t.Title), q) {
				matched = append(matched, t)
			}
		}

		writeJSON(w, http.StatusOK, pageResponse{
			Items: paginate(matched, page, limit),
			Page:  page,
			Limit: limit,
			Total: len(matched),
		})
	}
}

func main() {
	todos := []Todo{
		{1, "Học Go cơ bản", true}, {2, "Viết REST API bằng Go", false},
		{3, "Đi chợ", false}, {4, "Đọc sách Learning Go", false}, {5, "Deploy Go lên server", false},
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /todos", listTodos(todos))

	// Gửi thử vài request bằng httptest - không cần mở cổng mạng thật
	for _, url := range []string{
		"/todos?q=go&limit=2",
		"/todos?q=go&limit=2&page=2",
		"/todos?q=go&limit=2&page=9",
		"/todos?limit=500",
	} {
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, httptest.NewRequest("GET", url, nil))
		fmt.Printf("GET %s → %d\n  %s", url, rec.Code, rec.Body.String())
	}
}

// Output:
// GET /todos?q=go&limit=2 → 200
//   {"items":[{"id":1,"title":"Học Go cơ bản","done":true},{"id":2,"title":"Viết REST API bằng Go","done":false}],"page":1,"limit":2,"total":4}
// GET /todos?q=go&limit=2&page=2 → 200
//   {"items":[{"id":4,"title":"Đọc sách Learning Go","done":false},{"id":5,"title":"Deploy Go lên server","done":false}],"page":2,"limit":2,"total":4}
// GET /todos?q=go&limit=2&page=9 → 200
//   {"items":[],"page":9,"limit":2,"total":4}
// GET /todos?limit=500 → 400
//   {"error":"limit phải là số từ 1 đến 50"}
```

> 💡 Trả về `[]T{}` thay vì slice `nil` khi trang trống, để JSON là `"items":[]` chứ không phải `"items":null` - frontend JavaScript sẽ không bị lỗi khi gọi `.map()`. Khi chuyển sang database ([Bài 13](./13-database-sql.md)), phân trang sẽ được làm ngay trong câu SQL bằng `LIMIT ... OFFSET ...` thay vì cắt slice.

### Ví dụ 2: Middleware xác thực bằng API key

API cho ứng dụng mobile hoặc đối tác thường yêu cầu header `X-API-Key`. Middleware kiểm tra key, rồi gắn **tên client** vào `context` của request để handler phía sau biết ai đang gọi (dùng cho log, giới hạn quota...):

```go
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
)

// ctxKey là kiểu riêng (unexported) làm key cho context → không đụng key của package khác
type ctxKey string

const clientKey ctxKey = "client"

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// requireAPIKey là middleware: chỉ cho request có header X-API-Key hợp lệ đi qua.
// apiKeys: API key → tên ứng dụng khách (thực tế đọc từ database/biến môi trường).
func requireAPIKey(apiKeys map[string]string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := r.Header.Get("X-API-Key")
		if key == "" {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "thiếu header X-API-Key"})
			return
		}
		client, ok := apiKeys[key]
		if !ok {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "API key không hợp lệ"})
			return
		}
		// Gắn tên client vào context của request để handler phía sau dùng
		ctx := context.WithValue(r.Context(), clientKey, client)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func handleListTodos(w http.ResponseWriter, r *http.Request) {
	client, _ := r.Context().Value(clientKey).(string) // Type assertion (Bài 6)
	writeJSON(w, http.StatusOK, map[string]any{
		"client": client,
		"todos":  []string{"Học Go", "Viết API"},
	})
}

func main() {
	apiKeys := map[string]string{
		"key-mobile-123": "app-mobile",
		"key-web-456":    "web-admin",
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	// Chỉ bảo vệ nhóm route /todos, /health vẫn công khai cho hệ thống giám sát
	mux.Handle("GET /todos", requireAPIKey(apiKeys, http.HandlerFunc(handleListTodos)))

	tests := []struct{ path, key string }{
		{"/health", ""},
		{"/todos", ""},
		{"/todos", "key-sai"},
		{"/todos", "key-mobile-123"},
	}
	for _, tc := range tests {
		req := httptest.NewRequest("GET", tc.path, nil)
		if tc.key != "" {
			req.Header.Set("X-API-Key", tc.key)
		}
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		fmt.Printf("GET %-7s key=%-16q → %d %s", tc.path, tc.key, rec.Code, rec.Body.String())
	}
}

// Output:
// GET /health key=""               → 200 {"status":"ok"}
// GET /todos  key=""               → 401 {"error":"thiếu header X-API-Key"}
// GET /todos  key="key-sai"        → 401 {"error":"API key không hợp lệ"}
// GET /todos  key="key-mobile-123" → 200 {"client":"app-mobile","todos":["Học Go","Viết API"]}
```

> ⚠️ Đây là bản tối giản để học. Trong production: lưu key dạng **hash** thay vì plaintext, so sánh bằng `crypto/subtle.ConstantTimeCompare` để tránh tấn công đo thời gian (timing attack), luôn dùng **HTTPS**, và cân nhắc thêm giới hạn tốc độ (rate limit). Phần 2 ([Bài 12](./12-http-apis.md), [Bài 16](./16-production-ready.md)) sẽ đi sâu hơn vào web API và vận hành ứng dụng Go trong production.

## ⚠️ Lỗi thường gặp

### Lỗi 1: Quên `return` sau khi ghi lỗi

```go
if err != nil {
	writeError(w, http.StatusBadRequest, err.Error())
	// ❌ Quên return → code chạy tiếp, ghi thêm response thứ hai
}
writeJSON(w, http.StatusOK, todo)
```

Log sẽ báo: `http: superfluous response.WriteHeader call`. ✅ Luôn `return` ngay sau khi ghi response lỗi.

### Lỗi 2: Set header SAU khi đã `WriteHeader`

```go
w.WriteHeader(http.StatusCreated)
w.Header().Set("Content-Type", "application/json") // ❌ Không có tác dụng - header đã gửi đi rồi
```

✅ Thứ tự: `Header().Set` → `WriteHeader` → `Write`.

### Lỗi 3: Field struct viết thường không xuất hiện trong JSON

```go
type Todo struct {
	id    int    `json:"id"`    // ❌ unexported → encoding/json bỏ qua
	Title string `json:"title"` // ✅
}
```

`go vet` sẽ cảnh báo: *"struct field id has json tag but is not exported"*.

### Lỗi 4: Quên khóa mutex khi truy cập map dùng chung

```text
fatal error: concurrent map writes
```

✅ Mọi method của `Store` đều phải `Lock()`/`Unlock()`. Chạy `go test -race` để phát hiện sớm.

### Lỗi 5: Dùng pattern Go 1.22 với `go.mod` cũ

Nếu `go.mod` ghi `go 1.21`, pattern `"GET /todos/{id}"` sẽ **không** hoạt động như mong đợi (bị hiểu là đường dẫn có chứa chữ "GET "). ✅ Đảm bảo `go 1.22` trở lên.

### Lỗi 6: Hai pattern xung đột

```go
mux.HandleFunc("GET /todos/{id}", a)
mux.HandleFunc("GET /todos/{name}", b) // 💥 panic: pattern "GET /todos/{name}" ... conflicts with pattern "GET /todos/{id}"
```

✅ Mỗi đường dẫn chỉ nên có một pattern khớp. Pattern cụ thể hơn (`/todos/new`) được ưu tiên hơn wildcard (`/todos/{id}`).

### Lỗi 7: Dùng `http.ListenAndServe` không có timeout trên production

✅ Luôn tạo `&http.Server{...}` với `ReadHeaderTimeout`, `ReadTimeout`, `WriteTimeout`, `IdleTimeout`.

### Lỗi 8: Trả về `null` thay vì `[]`

```go
var result []Todo           // nil slice → JSON: null
result := make([]Todo, 0)   // ✅ empty slice → JSON: []
```

Frontend thường mong đợi mảng, nhận `null` sẽ gây lỗi `Cannot read properties of null`.

## 💡 Ý tưởng mở rộng

Đã hoàn thành phiên bản cơ bản? Hãy thử thách bản thân với các tính năng sau (xếp theo độ khó tăng dần):

### ⭐ Dễ

1. **Thêm field `priority`** (`"low"`, `"medium"`, `"high"`) với validation, và lọc `GET /todos?priority=high`
2. **Thêm `PUT /todos/{id}`** thay thế toàn bộ todo (khác với `PATCH` chỉ sửa một phần)
3. **Thêm field `updated_at`**, tự cập nhật mỗi khi PATCH
4. **Tìm kiếm**: `GET /todos?q=go` trả về todo có title chứa từ khóa (không phân biệt hoa thường)
5. **Phân trang**: `GET /todos?page=2&limit=10` (tham khảo ví dụ ở mục "🌍 Ứng dụng thực tế")

### ⭐⭐ Trung bình

6. **Middleware recover**: bắt panic trong handler, trả về 500 thay vì làm đứt kết nối
7. **Middleware CORS**: cho phép frontend (React/Vue) ở domain khác gọi API
8. **Lưu vào file JSON**: ghi toàn bộ todo ra `todos.json` sau mỗi thay đổi, đọc lại khi khởi động
9. **Tách package**: tổ chức lại thành `cmd/server`, `internal/todo` (model + store), `internal/httpapi` (handlers) theo [Bài 9](./09-packages-modules-testing.md)
10. **Interface cho Store**: định nghĩa `type TodoStore interface { Create(...); Get(...); ... }` để handler không phụ thuộc vào cài đặt cụ thể → dễ thay bằng database

### ⭐⭐⭐ Nâng cao

11. **Database thật**: dùng SQLite (`modernc.org/sqlite`) hoặc PostgreSQL (`github.com/jackc/pgx`) và `database/sql`
12. **Xác thực**: đăng ký/đăng nhập, mỗi user chỉ thấy todo của mình (JWT hoặc session)
13. **Structured logging** với `log/slog` (Go 1.21+) thay cho `log`
14. **Cấu hình**: đọc cấu hình từ biến môi trường/flag (`flag` package)
15. **Frontend**: dùng `html/template` hoặc `embed` để phục vụ một trang HTML đơn giản gọi API
16. **Deploy**: đưa lên Fly.io, Render hoặc Google Cloud Run bằng Docker

## 🏋️ Bài tập

### Bài tập 1: Hoàn thiện theo hướng dẫn

Gõ lại toàn bộ dự án (đừng copy-paste!), chạy `go vet ./...`, `go test -race -cover ./...` và kiểm thử tất cả endpoint bằng `curl`.

### Bài tập 2: Thêm test

Viết thêm test để nâng coverage lên trên 85%:
- Test `PATCH` với title không hợp lệ
- Test `PATCH` todo không tồn tại → 404
- Test `GET /health`
- Test lọc `?done=true`

### Bài tập 3: Endpoint thống kê

Thêm `GET /todos/stats` trả về:

```json
{"total": 5, "done": 2, "pending": 3}
```

**Gợi ý**: Pattern `"GET /todos/stats"` cụ thể hơn `"GET /todos/{id}"` nên sẽ được ưu tiên. Viết test cho endpoint này.

### Bài tập 4: Xóa hàng loạt

Thêm `DELETE /todos?done=true` xóa tất cả todo đã hoàn thành, trả về số lượng đã xóa: `{"deleted": 3}`.

### Bài tập 5: Middleware recover

Viết middleware `recoverPanic(next http.Handler) http.Handler` dùng `defer` + `recover()` ([Bài 7](./07-error-handling.md)) để trả về `500` với JSON `{"error":"lỗi hệ thống"}` khi handler panic. Viết test bằng một handler cố tình panic.

### Bài tập 6: Chọn một ý tưởng mở rộng

Chọn ít nhất **một** tính năng ở mục "⭐⭐ Trung bình", cài đặt kèm test, và đẩy dự án lên GitHub với file `README.md` mô tả cách chạy.

## ✅ Checklist hoàn thành

- [ ] Hiểu REST API, HTTP method và status code
- [ ] Khởi tạo dự án với `go mod init`
- [ ] Định nghĩa model với struct tags JSON
- [ ] Viết store in-memory an toàn với `sync.Mutex`
- [ ] Đăng ký route với pattern Go 1.22 (`"GET /todos/{id}"`) và dùng `r.PathValue`
- [ ] Đọc JSON request với `json.Decoder`, ghi JSON response với `json.Encoder`
- [ ] Chuyển lỗi nghiệp vụ thành status code bằng `errors.Is`
- [ ] Viết middleware ghi log bằng closure và embedding
- [ ] Cấu hình `http.Server` với timeout và graceful shutdown
- [ ] Kiểm thử API bằng `curl`
- [ ] Viết test với `httptest`, chạy `go test -race -cover ./...` thành công
- [ ] Thêm được tìm kiếm + phân trang và middleware xác thực API key (mục Ứng dụng thực tế)
- [ ] Cài đặt ít nhất một ý tưởng mở rộng

## 🎓 Tổng kết Phần 1

🎉 **Chúc mừng bạn đã hoàn thành Phần 1: Cơ bản → Trung cấp!**

Hãy nhìn lại hành trình của bạn:

| Bài | Bạn đã học |
|-----|-----------|
| [Bài 1](./01-introduction-setup.md) | Cài đặt, Hello World, các lệnh `go` |
| [Bài 2](./02-variables-types.md) | Biến, kiểu dữ liệu, hằng số, `fmt`, `strconv` |
| [Bài 3](./03-control-flow.md) | `if`, `for`, `switch`, `defer` |
| [Bài 4](./04-functions.md) | Hàm, nhiều giá trị trả về, closure, đệ quy |
| [Bài 5](./05-arrays-slices-maps.md) | Array, slice, map, `slices`, `maps` |
| [Bài 6](./06-structs-methods-interfaces.md) | Struct, con trỏ, method, interface, generics |
| [Bài 7](./07-error-handling.md) | Error handling, `errors.Is/As`, `panic/recover` |
| [Bài 8](./08-concurrency.md) | Goroutine, channel, `sync`, `context` |
| [Bài 9](./09-packages-modules-testing.md) | Package, module, testing, benchmark |
| **Bài 10** | **REST API hoàn chỉnh với test** |

Bạn đã có đủ nền tảng để đọc hiểu phần lớn code Go ngoài thực tế. **Phần 2: Nâng cao & Thực tế** sẽ đưa bạn từ "viết được" đến "viết như người làm Go chuyên nghiệp":

| Bài | Nội dung |
|-----|----------|
| [Bài 11](./11-files-json-cli.md) | File, JSON & CLI |
| [Bài 12](./12-http-apis.md) | HTTP Client & Web API thực tế |
| [Bài 13](./13-database-sql.md) | Làm việc với Database |
| [Bài 14](./14-advanced-concurrency.md) | Concurrency Patterns nâng cao |
| [Bài 15](./15-generics-reflection-stdlib.md) | Generics nâng cao, Reflection & Thư viện chuẩn |
| [Bài 16](./16-production-ready.md) | Go trong Production - dự án tổng kết Bookmark API |

### 📚 Tài liệu đọc thêm

- 📖 **Đọc sách**: *"The Go Programming Language"* (Donovan & Kernighan), *"Learning Go"* (Jon Bodner), *"Let's Go"* (Alex Edwards - chuyên về web)
- 🌐 **Web framework** (sau khi đã vững `net/http`): Gin, Echo, Chi, Fiber
- 🔌 **gRPC & Protocol Buffers**: giao tiếp giữa các microservice
- 🧰 **Công cụ**: `golangci-lint`, `pprof` (profiling), `delve` (debugger)
- 🤝 **Đóng góp mã nguồn mở**: tìm các issue gắn nhãn "good first issue" trên các dự án Go

**Bài tiếp theo**: [Bài 11: File, JSON & CLI](./11-files-json-cli.md)

**Quay về trang chính**: [Tổng quan khóa học](./README.md)

---

💡 **Lời khuyên trước khi sang Phần 2**:

- **Viết code mỗi ngày** - kiến thức chỉ thực sự là của bạn khi bạn dùng nó
- **Đọc code thư viện chuẩn** - `net/http`, `strings`, `sort` là những ví dụ tuyệt vời về Go "chuẩn"
- **Giữ mọi thứ đơn giản** - "Clear is better than clever" (Go Proverbs)
- **Test là bạn** - `go test -race ./...` trước mỗi lần commit
- **Giữ lại dự án Todo API** - sau mỗi bài ở Phần 2, hãy thử áp dụng kiến thức mới (lưu file, database, logging...) để nâng cấp nó

**Hẹn gặp lại bạn ở Phần 2! 🐹✨**
