# 🐹 Hướng dẫn học Golang từ đầu

## 📋 Tổng quan

Chào mừng bạn đến với khóa học Golang (Go)! Đây là tài liệu hướng dẫn đầy đủ để học Go từ con số 0 đến khi tự viết được một REST API hoàn chỉnh, rồi tiếp tục nâng cao để làm việc với file, HTTP API, database và đưa ứng dụng lên production. Khóa học tập trung vào những kiến thức quan trọng nhất mà bạn sẽ dùng hằng ngày khi làm việc với Go, được giải thích **thật chi tiết và dễ hiểu**, có ví dụ chạy được, kết quả mong đợi (Output), mục **"🌍 Ứng dụng thực tế"** với các tình huống gần gũi (hóa đơn, giỏ hàng, thanh toán, gửi email...) và bài tập cho từng bài.

Khóa học gồm **2 phần**:

- **Phần 1: Cơ bản → Trung cấp** (Bài 1-10): cú pháp, cấu trúc dữ liệu, interface, xử lý lỗi, concurrency, testing và dự án tổng hợp Todo REST API
- **Phần 2: Nâng cao & Thực tế** (Bài 11-18): file/JSON/CLI, HTTP client, database, concurrency patterns nâng cao, generics & reflection, đưa Go lên production với dự án tổng kết Bookmark API, đóng gói bằng Docker và xây dựng microservice với gRPC

> 💡 **Go là gì?** Go là ngôn ngữ lập trình do Google tạo ra năm 2009 (Robert Griesemer, Rob Pike, Ken Thompson). Go nổi tiếng vì **đơn giản**, **biên dịch nhanh**, **chạy nhanh** và **hỗ trợ lập trình đồng thời (concurrency) cực tốt**. Docker, Kubernetes, Terraform, Prometheus... đều được viết bằng Go.

### 🎯 Mục tiêu khóa học

- Cài đặt và làm quen với công cụ của Go (`go run`, `go build`, `go fmt`, `go test`...)
- Nắm vững cú pháp cơ bản: biến, kiểu dữ liệu, điều kiện, vòng lặp, hàm
- Hiểu các cấu trúc dữ liệu quan trọng: array, slice, map
- Hiểu cách Go làm "hướng đối tượng" với struct, method và interface
- Xử lý lỗi đúng "phong cách Go" (idiomatic Go)
- Viết chương trình đồng thời với goroutine, channel, `sync` và `context`
- Tổ chức code thành package/module và viết unit test
- Tự xây dựng một **Todo REST API** hoàn chỉnh chỉ với thư viện chuẩn
- Đọc/ghi file, xử lý JSON và viết công cụ dòng lệnh (CLI)
- Gọi Web API bên ngoài và xây dựng HTTP service thực tế
- Làm việc với database bằng `database/sql`
- Áp dụng các concurrency pattern nâng cao, generics nâng cao, reflection và thư viện chuẩn
- Đưa ứng dụng Go lên **production** (logging, cấu hình, đóng gói, triển khai) qua dự án tổng kết **Bookmark API**
- Đóng gói và chạy ứng dụng bằng **Docker** & **Docker Compose**
- Xây dựng microservice giao tiếp bằng **gRPC** và Protocol Buffers

### ⏱️ Thời gian học tập

- **Tổng thời gian**: 8-9 tuần (1-2 giờ/ngày) - Phần 1 khoảng 5 tuần, Phần 2 khoảng 4 tuần
- **Cấp độ**: Người mới bắt đầu (biết sơ qua một ngôn ngữ lập trình bất kỳ là lợi thế, nhưng không bắt buộc)
- **Kết quả**: Có thể tự viết CLI tool, web API có database, đọc hiểu code Go trong các dự án thực tế và triển khai ứng dụng lên server

## 🛠️ Yêu cầu hệ thống

### Phần mềm cần cài đặt

1. **Go** - Phiên bản 1.23 trở lên (khuyến nghị bản mới nhất, ví dụ 1.24). Một số ví dụ dùng tính năng mới như `for i := range 10` (1.22), routing `"GET /todos/{id}"` (1.22), `maps.Keys` + `slices.Sorted` (1.23)
2. **Visual Studio Code** + extension **Go** (của Go Team at Google) - hoặc GoLand nếu bạn thích JetBrains
3. **Git** - Để quản lý code và tải package
4. **Terminal** - PowerShell (Windows), Terminal (macOS/Linux)
5. **curl** hoặc **Postman** - Để test REST API ở Bài 10 và Phần 2

