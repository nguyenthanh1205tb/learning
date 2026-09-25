# 📚 Bài 9: Package, Module và Testing

## 🎯 Mục tiêu bài học

- Hiểu **package** là gì và cách Go tổ chức code thành package
- Phân biệt **package**, **module** và **repository**
- Nắm quy tắc **exported** (chữ hoa) và **unexported** (chữ thường)
- Tạo dự án nhiều package, import package do mình viết
- Hiểu file **`go.mod`** và **`go.sum`**, dùng `go get`, `go mod tidy`
- Biết cách **tổ chức thư mục** dự án Go phổ biến (`cmd/`, `internal/`)
- Hiểu quy tắc đặc biệt của thư mục **`internal/`**
- Viết **unit test** với package `testing`
- Viết **table-driven test** và **subtest** với `t.Run`
- Viết **benchmark** để đo hiệu năng
- Đo **độ phủ code** (coverage) với `go test -cover`

## 📖 1. Package - Đơn vị tổ chức code

### Package là gì?

**Package** là một **thư mục** chứa các file `.go` có **cùng khai báo `package`**. Đây là đơn vị cơ bản để tổ chức và tái sử dụng code trong Go.

> 💡 **Ví von**: Hãy tưởng tượng dự án là một **thư viện sách**:
> - **Package** là một **kệ sách** theo chủ đề (Toán, Văn, Lịch sử)
> - **File `.go`** là từng **cuốn sách** trên kệ
> - **Module** là **toàn bộ thư viện** - có tên, địa chỉ, danh sách sách mượn từ thư viện khác
> - **Repository** (Git repo) là **tòa nhà** chứa thư viện (thường 1 repo = 1 module)

### Quy tắc của package

1. **Một thư mục = một package**. Mọi file `.go` trong cùng thư mục phải có cùng tên `package` (ngoại trừ file test `_test.go` có thể dùng `package xxx_test`)
2. **Tên package** nên trùng với **tên thư mục** chứa nó
3. Tên package: **ngắn, chữ thường, một từ**, không gạch dưới, không camelCase: `http`, `strconv`, `mathutil` ✅ - `math_util`, `mathUtil` ❌
4. Package **`main`** là đặc biệt: tạo ra chương trình chạy được
5. Các file trong **cùng package** thấy được **mọi thứ** của nhau (kể cả unexported) mà không cần import

### Tên package là một phần của tên gọi

Khi dùng, bạn luôn viết `tênPackage.TênHàm`. Vì vậy **tránh lặp từ**:

```go
// ❌ Lặp lại: người dùng phải viết http.HTTPServer, user.UserService
package http
type HTTPServer struct{}

// ✅ Ngắn gọn: http.Server, user.Service
package http
type Server struct{}
```

## 📖 2. Exported vs Unexported

Go **không có** từ khóa `public`, `private`, `protected`. Thay vào đó, quy tắc cực kỳ đơn giản:

| Chữ cái đầu | Tên gọi | Truy cập |
|------------|---------|----------|
| **Viết HOA** (`Add`, `User`, `MaxSize`) | **Exported** | Mọi package đều dùng được |
| **viết thường** (`add`, `user`, `maxSize`) | **Unexported** | Chỉ dùng trong cùng package |

Quy tắc này áp dụng cho **mọi thứ**: hàm, biến, hằng số, kiểu, **field của struct**, method.

```go
package user

type User struct {
	Name     string // Exported: package khác đọc/ghi được
	Email    string // Exported
	password string // Unexported: chỉ package user truy cập được
}

// NewUser - exported: package khác gọi được
func NewUser(name, email, password string) *User {
	return &User{Name: name, Email: email, password: hash(password)}
}

// CheckPassword - exported method
func (u *User) CheckPassword(p string) bool {
	return u.password == hash(p)
}

// hash - unexported: chi tiết cài đặt nội bộ, bên ngoài không cần biết
func hash(s string) string {
	return "hashed:" + s // (Minh họa - thực tế dùng bcrypt!)
}
```

**Tại sao cần unexported?**
- 🔒 **Đóng gói (encapsulation)**: Ẩn chi tiết cài đặt, người dùng chỉ thấy API cần thiết
- 🔧 **Tự do thay đổi**: Bạn có thể sửa/xóa hàm unexported mà không làm hỏng code của người khác
- 🛡️ **Bảo vệ tính hợp lệ**: Người dùng không thể gán `password` tùy tiện, phải qua `NewUser`

> 💡 **Quy tắc thực tế**: Mặc định để **unexported**. Chỉ **export** những gì người dùng package thực sự cần. Export thì dễ, "un-export" sau này sẽ làm vỡ code của người khác.

## 📖 3. Module - Đơn vị phát hành

### Module là gì?

**Module** là một **tập hợp các package** được quản lý phiên bản cùng nhau. Mỗi module có một file **`go.mod`** ở thư mục gốc.

