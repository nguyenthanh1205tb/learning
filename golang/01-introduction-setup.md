# 📚 Bài 1: Giới thiệu Go & Cài đặt môi trường

## 🎯 Mục tiêu bài học

- Hiểu Go là gì, ra đời để giải quyết vấn đề gì
- Biết khi nào nên (và không nên) dùng Go
- Cài đặt Go trên Windows, macOS và Linux
- Cài đặt VS Code + Go extension để có môi trường code "xịn"
- Tạo project đầu tiên với `go mod init`
- Viết, chạy và hiểu từng dòng của chương trình Hello World
- Thành thạo các lệnh cơ bản: `go run`, `go build`, `go fmt`, `go vet`
- Hiểu cấu trúc của một chương trình Go: `package main`, `import`, `func main`

## 📖 1. Go là gì?

### Lịch sử ngắn gọn

**Go** (hay **Golang** - gọi vậy vì trang web cũ là `golang.org`) là ngôn ngữ lập trình mã nguồn mở do Google phát triển. Go được thiết kế năm 2007 bởi ba "huyền thoại":

- **Ken Thompson** - người tạo ra hệ điều hành Unix và ngôn ngữ B (tiền thân của C)
- **Rob Pike** - đồng tác giả của UTF-8
- **Robert Griesemer** - từng làm việc trên V8 JavaScript engine

Go được công bố năm 2009, phiên bản 1.0 ra mắt năm 2012. Từ đó đến nay, Go cam kết **"Go 1 compatibility promise"**: code viết cho Go 1.0 vẫn biên dịch được với các phiên bản Go 1.x mới nhất. Đây là điều rất hiếm trong thế giới lập trình!

### Tại sao Google tạo ra Go?

Hãy tưởng tượng bạn làm việc ở Google năm 2007:

- Codebase C++ khổng lồ, **biên dịch mất 45 phút** mỗi lần 😩
- Hàng nghìn lập trình viên, mỗi người viết C++ theo một kiểu khác nhau
- Máy chủ có nhiều nhân CPU, nhưng viết code đa luồng trong C++/Java **rất khó và dễ lỗi**
- Java thì chạy tốt nhưng rườm rà, tốn RAM và khởi động chậm
- Python thì dễ viết nhưng chậm và lỗi kiểu dữ liệu chỉ phát hiện khi chạy

Go ra đời để có được **"cái tốt của cả hai thế giới"**:

| Đặc điểm | C/C++ | Java | Python | **Go** |
|----------|-------|------|--------|--------|
| Tốc độ chạy | 🚀 Rất nhanh | ⚡ Nhanh | 🐢 Chậm | ⚡ Nhanh |
| Tốc độ biên dịch | 🐢 Chậm | 😐 Trung bình | (không biên dịch) | 🚀 Rất nhanh |
| Độ dễ học | 😰 Khó | 😐 Trung bình | 😊 Dễ | 😊 Dễ |
| Quản lý bộ nhớ | Thủ công | Garbage Collector | Garbage Collector | Garbage Collector |
| Concurrency | Khó | Trung bình | Hạn chế (GIL) | 🌟 Rất dễ (goroutine) |
| Deploy | Phức tạp | Cần JVM | Cần Python runtime | 🌟 1 file binary duy nhất |

### Ví dụ so sánh: Go ngắn gọn như Python, an toàn như Java

```python
# Python - dễ viết nhưng lỗi kiểu chỉ biết khi chạy
def add(a, b):
    return a + b

add(1, "2")  # 💥 TypeError khi CHẠY
```

```go
// Go - dễ viết VÀ compiler bắt lỗi trước khi chạy
func add(a int, b int) int {
	return a + b
}

// add(1, "2") // ❌ Compiler báo lỗi ngay: cannot use "2" (untyped string constant) as int value
```

### Những đặc điểm nổi bật của Go