### Tài nguyên học tập

- Máy tính Windows/Mac/Linux (cấu hình nào cũng được, Go rất nhẹ)
- Kết nối internet để tải Go và các package
- Một cuốn sổ (hoặc file ghi chú) để ghi lại những điều quan trọng

## 📚 Cấu trúc khóa học

### 🌱 Phần 1: Cơ bản → Trung cấp (Bài 1-10)

#### Tuần 1: Nền tảng

- [x] **Bài 1**: [Giới thiệu & Cài đặt](./01-introduction-setup.md) - Go là gì, cài đặt, Hello World, các lệnh `go`
- [x] **Bài 2**: [Biến & Kiểu dữ liệu](./02-variables-types.md) - `var`, `:=`, zero value, `const`, `iota`, ép kiểu, `fmt`, `strings`, `strconv`
- [x] **Bài 3**: [Cấu trúc điều khiển](./03-control-flow.md) - `if`, `for`, `switch`, `break`/`continue`, label, `defer`

#### Tuần 2: Hàm & Cấu trúc dữ liệu

- [x] **Bài 4**: [Hàm (Functions)](./04-functions.md) - nhiều giá trị trả về, variadic, closure, đệ quy
- [x] **Bài 5**: [Array, Slice & Map](./05-arrays-slices-maps.md) - `len`/`cap`, `append`, `copy`, map, package `slices` & `maps`

#### Tuần 3: "Hướng đối tượng" kiểu Go & Xử lý lỗi

- [x] **Bài 6**: [Struct, Method & Interface](./06-structs-methods-interfaces.md) - con trỏ, receiver, embedding, interface, generics
- [x] **Bài 7**: [Xử lý lỗi (Error Handling)](./07-error-handling.md) - `error`, `%w`, `errors.Is/As`, `panic`/`recover`

#### Tuần 4: Concurrency & Tổ chức dự án

- [x] **Bài 8**: [Concurrency](./08-concurrency.md) - goroutine, channel, `select`, `sync`, worker pool, `context`
- [x] **Bài 9**: [Package, Module & Testing](./09-packages-modules-testing.md) - `go.mod`, cấu trúc dự án, `go test`, benchmark

#### Tuần 5: Dự án tổng hợp Phần 1

- [x] **Bài 10**: [Dự án tổng hợp phần cơ bản - Todo REST API](./10-final-project.md) - `net/http`, JSON, `sync.Mutex`, `httptest`

### 🚀 Phần 2: Nâng cao & Thực tế (Bài 11-18)

#### Tuần 6: Làm việc với dữ liệu và mạng

- [x] **Bài 11**: [File, JSON & CLI](./11-files-json-cli.md)
- [x] **Bài 12**: [HTTP Client & Web API thực tế](./12-http-apis.md)

#### Tuần 7: Database & Concurrency nâng cao

- [x] **Bài 13**: [Làm việc với Database](./13-database-sql.md)
- [x] **Bài 14**: [Concurrency Patterns nâng cao](./14-advanced-concurrency.md)

#### Tuần 8: Kỹ thuật nâng cao & Production

- [x] **Bài 15**: [Generics nâng cao, Reflection & Thư viện chuẩn](./15-generics-reflection-stdlib.md)
- [x] **Bài 16**: [Go trong Production](./16-production-ready.md) - dự án tổng kết **Bookmark API**

#### Tuần 9: Docker & Microservices

- [x] **Bài 17**: [Docker cho ứng dụng Go](./17-docker.md) - Dockerfile multi-stage, Docker Compose, registry
- [x] **Bài 18**: [gRPC với Go](./18-grpc.md) - Protocol Buffers, 4 kiểu RPC, interceptors, microservices

> 💡 **Nên học Phần 2 khi nào?** Khi bạn đã hoàn thành Bài 10 và tự tin với interface, error handling, goroutine/channel và testing. Phần 2 dùng lại rất nhiều kiến thức của Phần 1.