```bash
go mod init github.com/ten-ban/calc
```

Tên module (**module path**) thường là **đường dẫn repository** - để người khác có thể `go get` được. Với dự án cá nhân không công bố, tên gì cũng được (`calc`, `myapp`).

### File `go.mod`

```text
module github.com/ten-ban/calc

go 1.24

require (
	github.com/google/uuid v1.6.0
	golang.org/x/text v0.21.0
)

require golang.org/x/sync v0.10.0 // indirect
```

| Dòng | Ý nghĩa |
|------|---------|
| `module ...` | Tên (đường dẫn) của module này |
| `go 1.24` | Phiên bản Go tối thiểu, ảnh hưởng đến ngữ nghĩa ngôn ngữ (ví dụ biến vòng lặp mỗi lần lặp từ 1.22) |
| `require ...` | Các module phụ thuộc và **phiên bản** |
| `// indirect` | Phụ thuộc gián tiếp (thư viện của thư viện bạn dùng) |

### File `go.sum`

`go.sum` chứa **mã băm (checksum)** của từng phụ thuộc:

```text
github.com/google/uuid v1.6.0 h1:NIvaJDMOsjHA8n1jAhLSgzrAzy1Hgr+hNrb57e+94F0=
github.com/google/uuid v1.6.0/go.mod h1:TIyPZe4MgqvfeYDBFedMoGGpEw/LqOeaOT+nhxU+yHo=
```

- 🔐 **Bảo mật**: Đảm bảo code tải về **giống hệt** lần trước, không bị ai chỉnh sửa
- ✅ **Phải commit** cả `go.mod` và `go.sum` vào Git
- ❌ **Không sửa tay** `go.sum`

> 💡 **So sánh**: `go.mod` ≈ `package.json`, `go.sum` ≈ `package-lock.json` (Node.js).

### Các lệnh quản lý module

```bash
# Thêm thư viện (phiên bản mới nhất)
go get github.com/google/uuid

# Thêm phiên bản cụ thể
go get github.com/google/uuid@v1.6.0

# Nâng cấp tất cả phụ thuộc lên bản minor/patch mới nhất
go get -u ./...

# Gỡ thư viện
go get github.com/google/uuid@none

# Dọn dẹp: thêm thư viện còn thiếu, xóa thư viện không dùng (DÙNG THƯỜNG XUYÊN!)
go mod tidy

# Xem tất cả phụ thuộc
go list -m all

# Tải phụ thuộc về cache (hữu ích trong Docker)
go mod download
```

### Sử dụng thư viện bên ngoài

```go
package main

import (
	"fmt"

	"github.com/google/uuid" // Thư viện bên ngoài
)

func main() {
	id := uuid.New()
	fmt.Println("ID mới:", id)
}

// Output (ngẫu nhiên):
// ID mới: 3f1c9a52-8b1e-4d7a-9c2f-6e5b4a3d2c1b
```

Quy trình:
1. Viết `import "github.com/google/uuid"` trong code
2. Chạy `go mod tidy` → Go tự tải và ghi vào `go.mod`, `go.sum`
3. `go run .`