1. **Đơn giản**: Chỉ có 25 từ khóa (keyword). Java có hơn 50, C++ có hơn 90!
2. **Static typing**: Kiểu dữ liệu được kiểm tra lúc biên dịch → ít lỗi hơn
3. **Biên dịch ra mã máy**: Không cần máy ảo (VM), chạy nhanh
4. **Garbage Collection**: Không cần tự giải phóng bộ nhớ như C
5. **Concurrency tích hợp sẵn**: `goroutine` và `channel` là một phần của ngôn ngữ
6. **Thư viện chuẩn mạnh**: Có sẵn HTTP server, JSON, crypto, testing... không cần cài thêm
7. **Công cụ đi kèm**: format, test, benchmark, profiling, tài liệu - tất cả trong lệnh `go`
8. **Cross-compile dễ dàng**: Build file chạy cho Linux ngay trên máy Windows chỉ với 1 biến môi trường

### Go KHÔNG có gì? (Điều này là cố ý!)

Nếu bạn đến từ Java/C#/Python, bạn sẽ ngạc nhiên vì Go **không có**:

- ❌ **Class và kế thừa (inheritance)** → Go dùng `struct` + `interface` + embedding (Bài 6)
- ❌ **Exception (try/catch)** → Go trả về `error` như một giá trị bình thường (Bài 7)
- ❌ **Overloading hàm** → Mỗi hàm một tên duy nhất
- ❌ **Toán tử 3 ngôi** (`a ? b : c`) → Dùng `if/else`
- ❌ **Vòng lặp `while`** → Chỉ có `for` (nhưng `for` làm được mọi thứ)

> 💡 **Triết lý của Go**: "Less is more" - Ít tính năng hơn nghĩa là code của mọi người trông giống nhau, dễ đọc, dễ bảo trì. Bạn đọc code của người khác viết cũng dễ như đọc code của chính mình.

### Go được dùng để làm gì?

- 🌐 **Backend / Web API / Microservices** - Uber, Grab, Shopee, Tiki, MoMo... đều dùng Go
- ☁️ **Cloud & DevOps tools** - Docker, Kubernetes, Terraform, Prometheus, Grafana
- 🛠️ **CLI tools** - GitHub CLI (`gh`), Hugo, `kubectl`
- 📡 **Hệ thống mạng, proxy** - Caddy, Traefik
- 🗄️ **Database** - CockroachDB, InfluxDB, etcd