## 🚀 Bắt đầu học

### Bước 1: Cài đặt Go

1. Truy cập [go.dev/dl](https://go.dev/dl/) và tải bộ cài phù hợp với hệ điều hành
2. **Windows**: chạy file `.msi` → Next → Next → Finish
3. **macOS**: chạy file `.pkg` hoặc dùng Homebrew: `brew install go`
4. **Linux**: giải nén file `.tar.gz` vào `/usr/local` và thêm `/usr/local/go/bin` vào `PATH`
5. Mở terminal mới và kiểm tra:

```bash
go version
# Output: go version go1.24.x <hệ điều hành>/<kiến trúc>
```

> Chi tiết từng bước cho mỗi hệ điều hành có trong [Bài 1](./01-introduction-setup.md).

### Bước 2: Cài đặt VS Code + Go extension

1. Tải VS Code từ [code.visualstudio.com](https://code.visualstudio.com)
2. Mở tab Extensions (`Ctrl+Shift+X`), tìm **Go**, cài extension của **Go Team at Google**
3. Nhấn `Ctrl+Shift+P` → gõ `Go: Install/Update Tools` → chọn tất cả → OK (sẽ cài `gopls`, `dlv`, `staticcheck`...)

### Bước 3: Tạo project đầu tiên

```bash
mkdir hello-go
cd hello-go
go mod init hello-go     # Tạo file go.mod - "giấy khai sinh" của project
```

Tạo file `main.go`:

```go
package main

import "fmt"

func main() {
	fmt.Println("Xin chào, Go! 🐹")
}
```

Chạy chương trình:

```bash
go run .
# Output: Xin chào, Go! 🐹
```

### Bước 4: Làm quen với các lệnh cơ bản

- **`go run .`**: Biên dịch và chạy ngay (dùng khi đang phát triển)
- **`go build`**: Biên dịch ra file thực thi (dùng khi triển khai)
- **`go fmt ./...`**: Tự động format code theo chuẩn
- **`go vet ./...`**: Kiểm tra các lỗi "khả nghi" trong code
- **`go test ./...`**: Chạy unit test
- **`go mod tidy`**: Dọn dẹp và tải đủ các dependency

## 📖 Cách sử dụng tài liệu

1. **Đọc tuần tự**: Các bài học được sắp xếp theo độ khó tăng dần, bài sau dùng kiến thức bài trước
2. **Gõ lại code**: Đừng copy-paste! Tự gõ lại từng ví dụ giúp bạn nhớ cú pháp lâu hơn rất nhiều
3. **So sánh Output**: Mỗi ví dụ đều có `// Output:` - hãy chạy và so sánh với kết quả của bạn
4. **Xem mục "🌍 Ứng dụng thực tế"**: Các bài có 2-3 chương trình hoàn chỉnh mô phỏng tình huống thật (hóa đơn, giỏ hàng, thanh toán, gửi email...) - giúp bạn thấy kiến thức vừa học được dùng vào đâu
5. **Đọc phần "⚠️ Lỗi thường gặp"**: Đây là những lỗi mà gần như ai học Go cũng từng mắc
6. **Làm bài tập**: Mỗi bài có phần "🏋️ Bài tập" - hãy làm trước khi sang bài mới
7. **Thử nghiệm**: Sửa code, cố tình làm sai để xem compiler báo lỗi gì

> 💡 Bạn cũng có thể chạy thử code ngay trên trình duyệt mà không cần cài đặt tại [go.dev/play](https://go.dev/play/).

## ✅ Checklist theo dõi tiến độ

### Phần 1: Cơ bản → Trung cấp

#### Tuần 1

- [ ] Hoàn thành Bài 1: Giới thiệu & Cài đặt
- [ ] Hoàn thành Bài 2: Biến & Kiểu dữ liệu
- [ ] Hoàn thành Bài 3: Cấu trúc điều khiển
- [ ] Viết được chương trình tính điểm trung bình và xếp loại học sinh

#### Tuần 2

- [ ] Hoàn thành Bài 4: Hàm
- [ ] Hoàn thành Bài 5: Array, Slice & Map
- [ ] Viết được chương trình đếm tần suất từ trong một đoạn văn

#### Tuần 3

- [ ] Hoàn thành Bài 6: Struct, Method & Interface
- [ ] Hoàn thành Bài 7: Xử lý lỗi
- [ ] Viết được chương trình quản lý tài khoản ngân hàng có xử lý lỗi đầy đủ

#### Tuần 4

- [ ] Hoàn thành Bài 8: Concurrency
- [ ] Hoàn thành Bài 9: Package, Module & Testing
- [ ] Viết được worker pool và unit test cho nó

#### Tuần 5

- [ ] Hoàn thành Bài 10: Dự án tổng hợp Todo REST API
- [ ] Test API bằng `curl` và `go test` thành công
- [ ] Mở rộng dự án với ít nhất 1 tính năng mới và đẩy lên GitHub
- [ ] Chạy lại toàn bộ ví dụ trong các mục "🌍 Ứng dụng thực tế" của Bài 1-10

### Phần 2: Nâng cao & Thực tế

#### Tuần 6

- [ ] Hoàn thành Bài 11: File, JSON & CLI
- [ ] Hoàn thành Bài 12: HTTP Client & Web API thực tế
- [ ] Viết được một công cụ dòng lệnh đọc/ghi file JSON
- [ ] Gọi được một Web API bên ngoài có xử lý timeout và lỗi

#### Tuần 7

- [ ] Hoàn thành Bài 13: Làm việc với Database
- [ ] Hoàn thành Bài 14: Concurrency Patterns nâng cao
- [ ] Thực hiện được CRUD với database thật
- [ ] Áp dụng được ít nhất một concurrency pattern nâng cao vào bài toán thực tế

#### Tuần 8

- [ ] Hoàn thành Bài 15: Generics nâng cao, Reflection & Thư viện chuẩn
- [ ] Hoàn thành Bài 16: Go trong Production
- [ ] Hoàn thành dự án tổng kết Bookmark API và đẩy lên GitHub

#### Tuần 9

- [ ] Hoàn thành Bài 17: Docker cho ứng dụng Go
- [ ] Hoàn thành Bài 18: gRPC với Go
- [ ] Chạy được Go API + PostgreSQL bằng Docker Compose
- [ ] Viết được 2 service Go giao tiếp với nhau qua gRPC

## 🎯 Tips học hiệu quả

1. **Code mỗi ngày**: Dù chỉ 30 phút cũng tốt hơn học dồn 1 lần/tuần
2. **Thực hành ngay**: Đừng chỉ đọc, hãy mở editor và gõ theo ví dụ
3. **Dùng `go fmt` và `go vet` thường xuyên**: Go có công cụ rất tốt, hãy để chúng giúp bạn
4. **Đọc thông báo lỗi**: Compiler của Go báo lỗi rất rõ ràng, đọc kỹ là biết sửa
5. **Đọc code thư viện chuẩn**: Code của Go standard library là "sách giáo khoa" tốt nhất
6. **Đừng mang tư duy ngôn ngữ khác vào**: Go không có class, không có exception, không có kế thừa - hãy chấp nhận "cách của Go"
7. **Đừng sợ lỗi**: Lỗi là cách học tốt nhất!

## 📞 Tài liệu tham khảo

- **Go Documentation**: [go.dev/doc](https://go.dev/doc/) - Tài liệu chính thức
- **A Tour of Go**: [go.dev/tour](https://go.dev/tour/) - Hướng dẫn tương tác chính thức, rất nên làm song song
- **Go by Example**: [gobyexample.com](https://gobyexample.com) - Ví dụ ngắn gọn cho từng chủ đề
- **Go Packages**: [pkg.go.dev](https://pkg.go.dev) - Tra cứu tài liệu của mọi package
- **Effective Go**: [go.dev/doc/effective_go](https://go.dev/doc/effective_go) - Cách viết Go "chuẩn"
- **Go Playground**: [go.dev/play](https://go.dev/play/) - Chạy Go trên trình duyệt

---

**Chúc bạn học tập vui vẻ và thành công! 🐹✨**

> 💡 **Lưu ý**: Tài liệu này tập trung vào những kiến thức quan trọng nhất. Khi cần tìm hiểu sâu hơn về một package nào đó, hãy tra cứu trên [pkg.go.dev](https://pkg.go.dev).