> 💡 Tìm thư viện và đọc tài liệu tại [pkg.go.dev](https://pkg.go.dev). Trước khi dùng thư viện bên ngoài, hãy kiểm tra xem **thư viện chuẩn** đã có chưa - thư viện chuẩn của Go rất mạnh!

### Semantic Versioning (SemVer)

Phiên bản module theo dạng **`vMAJOR.MINOR.PATCH`**, ví dụ `v1.6.0`:
- **MAJOR**: Thay đổi **không tương thích** (breaking change)
- **MINOR**: Thêm tính năng, **vẫn tương thích**
- **PATCH**: Sửa lỗi

⚠️ Quy tắc đặc biệt của Go: Từ **v2 trở lên**, đường dẫn module phải có hậu tố `/v2`: `github.com/ten-ban/lib/v2`. Nhờ vậy, v1 và v2 có thể cùng tồn tại trong một chương trình.

## 📖 4. Xây dựng dự án nhiều package

Hãy xây dựng một dự án máy tính nhỏ để thực hành.

### Cấu trúc thư mục

```text
calc/
├── go.mod                      ← module github.com/ten-ban/calc
├── cmd/
│   └── calc/
│       └── main.go             ← package main - điểm chạy chương trình
├── internal/
│   └── format/
│       └── format.go           ← package format - chỉ dùng nội bộ
└── mathutil/
    ├── mathutil.go             ← package mathutil - thư viện có thể tái sử dụng
    ├── mathutil_test.go        ← unit test
    └── example_test.go         ← ví dụ có thể chạy được (cũng là test)
```

### Bước 1: Khởi tạo module

```bash
mkdir calc && cd calc
go mod init github.com/ten-ban/calc
mkdir -p cmd/calc internal/format mathutil
```

### Bước 2: Viết package `mathutil`

📄 **`mathutil/mathutil.go`**

```go
// Package mathutil cung cấp các hàm toán học đơn giản.
package mathutil

import "errors"

// ErrDivideByZero được trả về khi chia cho 0.
var ErrDivideByZero = errors.New("mathutil: chia cho 0")

// Add trả về tổng của a và b.
func Add(a, b int) int {
	return a + b
}

// Divide trả về thương a / b, hoặc lỗi nếu b bằng 0.
func Divide(a, b float64) (float64, error) {
	if isZero(b) {
		return 0, ErrDivideByZero
	}
	return a / b, nil
}

// Average tính trung bình cộng. Trả về 0 nếu không có phần tử nào.
func Average(nums ...float64) float64 {
	if len(nums) == 0 {
		return 0
	}
	sum := 0.0
	for _, n := range nums {
		sum += n
	}
	return sum / float64(len(nums))
}

// IsPrime kiểm tra n có phải số nguyên tố không.
func IsPrime(n int) bool {
	if n < 2 {
		return false
	}
	for d := 2; d*d <= n; d++ {
		if n%d == 0 {
			return false
		}
	}
	return true
}

// isZero là hàm unexported: chỉ dùng được bên trong package mathutil.
func isZero(x float64) bool {
	return x == 0
}
```

> 💡 **Doc comment**: Comment ngay trên khai báo, bắt đầu bằng **tên** của thứ được mô tả (`// Add trả về...`). Công cụ `go doc` và trang pkg.go.dev sẽ hiển thị chúng làm tài liệu. Comment trên dòng `package` là tài liệu cho cả package.

### Bước 3: Viết package `internal/format`

📄 **`internal/format/format.go`**

```go
// Package format định dạng kết quả để in ra màn hình.
// Vì nằm trong internal/, chỉ code trong module calc mới import được.
package format

import "fmt"

// Result trả về chuỗi dạng "phép tính = kết quả".
func Result(expr string, value float64) string {
	return fmt.Sprintf("%-10s = %g", expr, value)
}
```

### Bước 4: Viết chương trình chính

📄 **`cmd/calc/main.go`**

```go
package main

import (
	"errors"
	"fmt"

	"github.com/ten-ban/calc/internal/format"
	"github.com/ten-ban/calc/mathutil"
)

func main() {
	fmt.Println(format.Result("2 + 3", float64(mathutil.Add(2, 3))))
	fmt.Println(format.Result("avg(1,2,6)", mathutil.Average(1, 2, 6)))

	if _, err := mathutil.Divide(1, 0); errors.Is(err, mathutil.ErrDivideByZero) {
		fmt.Println("Lỗi:", err)
	}

	// mathutil.isZero(0) // ❌ Lỗi: name isZero not exported by package mathutil
}
```

### Bước 5: Chạy

```bash
go run ./cmd/calc
```

```text
2 + 3      = 5
avg(1,2,6) = 3
Lỗi: mathutil: chia cho 0
```

**Để ý cách import**: Đường dẫn import = **tên module** + **đường dẫn thư mục**:

```text
github.com/ten-ban/calc   +   /mathutil   =   github.com/ten-ban/calc/mathutil
      (tên module)            (thư mục)            (import path)
```

### Các kiểu import đặc biệt

```go
import (
	"fmt"                          // Import thông thường
	str "strings"                  // Alias: dùng str.ToUpper thay vì strings.ToUpper
	mrand "math/rand/v2"           // Alias để tránh trùng tên với crypto/rand
	_ "github.com/lib/pq"          // Blank import: chỉ chạy init() của package (đăng ký driver DB)
)
```

> ⚠️ **Tránh dot import** (`import . "fmt"` rồi gọi `Println` trực tiếp) - làm code khó đọc vì không biết hàm đến từ đâu.

### Hàm `init()`

Mỗi package có thể có hàm `init()` - chạy **tự động một lần** khi package được nạp, **trước** `main()`:

```go
package config

var defaults map[string]string

func init() {
	defaults = map[string]string{"port": "8080"}
}
```

⚠️ **Hạn chế dùng `init()`**: nó chạy ngầm, khó test và khó theo dõi. Ưu tiên khởi tạo tường minh (constructor, hàm `Load()`).

### Import vòng tròn bị cấm

Package A import B, B lại import A → **lỗi biên dịch** `import cycle not allowed`. Go cấm điều này để giữ kiến trúc rõ ràng. Cách sửa: tách phần dùng chung ra package C, hoặc dùng interface.

## 📖 5. Cấu trúc dự án phổ biến

### Thư mục `internal/` - Quy tắc đặc biệt ⭐

Package nằm trong thư mục **`internal/`** chỉ có thể được import bởi code nằm trong **thư mục cha của `internal/`** (và các thư mục con của nó).

```text
github.com/ten-ban/calc/
├── internal/format/     ← Chỉ code trong calc/... mới import được
├── mathutil/            ← Ai cũng import được
└── cmd/calc/            ← ✅ import internal/format được
```

Nếu một module khác cố import:

```text
package example.com/other
	main.go:2:8: use of internal package github.com/ten-ban/calc/internal/format not allowed
```

> 💡 **Tại sao hữu ích?** `internal/` giúp bạn **chia code thành nhiều package** cho gọn gàng, mà **không phải cam kết** chúng là API công khai. Bạn thoải mái sửa đổi mà không sợ làm hỏng code của người khác. **Compiler bảo vệ** quy tắc này - không chỉ là quy ước!

### Bố cục thường gặp

**Dự án nhỏ** (CLI tool, script) - **để phẳng**, đừng phức tạp hóa:

```text
mytool/
├── go.mod
├── main.go
├── config.go
└── config_test.go
```

**Dự án vừa và lớn** (web service):

```text
myservice/
├── go.mod
├── go.sum
├── cmd/                    ← Mỗi thư mục con là một chương trình (package main)
│   ├── server/main.go
│   └── migrate/main.go
├── internal/               ← Code nghiệp vụ, không cho bên ngoài dùng
│   ├── handler/            ← HTTP handlers
│   ├── service/            ← Logic nghiệp vụ
│   ├── store/              ← Truy cập database
│   └── model/              ← Các struct dữ liệu
├── pkg/                    ← (Tùy chọn) Thư viện cho phép bên ngoài dùng
├── migrations/             ← File SQL
├── Makefile
└── README.md
```

> 💡 **Lời khuyên**: **Bắt đầu đơn giản** (một package), chỉ tách package khi code thực sự lớn lên. Đừng copy nguyên bố cục "chuẩn" phức tạp cho dự án 200 dòng. Hãy tổ chức package **theo chức năng/lĩnh vực** (`user`, `order`, `payment`) hơn là theo loại (`models`, `utils`, `helpers`).

> ⚠️ **Tránh** đặt tên package chung chung như `utils`, `common`, `helpers`, `misc` - chúng nhanh chóng trở thành "bãi rác" chứa đủ thứ không liên quan.

## 📖 6. Testing - Viết unit test ⭐

### Tại sao cần test?

- ✅ **Tự tin sửa code**: Sửa xong chạy test, biết ngay có làm hỏng gì không
- ✅ **Tài liệu sống**: Test cho thấy code được dùng như thế nào
- ✅ **Thiết kế tốt hơn**: Code dễ test thường là code được thiết kế tốt
- ✅ **Tìm bug sớm**: Rẻ hơn rất nhiều so với tìm bug trên production

Go có sẵn package **`testing`** và lệnh **`go test`** - **không cần cài thêm framework** như JUnit, pytest, Jest.

### Quy tắc viết test

1. File test có đuôi **`_test.go`** và đặt **cùng thư mục** với code cần test
2. Hàm test có tên bắt đầu bằng **`Test`** + chữ HOA: `TestAdd`, `TestIsPrime`
3. Hàm test nhận đúng một tham số **`t *testing.T`**
4. File `_test.go` **không được build** vào chương trình thật

### Test đầu tiên

📄 **`mathutil/mathutil_test.go`** (phần 1)

```go
package mathutil

import (
	"errors"
	"testing"
)

// Test đơn giản nhất: tên bắt đầu bằng Test, nhận *testing.T
func TestAdd(t *testing.T) {
	got := Add(2, 3)
	want := 5
	if got != want {
		t.Errorf("Add(2, 3) = %d; want %d", got, want)
	}
}
```

Chạy test:

```bash
go test ./...          # Chạy test của tất cả package
go test ./mathutil     # Chạy test của một package
go test -v ./mathutil  # Verbose: in chi tiết từng test
```

```text
ok  	github.com/ten-ban/calc/mathutil	0.003s
```

Nếu test **thất bại** (ví dụ ta sửa `want := 6`):

```text
--- FAIL: TestAdd (0.00s)
    mathutil_test.go:13: Add(2, 3) = 5; want 6
FAIL
FAIL	github.com/ten-ban/calc/mathutil	0.003s
FAIL
```

> 💡 **Quy ước thông điệp**: `Hàm(input) = kết quả thực tế; want kết quả mong đợi`. Đọc là hiểu ngay chuyện gì sai.

### Các method quan trọng của `*testing.T`

| Method | Tác dụng | Test tiếp tục chạy? |
|--------|----------|---------------------|
| `t.Errorf(format, ...)` | Báo lỗi | ✅ Có - để thấy thêm lỗi khác |
| `t.Error(...)` | Báo lỗi (không định dạng) | ✅ Có |
| `t.Fatalf(format, ...)` | Báo lỗi và **dừng test ngay** | ❌ Không |
| `t.Fatal(...)` | Như trên, không định dạng | ❌ Không |
| `t.Log(...)` / `t.Logf` | Ghi log (chỉ hiện khi `-v` hoặc test fail) | ✅ |
| `t.Skip(...)` | Bỏ qua test | - |
| `t.Helper()` | Đánh dấu hàm hỗ trợ (báo lỗi đúng dòng gọi) | - |
| `t.Run(name, func)` | Chạy subtest | - |
| `t.Cleanup(func)` | Đăng ký hàm dọn dẹp khi test xong | - |
| `t.TempDir()` | Tạo thư mục tạm, tự xóa khi test xong | - |

✅ Dùng **`Errorf`** khi các kiểm tra độc lập với nhau. Dùng **`Fatalf`** khi lỗi làm cho các kiểm tra phía sau vô nghĩa (ví dụ `err != nil` thì không cần kiểm tra kết quả).

## 📖 7. Table-Driven Tests và `t.Run` ⭐

### Vấn đề: Test lặp đi lặp lại

```go
func TestIsPrime(t *testing.T) {
	if IsPrime(2) != true { t.Error("2") }
	if IsPrime(4) != false { t.Error("4") }
	if IsPrime(13) != true { t.Error("13") }
	// ... chán ngắt và khó bảo trì 😩
}
```

### Giải pháp: Bảng test case

**Table-driven test** là phong cách test **đặc trưng nhất** của Go: định nghĩa **bảng** các trường hợp (input + output mong đợi), rồi **lặp** qua bảng.

📄 **`mathutil/mathutil_test.go`** (phần 2)

```go
// Table-driven test: nhiều trường hợp trong một bảng
func TestIsPrime(t *testing.T) {
	tests := []struct {
		name string
		n    int
		want bool
	}{
		{"số âm", -7, false},
		{"số 0", 0, false},
		{"số 1", 1, false},
		{"số 2 - nguyên tố chẵn duy nhất", 2, true},
		{"số 9 - bình phương", 9, false},
		{"số 13", 13, true},
		{"số lớn 7919", 7919, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsPrime(tt.n); got != tt.want {
				t.Errorf("IsPrime(%d) = %v; want %v", tt.n, got, tt.want)
			}
		})
	}
}
```

**Lợi ích**:
- ➕ **Thêm test case chỉ cần thêm 1 dòng** vào bảng
- 👀 **Dễ đọc**: nhìn bảng là thấy ngay các trường hợp đã được kiểm tra
- 🎯 **`t.Run`** tạo **subtest** có tên riêng: báo cáo rõ case nào lỗi, và chạy riêng được

Chạy với `-v`:

```text
=== RUN   TestIsPrime
=== RUN   TestIsPrime/số_âm
=== RUN   TestIsPrime/số_0
...
--- PASS: TestIsPrime (0.00s)
    --- PASS: TestIsPrime/số_âm (0.00s)
    --- PASS: TestIsPrime/số_0 (0.00s)
    --- PASS: TestIsPrime/số_1 (0.00s)
    --- PASS: TestIsPrime/số_2_-_nguyên_tố_chẵn_duy_nhất (0.00s)
    --- PASS: TestIsPrime/số_9_-_bình_phương (0.00s)
    --- PASS: TestIsPrime/số_13 (0.00s)
    --- PASS: TestIsPrime/số_lớn_7919 (0.00s)
```

(Dấu cách trong tên subtest được thay bằng `_`.)

### Chạy test cụ thể với `-run`

```bash
go test -run TestIsPrime ./mathutil          # Chỉ chạy TestIsPrime
go test -run 'TestIsPrime/13' -v ./mathutil  # Chỉ chạy subtest có chứa "13"
go test -run 'Divide|Average' ./mathutil     # -run nhận biểu thức chính quy (regex)
```

### Test hàm trả về error

📄 **`mathutil/mathutil_test.go`** (phần 3)

```go
func TestDivide(t *testing.T) {
	tests := []struct {
		name    string
		a, b    float64
		want    float64
		wantErr error
	}{
		{"chia bình thường", 10, 4, 2.5, nil},
		{"chia số âm", -9, 3, -3, nil},
		{"chia cho 0", 1, 0, 0, ErrDivideByZero},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Divide(tt.a, tt.b)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("Divide(%v, %v) error = %v; want %v", tt.a, tt.b, err, tt.wantErr)
			}
			if got != tt.want {
				t.Errorf("Divide(%v, %v) = %v; want %v", tt.a, tt.b, got, tt.want)
			}
		})
	}
}
```

> 💡 `errors.Is(nil, nil)` trả về `true`, nên cùng một dòng kiểm tra xử lý được cả trường hợp "không mong đợi lỗi" lẫn "mong đợi lỗi cụ thể".

### Hàm helper với `t.Helper()`

📄 **`mathutil/mathutil_test.go`** (phần 4)

```go
func TestAverage(t *testing.T) {
	assertFloat := func(t *testing.T, got, want float64) {
		t.Helper() // Báo lỗi ở dòng GỌI assertFloat, không phải dòng này
		if got != want {
			t.Errorf("got %v; want %v", got, want)
		}
	}

	t.Run("không có phần tử", func(t *testing.T) {
		assertFloat(t, Average(), 0)
	})
	t.Run("nhiều phần tử", func(t *testing.T) {
		assertFloat(t, Average(1, 2, 3, 4), 2.5)
	})
}
```

> 💡 **Thư viện assertion**: Nhiều dự án dùng thư viện `github.com/stretchr/testify` để viết `assert.Equal(t, want, got)` cho gọn. Nhưng hãy làm quen với cách viết thuần của Go trước - thư viện chuẩn là đủ cho hầu hết trường hợp.

### Test package trong và ngoài

```go
package mathutil      // "White-box": test thấy được cả hàm unexported (isZero)
package mathutil_test // "Black-box": test như người dùng bên ngoài, chỉ thấy API exported
```

Dùng `package xxx_test` khi muốn đảm bảo API công khai dễ dùng, hoặc để viết **Example**.

### Example test - Ví dụ cũng là test

📄 **`mathutil/example_test.go`**

```go
package mathutil_test

import (
	"fmt"

	"github.com/ten-ban/calc/mathutil"
)

func ExampleAdd() {
	fmt.Println(mathutil.Add(2, 3))
	// Output: 5
}

func ExampleAverage() {
	fmt.Println(mathutil.Average(2, 4, 9))
	// Output: 5
}
```

- Hàm tên `ExampleXxx` với comment **`// Output:`** ở cuối sẽ được `go test` **chạy và so sánh output**
- Đồng thời xuất hiện trong **tài liệu** trên pkg.go.dev như ví dụ sử dụng
- Tài liệu **không bao giờ lỗi thời** vì nếu sai, test sẽ fail!

## 📖 8. Coverage - Đo độ phủ code

**Coverage** cho biết bao nhiêu phần trăm code **đã được chạy qua** bởi test.

```bash
go test -cover ./...
```

```text
	github.com/ten-ban/calc/cmd/calc		coverage: 0.0% of statements
	github.com/ten-ban/calc/internal/format		coverage: 0.0% of statements
ok  	github.com/ten-ban/calc/mathutil	0.004s	coverage: 100.0% of statements
```

Xem chi tiết từng hàm:

```bash
go test -coverprofile=cover.out ./mathutil
go tool cover -func=cover.out
```

```text
github.com/ten-ban/calc/mathutil/mathutil.go:10:	Add		100.0%
github.com/ten-ban/calc/mathutil/mathutil.go:15:	Divide		100.0%
github.com/ten-ban/calc/mathutil/mathutil.go:23:	Average		100.0%
github.com/ten-ban/calc/mathutil/mathutil.go:35:	IsPrime		100.0%
github.com/ten-ban/calc/mathutil/mathutil.go:48:	isZero		100.0%
total:							(statements)	100.0%
```

Xem trực quan trên trình duyệt (dòng **xanh** = đã test, **đỏ** = chưa test):

```bash
go tool cover -html=cover.out
```

### 💡 Tips về coverage

- ✅ Coverage giúp tìm **đoạn code chưa được test** (thường là nhánh xử lý lỗi)
- ⚠️ **100% coverage ≠ không có bug**: Code được chạy qua không có nghĩa là được kiểm tra đúng
- ✅ Mục tiêu thực tế: 70-80% cho code nghiệp vụ quan trọng. Tập trung vào **logic phức tạp**, không cần test getter/setter đơn giản
- ✅ Kết hợp với race detector: `go test -race -cover ./...`

## 📖 9. Benchmark - Đo hiệu năng

**Benchmark** đo thời gian chạy của code. Hàm benchmark bắt đầu bằng **`Benchmark`** và nhận **`b *testing.B`**:

📄 **`mathutil/mathutil_test.go`** (phần 5)

```go
func BenchmarkIsPrime(b *testing.B) {
	for b.Loop() { // Go 1.24+
		IsPrime(7919)
	}
}
```

> 💡 **Trước Go 1.24**, benchmark được viết với `b.N`: `for i := 0; i < b.N; i++ { IsPrime(7919) }`. Go tự tăng `b.N` cho đến khi đo đủ lâu để có kết quả ổn định. `b.Loop()` (Go 1.24) làm việc tương tự nhưng an toàn hơn: compiler không thể "tối ưu mất" lời gọi hàm bên trong vòng lặp.

Chạy benchmark (mặc định `go test` **không** chạy benchmark):

```bash
go test -bench=. ./mathutil            # -bench nhận regex, "." = tất cả
go test -bench=. -benchmem ./mathutil  # Thêm thống kê cấp phát bộ nhớ
```

```text
goos: linux
goarch: amd64
pkg: github.com/ten-ban/calc/mathutil
cpu: Intel(R) Xeon(R) Processor @ 2.10GHz
BenchmarkIsPrime-4   	 4425651	       272.9 ns/op	       0 B/op	       0 allocs/op
PASS
ok  	github.com/ten-ban/calc/mathutil	1.213s
```

Đọc kết quả:

| Cột | Ý nghĩa |
|-----|---------|
| `BenchmarkIsPrime-4` | Tên benchmark, `-4` là số CPU được dùng (GOMAXPROCS) |
| `4425651` | Số lần hàm được chạy |
| `272.9 ns/op` | Thời gian trung bình mỗi lần chạy (**nano giây**) |
| `0 B/op` | Số byte cấp phát mỗi lần |
| `0 allocs/op` | Số lần cấp phát bộ nhớ mỗi lần |

### Ví dụ: So sánh 2 cách nối chuỗi

```go
package concat

import (
	"strings"
	"testing"
)

var words = strings.Fields("go là ngôn ngữ lập trình đơn giản nhanh và mạnh mẽ")

func BenchmarkPlusConcat(b *testing.B) {
	for b.Loop() {
		s := ""
		for _, w := range words {
			s += w + " " // Mỗi lần += tạo chuỗi mới
		}
		_ = s
	}
}

func BenchmarkBuilder(b *testing.B) {
	for b.Loop() {
		var sb strings.Builder
		for _, w := range words {
			sb.WriteString(w)
			sb.WriteString(" ")
		}
		_ = sb.String()
	}
}
```

```text
BenchmarkPlusConcat-4   	 2632760	       473.1 ns/op	     488 B/op	      12 allocs/op
BenchmarkBuilder-4      	 3701101	       309.6 ns/op	     248 B/op	       5 allocs/op
```

→ `strings.Builder` nhanh hơn ~1.5 lần, dùng ít bộ nhớ hơn một nửa và số lần cấp phát giảm từ 12 xuống 5. Với nhiều từ hơn (hàng nghìn), khoảng cách sẽ còn lớn hơn rất nhiều vì `+=` phải sao chép lại toàn bộ chuỗi mỗi lần. (Số liệu cụ thể phụ thuộc vào máy của bạn.)

> 💡 **Quy tắc tối ưu**: *"Đo trước, tối ưu sau"*. Đừng đoán phần nào chậm - hãy viết benchmark để có số liệu thật.

## 📖 10. Tổng hợp các lệnh `go test`

| Lệnh | Tác dụng |
|------|----------|
| `go test ./...` | Chạy mọi test trong module |
| `go test -v ./...` | In chi tiết từng test |
| `go test -run TestName ./pkg` | Chỉ chạy test khớp regex |
| `go test -count=1 ./...` | Bỏ qua cache, chạy lại thật |
| `go test -race ./...` | Bật race detector |
| `go test -cover ./...` | Hiển thị coverage |
| `go test -coverprofile=c.out ./...` | Ghi coverage ra file |
| `go test -bench=. ./...` | Chạy benchmark |
| `go test -bench=. -benchmem` | Benchmark + thống kê bộ nhớ |
| `go test -short ./...` | Chế độ ngắn (test kiểm tra `testing.Short()` để bỏ qua test chậm) |
| `go test -timeout 30s ./...` | Giới hạn thời gian chạy test |

> 💡 `go test` **cache** kết quả: nếu code không đổi, lần sau sẽ in `ok ... (cached)`. Dùng `-count=1` khi muốn chạy lại thật.

## ⚠️ Lỗi thường gặp

### Lỗi 1: Gọi hàm unexported từ package khác

```go
mathutil.isZero(0) // ❌ name isZero not exported by package mathutil
```

✅ Đổi thành chữ hoa nếu thực sự cần export, hoặc dùng hàm exported khác.

### Lỗi 2: Import sai đường dẫn

```go
import "mathutil"                         // ❌ package mathutil is not in std
import "./mathutil"                       // ❌ Go không hỗ trợ import tương đối trong module
import "github.com/ten-ban/calc/mathutil" // ✅ Tên module + đường dẫn thư mục
```

### Lỗi 3: Tên package không khớp trong cùng thư mục

```text
found packages mathutil (mathutil.go) and utils (helper.go) in /calc/mathutil
```

✅ Mọi file trong một thư mục phải cùng `package` (trừ `_test`).

### Lỗi 4: Import vòng tròn

```text
package github.com/ten-ban/app/a
	imports github.com/ten-ban/app/b from a.go
	imports github.com/ten-ban/app/a from b.go: import cycle not allowed
```

✅ Tách phần dùng chung ra package thứ ba, hoặc đảo ngược phụ thuộc bằng interface.

### Lỗi 5: Quên `go mod tidy`

```text
no required module provides package github.com/google/uuid; to add it:
	go get github.com/google/uuid
```

✅ Chạy `go mod tidy` sau khi thêm/xóa import.

### Lỗi 6: Đặt tên hàm test sai

```go
func testAdd(t *testing.T) {} // ❌ Chữ t thường → không được nhận là test
func TestAdd(t *testing.T) {} // ✅
func Testadd(t *testing.T) {} // ❌ Sau "Test" phải là chữ HOA (hoặc số, _)
```

### Lỗi 7: Dùng `t.Fatal` trong goroutine

```go
go func() {
	t.Fatal("lỗi") // ❌ Fatal phải được gọi từ goroutine chạy test
}()
```

✅ Dùng `t.Error` trong goroutine, hoặc gửi lỗi qua channel về goroutine test.

### Lỗi 8: Test phụ thuộc lẫn nhau hoặc phụ thuộc thứ tự

✅ Mỗi test phải **độc lập**: tự chuẩn bị dữ liệu, tự dọn dẹp (`t.Cleanup`, `t.TempDir`). Không dựa vào biến toàn cục bị test khác thay đổi.

## 🏋️ Bài tập

### Bài tập 1: Package `stringutil`

Tạo module `github.com/<tên-bạn>/textkit` với package `stringutil` gồm các hàm:
- `Reverse(s string) string` - đảo ngược chuỗi (hỗ trợ Unicode)
- `IsPalindrome(s string) bool` - kiểm tra đối xứng, không phân biệt hoa thường và bỏ qua khoảng trắng
- `WordCount(s string) map[string]int` - đếm tần suất từ

Viết `cmd/textkit/main.go` sử dụng package này.

### Bài tập 2: Table-driven test

Viết table-driven test cho 3 hàm ở bài tập 1, mỗi hàm ít nhất 5 test case, bao gồm các trường hợp biên: chuỗi rỗng, một ký tự, tiếng Việt có dấu, emoji. Đạt **100% coverage**.

### Bài tập 3: Package internal

Thêm package `internal/normalize` với hàm `Clean(s string) string` (xóa khoảng trắng thừa, chuyển chữ thường). Dùng nó trong `stringutil.IsPalindrome`. Thử tạo một module khác import `internal/normalize` để thấy lỗi.

### Bài tập 4: Benchmark

Viết 2 cách cài đặt `Reverse`: (a) dùng `[]rune` và hoán đổi, (b) nối chuỗi từ cuối về đầu bằng `+=`. Viết benchmark so sánh và giải thích kết quả với `-benchmem`.

### Bài tập 5: Example test

Viết `ExampleReverse`, `ExampleIsPalindrome` với `// Output:`. Chạy `go test -v` để thấy chúng được thực thi, rồi chạy `go doc -all ./stringutil` để thấy tài liệu.

### Bài tập 6: Dùng thư viện bên ngoài

Dùng `github.com/google/uuid` để tạo một chương trình in ra 5 UUID. Mở `go.mod` và `go.sum` để xem những gì đã thay đổi. Chạy `go list -m all`.

## ✅ Checklist hoàn thành

- [ ] Hiểu package, module, repository khác nhau thế nào
- [ ] Nắm quy tắc chữ hoa = exported, chữ thường = unexported
- [ ] Tạo module với `go mod init` và hiểu `go.mod`, `go.sum`
- [ ] Tạo dự án nhiều package và import đúng đường dẫn
- [ ] Dùng `go get`, `go mod tidy` để quản lý thư viện
- [ ] Hiểu quy tắc của thư mục `internal/`
- [ ] Biết bố cục dự án phổ biến (`cmd/`, `internal/`) và khi nào nên dùng
- [ ] Viết doc comment đúng quy ước
- [ ] Viết unit test với `t.Errorf`, `t.Fatalf`
- [ ] Viết table-driven test với `t.Run`
- [ ] Viết Example test với `// Output:`
- [ ] Đo coverage với `go test -cover`
- [ ] Viết và đọc hiểu kết quả benchmark
- [ ] Hoàn thành ít nhất 4 bài tập

## 🚀 Tiếp theo

Chúc mừng! Bạn đã học xong **toàn bộ kiến thức nền tảng** của Go. Đã đến lúc kết hợp tất cả để xây dựng một ứng dụng thực tế:

- REST API với `net/http` (routing mới của Go 1.22)
- Xử lý JSON với `encoding/json`
- Lưu trữ an toàn với `sync.Mutex`
- Test HTTP handler với `httptest`

**Bài tiếp theo**: [Dự án cuối khóa: Todo REST API](./10-final-project.md)

---

💡 **Tips ghi nhớ**:

- **Một thư mục = một package**, tên package ngắn gọn, chữ thường
- **Chữ HOA = public**, mặc định hãy để chữ thường
- **Commit cả `go.mod` và `go.sum`**, chạy `go mod tidy` thường xuyên
- **`internal/`** là "vùng riêng tư" được compiler bảo vệ
- **Table-driven test + `t.Run`** là phong cách test chuẩn của Go
- **`go test -race -cover ./...`** - câu lệnh nên chạy trước mỗi lần commit