**Ít phù hợp cho**: game đồ họa 3D (dùng C++/C#), ứng dụng mobile (dùng Kotlin/Swift), data science / machine learning (dùng Python).

### 💡 Tips quan trọng

- Gọi là **Go** là chuẩn nhất, **Golang** thường dùng khi tìm kiếm Google (vì "go" quá chung chung)
- Linh vật của Go là chú chuột túi má **Gopher** 🐹, người viết Go được gọi là **Gopher**
- Go rất hợp để làm **ngôn ngữ thứ hai** sau Python/JavaScript vì nó dạy bạn tư duy về kiểu dữ liệu và bộ nhớ

## 📖 2. Cài đặt Go

### 🪟 Windows

1. Truy cập [go.dev/dl](https://go.dev/dl/)
2. Tải file `go1.24.x.windows-amd64.msi` (hoặc `arm64` nếu máy bạn chạy chip ARM)
3. Chạy file `.msi` → Next → Next → Install → Finish
4. Bộ cài tự động thêm Go vào biến `PATH` (thường là `C:\Program Files\Go\bin`)
5. **Mở PowerShell MỚI** (cửa sổ cũ không nhận PATH mới) và gõ:

```powershell
go version
# Output: go version go1.24.x windows/amd64
```

> 💡 Bạn cũng có thể dùng trình quản lý gói: `winget install GoLang.Go` hoặc `choco install golang`.

### 🍎 macOS

**Cách 1: Dùng bộ cài chính thức**

1. Tải file `go1.24.x.darwin-arm64.pkg` (máy Apple Silicon M1/M2/M3/M4) hoặc `darwin-amd64.pkg` (máy Intel)
2. Mở file `.pkg` và làm theo hướng dẫn
3. Go được cài vào `/usr/local/go`

**Cách 2: Dùng Homebrew (khuyến nghị nếu bạn đã có Homebrew)**

```bash
brew install go
```

Kiểm tra:

```bash
go version
# Output: go version go1.24.x darwin/arm64
```

### 🐧 Linux (Ubuntu/Debian/Fedora...)

```bash
# 1. Tải bản mới nhất (thay 1.24.x bằng phiên bản thực tế trên go.dev/dl)
wget https://go.dev/dl/go1.24.x.linux-amd64.tar.gz

# 2. Xóa bản cũ (nếu có) và giải nén vào /usr/local
sudo rm -rf /usr/local/go
sudo tar -C /usr/local -xzf go1.24.x.linux-amd64.tar.gz

# 3. Thêm Go vào PATH (thêm dòng này vào cuối file ~/.bashrc hoặc ~/.zshrc)
echo 'export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin' >> ~/.bashrc

# 4. Nạp lại cấu hình
source ~/.bashrc

# 5. Kiểm tra
go version
# Output: go version go1.24.x linux/amd64
```

> ⚠️ **Tránh dùng `sudo apt install golang`** trên Ubuntu cũ vì phiên bản trong kho thường rất cũ. Hãy tải trực tiếp từ go.dev.

### Kiểm tra môi trường với `go env`

```bash
go env GOPATH GOROOT GOOS GOARCH
```

```text
/home/ban/go          ← GOPATH: nơi lưu package tải về và các tool đã cài
/usr/local/go         ← GOROOT: nơi cài đặt Go
linux                 ← GOOS: hệ điều hành
amd64                 ← GOARCH: kiến trúc CPU
```

Giải thích các biến quan trọng:

| Biến | Ý nghĩa | Bạn có cần sửa không? |
|------|---------|----------------------|
| `GOROOT` | Thư mục cài Go (compiler, thư viện chuẩn) | ❌ Không |
| `GOPATH` | Nơi chứa cache module (`$GOPATH/pkg/mod`) và binary cài bằng `go install` (`$GOPATH/bin`) | ❌ Thường không |
| `GOOS`/`GOARCH` | Hệ điều hành/CPU đích khi build | Chỉ khi cross-compile |

> 💡 **Lưu ý cho người đọc tài liệu cũ**: Trước năm 2018, code Go bắt buộc phải nằm trong `$GOPATH/src`. Hiện nay với **Go Modules**, bạn có thể đặt project ở **bất kỳ đâu**. Nếu thấy hướng dẫn nào bắt bạn tạo thư mục `$GOPATH/src/github.com/...`, đó là hướng dẫn đã lỗi thời.

## 📖 3. Cài đặt VS Code + Go extension

### Bước 1: Cài VS Code

Tải từ [code.visualstudio.com](https://code.visualstudio.com) và cài đặt như bình thường.

### Bước 2: Cài Go extension

1. Mở VS Code, nhấn `Ctrl+Shift+X` (macOS: `Cmd+Shift+X`)
2. Tìm **"Go"**
3. Chọn extension có tác giả là **Go Team at Google** → **Install**

### Bước 3: Cài các công cụ hỗ trợ

1. Nhấn `Ctrl+Shift+P` (macOS: `Cmd+Shift+P`)
2. Gõ **`Go: Install/Update Tools`**
3. Tick chọn tất cả → **OK**

Các công cụ quan trọng sẽ được cài:

| Tool | Tác dụng |
|------|----------|
| `gopls` | "Bộ não" của extension: gợi ý code, đi đến định nghĩa, đổi tên biến, báo lỗi realtime |
| `dlv` (Delve) | Debugger - đặt breakpoint, xem giá trị biến |
| `staticcheck` | Kiểm tra code nâng cao, gợi ý cách viết tốt hơn |

### Bước 4: Cấu hình tự động format khi lưu

Mở Settings (`Ctrl+,`) → tìm `format on save` → tick ✅. Từ giờ mỗi lần `Ctrl+S`, code sẽ tự format theo chuẩn Go và tự thêm/xóa `import`.

### 💡 Tips quan trọng

- ✅ Luôn bật **Format on Save** - trong cộng đồng Go, code không được format là điều "không thể chấp nhận"
- ✅ Di chuột lên tên hàm để xem tài liệu, `F12` để nhảy đến định nghĩa
- ✅ `F5` để chạy debug, click vào lề trái để đặt breakpoint
- ❌ Đừng cài nhiều extension Go khác nhau, chỉ cần extension chính thức

## 📖 4. Project đầu tiên: Hello World

### Bước 1: Tạo thư mục project

```bash
mkdir hello-go
cd hello-go
```

### Bước 2: Khởi tạo module với `go mod init`

```bash
go mod init hello-go
# Output: go: creating new go.mod: module hello-go
```

Lệnh này tạo ra file `go.mod`:

```text
module hello-go

go 1.24
```

**`go.mod` là gì?** Hãy tưởng tượng nó giống như **giấy khai sinh** của project:

- `module hello-go`: **tên** (đường dẫn) của module. Các package khác trong project sẽ import theo tên này
- `go 1.24`: phiên bản Go tối thiểu mà project yêu cầu
- Sau này khi bạn dùng thư viện bên ngoài, danh sách thư viện cũng được ghi ở đây

> 💡 Nếu bạn so sánh với các ngôn ngữ khác: `go.mod` giống `package.json` (Node.js), `requirements.txt`/`pyproject.toml` (Python), `pom.xml` (Java Maven).

> 💡 **Đặt tên module**: Với project cá nhân chạy thử, đặt tên gì cũng được (`hello-go`). Với project sẽ đưa lên GitHub, nên đặt theo đường dẫn repo: `go mod init github.com/ten-ban/ten-repo`. Chi tiết ở [Bài 9](./09-packages-modules-testing.md).

### Bước 3: Viết code

Tạo file `main.go` trong thư mục `hello-go`:

```go
package main

import "fmt"

func main() {
	fmt.Println("Xin chào, Go! 🐹")
}
```

### Bước 4: Chạy chương trình

```bash
go run .
```

```text
Xin chào, Go! 🐹
```

🎉 **Chúc mừng!** Bạn vừa viết chương trình Go đầu tiên!

Cấu trúc thư mục lúc này:

```text
hello-go/
├── go.mod      ← thông tin module
└── main.go     ← code chương trình
```

## 📖 5. Giải phẫu chương trình Hello World

Hãy mổ xẻ từng dòng của chương trình trên:

```go
package main // (1) Khai báo file này thuộc package "main"

import "fmt" // (2) Nhập package "fmt" của thư viện chuẩn

// (3) Hàm main - điểm bắt đầu của chương trình
func main() {
	fmt.Println("Xin chào, Go! 🐹") // (4) Gọi hàm Println trong package fmt
}
```

### (1) `package main`

- **Mọi file Go** đều phải bắt đầu bằng dòng `package <tên>`
- **Package** là cách Go nhóm code lại với nhau (giống "namespace" trong C#, "module" trong Python)
- Tất cả file `.go` trong **cùng một thư mục** phải có **cùng tên package**
- `main` là package **đặc biệt**: nó báo cho Go biết "đây là chương trình có thể chạy được", không phải thư viện

### (2) `import "fmt"`

- `import` dùng để sử dụng code từ package khác
- `fmt` (đọc là "fumpt" hoặc "format") là package xử lý **in ấn và định dạng chuỗi**
- Khi import nhiều package, dùng dấu ngoặc tròn:

```go
import (
	"fmt"
	"math"
	"strings"
)
```

- ⚠️ **Go bắt buộc**: import package nào thì **phải dùng** package đó, nếu không sẽ **lỗi biên dịch**! (VS Code với `gopls` sẽ tự xóa import thừa khi lưu)

### (3) `func main()`

- `func` là từ khóa khai báo hàm
- Hàm `main` trong package `main` là **điểm bắt đầu** (entry point) của chương trình
- Không nhận tham số, không trả về giá trị
- Khi `main` kết thúc → chương trình kết thúc

> 💡 So sánh: giống `public static void main(String[] args)` trong Java hay `static void Main()` trong C#, nhưng ngắn gọn hơn nhiều!

### (4) `fmt.Println(...)`

- Gọi hàm `Println` trong package `fmt` theo cú pháp `tênPackage.TênHàm`
- `Println` = **Print line**: in ra rồi xuống dòng
- **Chú ý chữ `P` viết hoa**: Trong Go, tên bắt đầu bằng **chữ hoa** nghĩa là **public** (exported - có thể dùng từ package khác). Tên bắt đầu bằng chữ thường là **private** (chỉ dùng trong package đó)

### Một chương trình đầy đủ hơn

```go
package main

import (
	"fmt"
	"math"
	"strings"
)

// Hằng số ở cấp package
const appName = "Go Learning"

// Hàm phụ tự viết
func greet(name string) string {
	return "Xin chào, " + name + "!"
}

func main() {
	// In ra nhiều giá trị, tự thêm dấu cách giữa chúng
	fmt.Println("Ứng dụng:", appName)

	// Gọi hàm tự viết
	message := greet("Gopher")
	fmt.Println(message)

	// Dùng package math
	fmt.Println("Căn bậc 2 của 16 là", math.Sqrt(16))

	// Dùng package strings
	fmt.Println(strings.ToUpper("go rất vui"))

	// Printf: in có định dạng (%s = chuỗi, %d = số nguyên, %.2f = số thực 2 chữ số)
	fmt.Printf("%s có %d chữ cái, Pi ≈ %.2f\n", "Golang", 6, math.Pi)
}

// Output:
// Ứng dụng: Go Learning
// Xin chào, Gopher!
// Căn bậc 2 của 16 là 4
// GO RẤT VUI
// Golang có 6 chữ cái, Pi ≈ 3.14
```

### Các quy tắc cú pháp cơ bản

```go
// 1. KHÔNG cần dấu chấm phẩy ; ở cuối dòng (compiler tự thêm)
x := 5

// 2. Dấu { PHẢI nằm cùng dòng với if/for/func
if x > 3 { // ✅ Đúng
	fmt.Println("lớn")
}

// if x > 3
// {             // ❌ SAI - lỗi: unexpected newline, expected { after if clause
// }

// 3. Comment giống C/Java
// Đây là comment một dòng
/* Đây là comment
   nhiều dòng */

// 4. Điều kiện của if/for KHÔNG cần ngoặc tròn
if x > 3 { // ✅ Kiểu Go
}
// if (x > 3) { } // Chạy được nhưng go fmt sẽ xóa ngoặc đi
```

> 💡 **Tại sao `{` phải cùng dòng?** Vì compiler Go tự động chèn dấu `;` vào cuối dòng. Nếu bạn viết `if x > 3` rồi xuống dòng, compiler hiểu thành `if x > 3;` → lỗi. Quy tắc này giúp mọi code Go trên thế giới có cùng một phong cách.

## 📖 6. Các lệnh `go` cơ bản

Lệnh `go` là "con dao đa năng" - mọi thao tác với Go đều thông qua nó.

### 🏃 `go run` - Biên dịch và chạy ngay

```bash
go run main.go     # Chạy một file cụ thể
go run .           # Chạy package trong thư mục hiện tại (khuyến nghị)
```

- Go biên dịch code vào một thư mục tạm, chạy, rồi xóa file tạm
- Dùng trong lúc **phát triển**, thử nghiệm nhanh
- `go run .` tốt hơn `go run main.go` vì nó bao gồm **tất cả file** trong package (khi project có nhiều file)

### 🔨 `go build` - Biên dịch ra file thực thi

```bash
go build              # Tạo file hello-go (Linux/macOS) hoặc hello-go.exe (Windows)
./hello-go            # Chạy file vừa build (Windows: .\hello-go.exe)

go build -o app       # Đặt tên file output là "app"
```

- Kết quả là **một file binary duy nhất**, không cần cài Go trên máy đích để chạy
- Đây là một "siêu năng lực" của Go: copy 1 file lên server là chạy, không cần cài runtime như Java/Python/Node

**Cross-compile** - build cho hệ điều hành khác:

```bash
# Trên macOS/Linux, build file chạy cho Windows
GOOS=windows GOARCH=amd64 go build -o app.exe

# Build cho Linux (ví dụ để deploy lên server)
GOOS=linux GOARCH=amd64 go build -o app-linux
```

```powershell
# Trên Windows PowerShell, build cho Linux
$env:GOOS="linux"; $env:GOARCH="amd64"; go build -o app-linux
```

### 🎨 `go fmt` - Format code tự động

```bash
go fmt ./...     # Format tất cả file trong project (./... nghĩa là "thư mục này và mọi thư mục con")
```

Ví dụ, code viết "xấu" như thế này:

```go
package main
import "fmt"
func main(){
x:=1+2
    fmt.Println( x )
}
```

Sau khi chạy `go fmt`:

```go
package main

import "fmt"

func main() {
	x := 1 + 2
	fmt.Println(x)
}
```

- Go dùng **tab** để thụt lề (không phải space)
- **Không có tranh cãi** về style: tab hay space, `{` ở đâu... `gofmt` quyết định hết!

> 💡 Rob Pike có câu nổi tiếng: *"Gofmt's style is no one's favorite, yet gofmt is everyone's favorite."* - Không ai thích 100% style của gofmt, nhưng ai cũng thích gofmt.

### 🔍 `go vet` - Tìm lỗi "khả nghi"

`go vet` phát hiện những đoạn code **biên dịch được nhưng gần như chắc chắn là sai**:

```go
package main

import "fmt"

func main() {
	name := "Gopher"
	age := 10
	// Lỗi: %d dùng cho số nguyên nhưng truyền vào chuỗi name
	fmt.Printf("Tên: %d, Tuổi: %d\n", name, age)
}
```

```bash
go vet .
```

```text
./main.go:9:2: fmt.Printf format %d has arg name of wrong type string
```

Nếu vẫn cố chạy, bạn sẽ thấy kết quả "lạ":

```text
Tên: %!d(string=Gopher), Tuổi: 10
```

✅ **Thói quen tốt**: chạy `go vet ./...` trước mỗi lần commit code.

### 📋 Bảng tổng hợp các lệnh

| Lệnh | Tác dụng | Khi nào dùng |
|------|----------|--------------|
| `go version` | Xem phiên bản Go | Kiểm tra cài đặt |
| `go mod init <tên>` | Tạo module mới | Bắt đầu project |
| `go run .` | Biên dịch + chạy | Khi đang code |
| `go build` | Tạo file thực thi | Khi deploy |
| `go fmt ./...` | Format code | Luôn luôn (hoặc để editor làm) |
| `go vet ./...` | Kiểm tra lỗi khả nghi | Trước khi commit |
| `go test ./...` | Chạy test | Bài 9 |
| `go mod tidy` | Thêm/xóa dependency cho khớp với code | Sau khi thêm/xóa import |
| `go get <package>` | Tải thư viện bên ngoài | Khi cần thư viện |
| `go install <package>@latest` | Cài một tool dòng lệnh | Cài tool |
| `go doc fmt.Println` | Xem tài liệu ngay trong terminal | Tra cứu nhanh |
| `go env` | Xem biến môi trường của Go | Debug cài đặt |

### Thử ngay `go doc`

```bash
go doc strings.ToUpper
```

```text
package strings // import "strings"

func ToUpper(s string) string
    ToUpper returns s with all Unicode letters mapped to their upper case.
```

## 📖 7. Nhập dữ liệu từ bàn phím (bonus)

Chương trình sẽ thú vị hơn khi tương tác được với người dùng:

```go
package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

func main() {
	reader := bufio.NewReader(os.Stdin) // Tạo "đầu đọc" từ bàn phím

	fmt.Print("Nhập tên của bạn: ")
	name, _ := reader.ReadString('\n') // Đọc đến khi gặp Enter
	name = strings.TrimSpace(name)     // Xóa ký tự xuống dòng và khoảng trắng thừa

	fmt.Printf("Chào mừng %s đến với thế giới Go! 🐹\n", name)
}
```

```text
Nhập tên của bạn: Minh
Chào mừng Minh đến với thế giới Go! 🐹
```

> 💡 Dấu `_` (blank identifier) nghĩa là "tôi không quan tâm giá trị này". `ReadString` trả về 2 giá trị (chuỗi và lỗi), ở đây ta tạm bỏ qua lỗi. Bạn sẽ học cách xử lý lỗi đàng hoàng ở [Bài 7](./07-error-handling.md).

## 📖 8. Go Playground - Chạy Go không cần cài đặt

Truy cập [go.dev/play](https://go.dev/play/) để:

- Chạy thử code ngay trên trình duyệt
- Chia sẻ code với người khác qua link (nút **Share**)
- Thử nghiệm nhanh khi không có máy tính cá nhân

⚠️ Hạn chế: không đọc được bàn phím, không truy cập mạng, thời gian luôn bắt đầu từ `2009-11-10 23:00:00 UTC` (ngày Go ra mắt 😄).

## ⚠️ Lỗi thường gặp

### Lỗi 1: `go: command not found` / `'go' is not recognized`

**Nguyên nhân**: Go chưa được thêm vào `PATH`, hoặc bạn đang dùng cửa sổ terminal cũ.

**Cách sửa**:
- Đóng terminal và mở lại cửa sổ mới
- Windows: kiểm tra `C:\Program Files\Go\bin` có trong System Environment Variables → Path
- Linux/macOS: kiểm tra `echo $PATH` có chứa `/usr/local/go/bin`

### Lỗi 2: `imported and not used`

```go
package main

import (
	"fmt"
	"os" // ❌ Import nhưng không dùng
)

func main() {
	fmt.Println("Hi")
}
```

```text
./main.go:5:2: "os" imported and not used
```

**Cách sửa**: Xóa import thừa (hoặc bật Format on Save để `gopls` tự xóa).

### Lỗi 3: `declared and not used`

```go
func main() {
	x := 10 // ❌ Khai báo biến mà không dùng
}
```

```text
./main.go:4:2: declared and not used: x
```

**Tại sao Go khắt khe vậy?** Biến/import không dùng thường là dấu hiệu của bug (quên dùng, gõ nhầm tên) và làm code rối. Go chọn cách "bắt lỗi ngay" thay vì chỉ cảnh báo.

**Cách sửa**: Dùng biến đó, xóa đi, hoặc tạm gán vào `_`: `_ = x`.

### Lỗi 4: `go: go.mod file not found in current directory`

**Nguyên nhân**: Bạn chạy `go run .` hoặc `go build` ở thư mục chưa có `go.mod`.

**Cách sửa**: Chạy `go mod init <tên-module>` trước, hoặc `cd` vào đúng thư mục project.

### Lỗi 5: `package xyz is not in std` / `no required module provides package`

**Nguyên nhân**: Gõ sai tên package (`"fmts"` thay vì `"fmt"`), hoặc dùng thư viện bên ngoài mà chưa tải.

**Cách sửa**: Kiểm tra chính tả, hoặc chạy `go mod tidy` / `go get <package>`.

### Lỗi 6: Đặt `{` xuống dòng

```go
func main()
{ // ❌ syntax error: unexpected semicolon or newline before {
}
```

**Cách sửa**: Luôn đặt `{` cùng dòng với `func`, `if`, `for`, `switch`.

### Lỗi 7: `func main is undeclared in the main package` / chạy nhầm package

**Nguyên nhân**: File có `package main` nhưng không có `func main()`, hoặc đặt tên package khác `main` rồi chạy `go run`.

**Cách sửa**: Chương trình chạy được phải có **cả hai**: `package main` VÀ `func main()`.

### Lỗi 8: Nhiều `func main` trong cùng thư mục

```text
./b.go:5:6: main redeclared in this block
	./a.go:5:6: other declaration of main
```

**Nguyên nhân**: Bạn tạo `bai1.go`, `bai2.go` cùng thư mục, mỗi file đều có `func main()`. Vì chúng cùng package nên bị trùng.

**Cách sửa**: Mỗi chương trình để ở **một thư mục riêng**:

```text
go-practice/
├── go.mod
├── bai1/
│   └── main.go
└── bai2/
    └── main.go
```

Chạy bằng: `go run ./bai1` hoặc `go run ./bai2`.

## 🏋️ Bài tập

### Bài tập 1: Giới thiệu bản thân

Tạo project `about-me` và viết chương trình in ra:

```text
===== GIỚI THIỆU =====
Tên: <tên bạn>
Tuổi: <tuổi bạn>
Ngôn ngữ đang học: Go
======================
```

Yêu cầu: dùng `fmt.Println` cho dòng tiêu đề và `fmt.Printf` cho các dòng có dữ liệu.

### Bài tập 2: Thử các lệnh `go`

1. Viết code Hello World nhưng cố tình thụt lề lộn xộn, sau đó chạy `go fmt` và quan sát
2. Chạy `go build`, tìm file thực thi vừa tạo và chạy nó trực tiếp
3. Build thêm một bản cho hệ điều hành khác (ví dụ Windows nếu bạn dùng Linux) và so sánh tên file
4. Viết một lệnh `Printf` sai định dạng và chạy `go vet` để xem cảnh báo

### Bài tập 3: Máy tính mini

Viết chương trình dùng package `math` để in ra:

- Căn bậc hai của 144 (`math.Sqrt`)
- 2 mũ 10 (`math.Pow`)
- Giá trị lớn hơn giữa 3.7 và 8.2 (`math.Max`)
- Số Pi làm tròn 4 chữ số (`%.4f`)

**Gợi ý**: Gõ `go doc math` để xem danh sách hàm.

### Bài tập 4: Chào hỏi tương tác

Mở rộng ví dụ ở mục 7: hỏi thêm **năm sinh** của người dùng, sau đó in ra "Xin chào <tên>, bạn sinh năm <năm>". (Tạm thời chỉ in năm sinh dạng chuỗi, việc tính tuổi cần chuyển chuỗi sang số - bạn sẽ học ở Bài 2 với `strconv.Atoi`.)

## ✅ Checklist hoàn thành

- [ ] Hiểu Go là gì và tại sao nó được tạo ra
- [ ] Biết Go phù hợp và không phù hợp cho loại dự án nào
- [ ] Cài đặt Go thành công, `go version` chạy được
- [ ] Cài VS Code + Go extension + các tool (`gopls`, `dlv`)
- [ ] Bật Format on Save
- [ ] Tạo được project với `go mod init` và hiểu file `go.mod`
- [ ] Chạy được Hello World bằng `go run .`
- [ ] Giải thích được ý nghĩa của `package main`, `import`, `func main`
- [ ] Biết quy tắc chữ hoa = exported, chữ thường = unexported
- [ ] Dùng được `go build`, `go fmt`, `go vet`
- [ ] Hoàn thành ít nhất 3 bài tập

## 🚀 Tiếp theo

Bạn đã có môi trường làm việc hoàn chỉnh và viết được chương trình Go đầu tiên! Giờ là lúc học cách lưu trữ và xử lý dữ liệu:

- Khai báo biến bằng `var` và `:=`
- Các kiểu dữ liệu cơ bản của Go
- Hằng số và `iota`
- Định dạng chuỗi với `fmt.Printf`

**Bài tiếp theo**: [Biến & Kiểu dữ liệu](./02-variables-types.md)

---

💡 **Tips cho người mới**:

- **Gõ lại code**, đừng copy-paste - ngón tay của bạn cũng cần "học" cú pháp
- **Đọc thông báo lỗi** - compiler Go báo lỗi rất rõ ràng, kèm số dòng và số cột
- **`go fmt` + `go vet`** là hai người bạn thân nhất của bạn
- **Mỗi bài tập một thư mục** - tránh lỗi trùng `func main`
