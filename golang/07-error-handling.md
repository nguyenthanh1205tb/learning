# 📚 Bài 7: Xử lý lỗi (Error Handling)

## 🎯 Mục tiêu bài học

- Hiểu **triết lý xử lý lỗi** của Go: "lỗi là giá trị" (errors are values)
- Nắm vững interface `error` và mẫu `if err != nil`
- Tạo lỗi với `errors.New` và `fmt.Errorf`
- **Bọc lỗi** (wrapping) với `%w` để thêm ngữ cảnh
- Kiểm tra lỗi với `errors.Is` (so sánh) và `errors.As` (lấy kiểu cụ thể)
- Định nghĩa **sentinel errors** và **custom error types**
- Hiểu `panic` và `recover` - khi nào dùng, khi nào KHÔNG dùng
- Áp dụng các **best practices** xử lý lỗi trong thực tế

## 📖 1. Triết lý: Lỗi là giá trị

### Go không có exception

Trong Java, Python, C#, JavaScript, lỗi được xử lý bằng **exception** (`try/catch`):

```python
# Python
try:
    user = find_user(42)
    order = create_order(user)
except UserNotFound:
    print("Không tìm thấy user")
```

Trong Go, **lỗi chỉ là một giá trị bình thường** được hàm **trả về**:

```go
user, err := findUser(42)
if err != nil {
	fmt.Println("Không tìm thấy user:", err)
	return
}
order, err := createOrder(user)
if err != nil {
	// ...
}
```

### Tại sao Go chọn cách này?

> 💡 **Ví von**: Exception giống như **chuông báo cháy** trong tòa nhà - khi có sự cố, chuông reo và mọi người chạy ra lối thoát nào đó, **bạn không biết chắc** ai sẽ xử lý. Lỗi của Go giống như **biên bản bàn giao** - mỗi bước công việc đều ghi rõ "thành công" hay "có vấn đề gì", và người nhận **phải đọc** biên bản trước khi làm tiếp.

| | Exception | Go error |
|---|-----------|----------|
| Nhìn code có biết hàm có thể lỗi? | ❌ Không (phải đọc tài liệu) | ✅ Có (thấy `error` trong kiểu trả về) |
| Luồng chạy | Nhảy "vô hình" qua nhiều tầng | Tuần tự, rõ ràng từ trên xuống |
| Quên xử lý | Chương trình crash ở đâu đó | Linter/review dễ phát hiện `err` bị bỏ qua |
| Nhược điểm | - | Code dài hơn (nhiều `if err != nil`) |

Go chấp nhận code **dài hơn một chút** để đổi lấy sự **rõ ràng và dễ đoán**.

## 📖 2. Interface `error`

`error` là một **interface dựng sẵn** cực kỳ đơn giản:

```go
type error interface {
	Error() string
}
```

**Bất kỳ kiểu nào** có method `Error() string` đều là một `error`. (Nhớ lại interface ở [Bài 6](./06-structs-methods-interfaces.md)!)

### Mẫu xử lý lỗi cơ bản

```go
package main

import (
	"fmt"
	"strconv"
)

func main() {
	inputs := []string{"42", "abc", "3.14", "-7"}

	for _, in := range inputs {
		n, err := strconv.Atoi(in)
		if err != nil { // Luôn kiểm tra err NGAY sau khi gọi hàm
			fmt.Printf("❌ %q: %v\n", in, err)
			continue
		}
		fmt.Printf("✅ %q → %d\n", in, n)
	}
}

// Output:
// ✅ "42" → 42
// ❌ "abc": strconv.Atoi: parsing "abc": invalid syntax
// ❌ "3.14": strconv.Atoi: parsing "3.14": invalid syntax
// ✅ "-7" → -7
```

**Quy tắc vàng**:
1. Hàm có thể lỗi → trả về `error` là **giá trị cuối cùng**
2. Thành công → trả về `nil` cho error
3. Người gọi → **kiểm tra `err != nil` ngay lập tức**
4. Khi `err != nil` → **không tin tưởng** các giá trị trả về khác

## 📖 3. Tạo lỗi

### `errors.New` - Lỗi với thông điệp cố định

```go
package main

import (
	"errors"
	"fmt"
)

func sqrt(x float64) (float64, error) {
	if x < 0 {
		return 0, errors.New("không thể tính căn bậc hai của số âm")
	}
	// Phương pháp Newton đơn giản
	z := x / 2
	for range 20 {
		if z == 0 {
			break
		}
		z -= (z*z - x) / (2 * z)
	}
	return z, nil
}

func main() {
	if v, err := sqrt(16); err == nil {
		fmt.Println("√16 =", v)
	}
	if _, err := sqrt(-4); err != nil {
		fmt.Println("Lỗi:", err)
	}
}

// Output:
// √16 = 4
// Lỗi: không thể tính căn bậc hai của số âm
```

### `fmt.Errorf` - Lỗi có thông tin động

```go
func withdraw(balance, amount int) (int, error) {
	if amount > balance {
		return balance, fmt.Errorf("không đủ tiền: số dư %d, cần rút %d", balance, amount)
	}
	return balance - amount, nil
}
```

### Quy ước viết thông điệp lỗi

- ✅ **Viết thường** chữ cái đầu: `"không tìm thấy file"` (không phải `"Không tìm thấy file"`)
- ✅ **Không có dấu chấm** hay dấu `!` ở cuối
- ✅ Mô tả **cái gì** sai, kèm dữ liệu liên quan

**Lý do**: Lỗi thường được **nối chuỗi** với nhau thành một câu dài:

```text
tải cấu hình: đọc file config.json: open config.json: no such file or directory
```

Nếu mỗi lỗi viết hoa và có dấu chấm, câu sẽ trông rất lộn xộn.

## 📖 4. Bọc lỗi (Error Wrapping) với `%w` ⭐

### Vấn đề: Lỗi thiếu ngữ cảnh

Giả sử bạn thấy log: `open data.json: no such file or directory`. Câu hỏi: **Ai** mở file này? **Để làm gì**? Trong chương trình lớn, bạn sẽ không biết lỗi phát sinh ở đâu.

### Giải pháp: Thêm ngữ cảnh ở mỗi tầng

`fmt.Errorf` với verb **`%w`** (wrap) sẽ **bọc** lỗi gốc bên trong lỗi mới:

```go
package main

import (
	"errors"
	"fmt"
)

var ErrNotFound = errors.New("không tìm thấy")

// Tầng thấp nhất: truy cập "database"
func queryDB(id int) (string, error) {
	users := map[int]string{1: "An", 2: "Bình"}
	name, ok := users[id]
	if !ok {
		return "", ErrNotFound
	}
	return name, nil
}

// Tầng giữa: repository
func getUser(id int) (string, error) {
	name, err := queryDB(id)
	if err != nil {
		return "", fmt.Errorf("lấy user id=%d: %w", id, err) // Bọc + thêm ngữ cảnh
	}
	return name, nil
}

// Tầng trên: service
func greetUser(id int) (string, error) {
	name, err := getUser(id)
	if err != nil {
		return "", fmt.Errorf("chào user: %w", err)
	}
	return "Xin chào " + name, nil
}

func main() {
	msg, err := greetUser(1)
	fmt.Println(msg, err)

	_, err = greetUser(99)
	fmt.Println("Lỗi:", err)

	// Lỗi gốc vẫn được "giữ" bên trong!
	fmt.Println("Có phải ErrNotFound?", errors.Is(err, ErrNotFound))

	// Unwrap bóc từng lớp
	fmt.Println("Bóc 1 lớp:", errors.Unwrap(err))
}

// Output:
// Xin chào An <nil>
// Lỗi: chào user: lấy user id=99: không tìm thấy
// Có phải ErrNotFound? true
// Bóc 1 lớp: lấy user id=99: không tìm thấy
```

> 💡 **Ví von**: Bọc lỗi giống như **búp bê Nga** hoặc **gói quà nhiều lớp giấy**: lớp ngoài cùng ghi "chào user", mở ra thấy "lấy user id=99", mở tiếp thấy lỗi gốc "không tìm thấy". Bạn có đầy đủ **câu chuyện** về lỗi, mà vẫn lấy được lỗi gốc để kiểm tra.

### `%w` vs `%v`

```go
err1 := fmt.Errorf("thêm ngữ cảnh: %w", original) // ✅ BỌC: errors.Is/As vẫn tìm được original
err2 := fmt.Errorf("thêm ngữ cảnh: %v", original) // Chỉ lấy CHUỖI: mất liên kết với original
```

| | `%w` | `%v` |
|---|------|------|
| Thông điệp | Giống nhau | Giống nhau |
| `errors.Is`/`errors.As` tìm được lỗi gốc | ✅ Có | ❌ Không |
| Khi nào dùng | Muốn người gọi kiểm tra được lỗi gốc | Muốn "giấu" chi tiết nội bộ |

## 📖 5. `errors.Is` - Kiểm tra lỗi cụ thể

### Sentinel errors - "Lỗi mốc"

**Sentinel error** là biến lỗi **được định nghĩa sẵn ở cấp package**, dùng để so sánh. Quy ước đặt tên bắt đầu bằng `Err`:

```go
var (
	ErrNotFound     = errors.New("không tìm thấy")
	ErrUnauthorized = errors.New("không có quyền truy cập")
	ErrInvalidInput = errors.New("dữ liệu không hợp lệ")
)
```

Thư viện chuẩn có nhiều sentinel error nổi tiếng: `io.EOF`, `sql.ErrNoRows`, `os.ErrNotExist`, `context.DeadlineExceeded`, `http.ErrServerClosed`...

### Dùng `errors.Is` thay vì `==`

```go
package main

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
)

func main() {
	_, err := os.Open("file-khong-ton-tai.txt")

	// ❌ So sánh == sẽ SAI vì err là *fs.PathError bọc bên ngoài fs.ErrNotExist
	fmt.Println("So sánh ==:", err == fs.ErrNotExist)

	// ✅ errors.Is "bóc" từng lớp để tìm
	fmt.Println("errors.Is:", errors.Is(err, fs.ErrNotExist))

	if errors.Is(err, fs.ErrNotExist) {
		fmt.Println("→ File không tồn tại, tạo file mặc định...")
	}
}

// Output:
// So sánh ==: false
// errors.Is: true
// → File không tồn tại, tạo file mặc định...
```

### Xử lý theo từng loại lỗi

```go
package main

import (
	"errors"
	"fmt"
)

var (
	ErrNotFound     = errors.New("không tìm thấy")
	ErrUnauthorized = errors.New("không có quyền")
)

func deletePost(userRole string, postID int) error {
	if userRole != "admin" {
		return fmt.Errorf("xóa bài %d: %w", postID, ErrUnauthorized)
	}
	if postID > 100 {
		return fmt.Errorf("xóa bài %d: %w", postID, ErrNotFound)
	}
	return nil
}

func handle(role string, id int) {
	err := deletePost(role, id)
	switch {
	case err == nil:
		fmt.Println("200 OK - Đã xóa")
	case errors.Is(err, ErrNotFound):
		fmt.Println("404 Not Found -", err)
	case errors.Is(err, ErrUnauthorized):
		fmt.Println("403 Forbidden -", err)
	default:
		fmt.Println("500 Internal Server Error -", err)
	}
}

func main() {
	handle("admin", 5)
	handle("admin", 500)
	handle("guest", 5)
}

// Output:
// 200 OK - Đã xóa
// 404 Not Found - xóa bài 500: không tìm thấy
// 403 Forbidden - xóa bài 5: không có quyền
```

> 💡 Đây chính là cách một web API chuyển lỗi nghiệp vụ thành **HTTP status code** - bạn sẽ làm điều này ở [Bài 10](./10-final-project.md).

## 📖 6. Custom Error Types và `errors.As`

### Khi nào cần custom error type?

Sentinel error chỉ mang **một thông điệp cố định**. Khi cần lỗi mang **thêm dữ liệu** (tên field bị sai, mã lỗi, thời gian thử lại...), hãy tạo **kiểu lỗi riêng**:

```go
package main

import (
	"errors"
	"fmt"
)

// ValidationError mang thông tin chi tiết về field bị lỗi
type ValidationError struct {
	Field   string
	Value   any
	Message string
}

// Implement interface error (dùng pointer receiver)
func (e *ValidationError) Error() string {
	return fmt.Sprintf("field %q (giá trị %v): %s", e.Field, e.Value, e.Message)
}

type User struct {
	Name  string
	Age   int
	Email string
}

func validate(u User) error {
	if u.Name == "" {
		return &ValidationError{Field: "name", Value: u.Name, Message: "không được rỗng"}
	}
	if u.Age < 0 || u.Age > 150 {
		return &ValidationError{Field: "age", Value: u.Age, Message: "phải từ 0 đến 150"}
	}
	return nil
}

func register(u User) error {
	if err := validate(u); err != nil {
		return fmt.Errorf("đăng ký thất bại: %w", err)
	}
	return nil
}

func main() {
	users := []User{
		{Name: "An", Age: 20},
		{Name: "", Age: 20},
		{Name: "Bình", Age: 200},
	}

	for _, u := range users {
		err := register(u)
		if err == nil {
			fmt.Println("✅ Đăng ký thành công:", u.Name)
			continue
		}

		// errors.As: tìm trong chuỗi lỗi một lỗi có kiểu *ValidationError
		var ve *ValidationError
		if errors.As(err, &ve) {
			fmt.Printf("❌ Lỗi field [%s]: %s\n", ve.Field, ve.Message)
			fmt.Println("   Toàn bộ:", err)
		} else {
			fmt.Println("❌ Lỗi khác:", err)
		}
	}
}

// Output:
// ✅ Đăng ký thành công: An
// ❌ Lỗi field [name]: không được rỗng
//    Toàn bộ: đăng ký thất bại: field "name" (giá trị ): không được rỗng
// ❌ Lỗi field [age]: phải từ 0 đến 150
//    Toàn bộ: đăng ký thất bại: field "age" (giá trị 200): phải từ 0 đến 150
```

### `errors.Is` vs `errors.As`

| | `errors.Is(err, target)` | `errors.As(err, &target)` |
|---|--------------------------|---------------------------|
| Hỏi gì? | "Lỗi này **có phải là** X không?" | "Lỗi này **có thuộc kiểu** T không? Nếu có, **đưa cho tôi**" |
| So sánh | Theo **giá trị** (sentinel) | Theo **kiểu** (custom type) |
| Kết quả | `bool` | `bool` + gán giá trị vào `target` |
| Ví dụ | `errors.Is(err, io.EOF)` | `errors.As(err, &pathErr)` |

> ⚠️ Tham số thứ 2 của `errors.As` phải là **con trỏ tới biến** có kiểu lỗi: `&ve` (với `ve` có kiểu `*ValidationError`). Truyền sai sẽ panic - `go vet` sẽ cảnh báo giúp bạn.

### Ví dụ với thư viện chuẩn

```go
package main

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"strconv"
)

func main() {
	_, err := os.ReadFile("/khong/co/file.txt")
	var pathErr *fs.PathError
	if errors.As(err, &pathErr) {
		fmt.Println("Thao tác:", pathErr.Op)
		fmt.Println("Đường dẫn:", pathErr.Path)
		fmt.Println("Lỗi gốc:", pathErr.Err)
	}

	_, err = strconv.Atoi("99999999999999999999")
	var numErr *strconv.NumError
	if errors.As(err, &numErr) {
		fmt.Println("Hàm:", numErr.Func, "| Input:", numErr.Num, "| Lý do:", numErr.Err)
		fmt.Println("Có phải lỗi tràn số?", errors.Is(err, strconv.ErrRange))
	}
}

// Output:
// Thao tác: open
// Đường dẫn: /khong/co/file.txt
// Lỗi gốc: no such file or directory
// Hàm: Atoi | Input: 99999999999999999999 | Lý do: value out of range
// Có phải lỗi tràn số? true
```

### Kết hợp nhiều lỗi với `errors.Join` (Go 1.20+)

Khi validate form, bạn muốn báo **tất cả** lỗi cùng lúc thay vì từng cái một:

```go
package main

import (
	"errors"
	"fmt"
)

var ErrEmpty = errors.New("không được rỗng")

func validateForm(name, email, password string) error {
	var errs []error
	if name == "" {
		errs = append(errs, fmt.Errorf("tên: %w", ErrEmpty))
	}
	if email == "" {
		errs = append(errs, fmt.Errorf("email: %w", ErrEmpty))
	}
	if len(password) < 8 {
		errs = append(errs, errors.New("mật khẩu: phải có ít nhất 8 ký tự"))
	}
	return errors.Join(errs...) // Trả về nil nếu errs rỗng
}

func main() {
	err := validateForm("", "", "123")
	fmt.Println(err)
	fmt.Println("---")
	fmt.Println("Có lỗi rỗng?", errors.Is(err, ErrEmpty))
	fmt.Println("Form hợp lệ:", validateForm("An", "an@go.vn", "12345678") == nil)
}

// Output:
// tên: không được rỗng
// email: không được rỗng
// mật khẩu: phải có ít nhất 8 ký tự
// ---
// Có lỗi rỗng? true
// Form hợp lệ: true
```

## 📖 7. `panic` và `recover`

### `panic` là gì?

`panic` dừng luồng chạy bình thường của chương trình ngay lập tức. Nó:
1. Dừng hàm hiện tại
2. Chạy các `defer` của hàm đó
3. Đi ngược lên hàm gọi, chạy `defer` của từng hàm
4. Nếu không ai `recover` → **chương trình crash** và in ra stack trace

```go
package main

import "fmt"

func main() {
	defer fmt.Println("defer vẫn chạy trước khi crash!")
	fmt.Println("Bắt đầu")
	panic("có gì đó sai nghiêm trọng!")
	// fmt.Println("Không bao giờ chạy tới đây")
}
```

```text
Bắt đầu
defer vẫn chạy trước khi crash!
panic: có gì đó sai nghiêm trọng!

goroutine 1 [running]:
main.main()
	/path/to/main.go:8 +0x...
exit status 2
```

Panic cũng tự xảy ra khi có lỗi runtime:

```go
var m map[string]int
m["a"] = 1                 // panic: assignment to entry in nil map

s := []int{1, 2}
_ = s[5]                   // panic: runtime error: index out of range [5] with length 2

var p *User
_ = p.Name                 // panic: runtime error: invalid memory address or nil pointer dereference

a, b := 1, 0
_ = a / b                  // panic: runtime error: integer divide by zero
```

### `recover` - "Bắt" panic

`recover()` **chỉ có tác dụng bên trong hàm được `defer`**. Nó chặn panic lại và trả về giá trị đã truyền vào `panic`:

```go
package main

import (
	"fmt"
)

// safeDivide biến panic thành error
func safeDivide(a, b int) (result int, err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("đã phục hồi từ panic: %v", r)
		}
	}()
	return a / b, nil // Nếu b == 0 → panic
}

func main() {
	fmt.Println(safeDivide(10, 2))
	fmt.Println(safeDivide(1, 0))
	fmt.Println("Chương trình vẫn tiếp tục chạy bình thường 🎉")
}

// Output:
// 5 <nil>
// 0 đã phục hồi từ panic: runtime error: integer divide by zero
// Chương trình vẫn tiếp tục chạy bình thường 🎉
```

> 💡 Để ý cách dùng **named return** `err` kết hợp với `defer` - đúng như quy tắc 3 của `defer` bạn học ở [Bài 4](./04-functions.md)!

### Khi nào dùng `panic`?

❌ **KHÔNG dùng panic** cho lỗi thông thường có thể dự đoán: file không tồn tại, input sai, mạng lỗi, không tìm thấy user... → **Trả về `error`**.

✅ **Chỉ dùng panic** khi:
- **Lỗi lập trình** không thể xảy ra nếu code đúng (trạng thái "không thể có")
- **Khởi tạo thất bại** ở lúc khởi động chương trình mà không thể tiếp tục (ví dụ regex hằng số sai cú pháp)
- Quy ước **`MustXxx`**: hàm có tiền tố `Must` sẽ panic thay vì trả về error

```go
// regexp.MustCompile panic nếu pattern sai - dùng cho pattern là HẰNG SỐ lúc khởi động
var emailRegex = regexp.MustCompile(`^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$`)

// template.Must tương tự
var tmpl = template.Must(template.New("x").Parse("Hello {{.Name}}"))
```

### Khi nào dùng `recover`?

Hầu như **chỉ ở "biên"** của chương trình để tránh một lỗi nhỏ làm sập cả hệ thống:
- **HTTP server**: Một request bị panic không nên làm sập server (thư viện `net/http` đã tự `recover` cho mỗi request)
- **Worker/goroutine** chạy lâu dài
- ⚠️ **Lưu ý**: `recover` chỉ bắt được panic trong **cùng goroutine**. Panic trong goroutine khác không được recover sẽ làm sập cả chương trình!

> 💡 **So sánh**: `panic`/`recover` **trông giống** `throw`/`catch` nhưng **đừng dùng như vậy**! Trong Go, đó là cơ chế cho tình huống **thực sự bất thường**, không phải để điều khiển luồng chương trình.

## 📖 8. Best Practices - Xử lý lỗi chuyên nghiệp

### ✅ 1. Xử lý lỗi MỘT lần

Mỗi lỗi chỉ nên được **xử lý một lần**: hoặc **log**, hoặc **trả về** - không làm cả hai.

```go
// ❌ Vừa log vừa return → lỗi bị log nhiều lần ở nhiều tầng
if err != nil {
	log.Println("lỗi khi lưu:", err)
	return err
}

// ✅ Bọc thêm ngữ cảnh rồi return, để tầng trên cùng quyết định log
if err != nil {
	return fmt.Errorf("lưu đơn hàng %d: %w", id, err)
}
```

### ✅ 2. Thêm ngữ cảnh hữu ích khi bọc

```go
// ❌ Ngữ cảnh vô nghĩa
return fmt.Errorf("error: %w", err)
return fmt.Errorf("lỗi xảy ra: %w", err)

// ✅ Nói rõ đang làm gì, với dữ liệu nào
return fmt.Errorf("đọc cấu hình từ %s: %w", path, err)
return fmt.Errorf("gửi email tới user %d: %w", userID, err)
```

### ✅ 3. Đừng bỏ qua lỗi một cách âm thầm

```go
data, _ := os.ReadFile("config.json") // ❌ Nếu lỗi, data rỗng mà không ai biết

// ✅ Nếu thực sự muốn bỏ qua, hãy ghi chú lý do
_ = conn.Close() // Bỏ qua lỗi đóng kết nối vì đã gửi xong dữ liệu
```

### ✅ 4. Giữ "happy path" ở lề trái

```go
// ✅ Xử lý lỗi và return sớm, code chính không bị lồng sâu
func process(path string) error {
	f, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("mở file: %w", err)
	}
	defer f.Close()

	data, err := io.ReadAll(f)
	if err != nil {
		return fmt.Errorf("đọc file: %w", err)
	}

	if err := save(data); err != nil {
		return fmt.Errorf("lưu dữ liệu: %w", err)
	}
	return nil
}
```

### ✅ 5. Chọn loại lỗi phù hợp

| Tình huống | Dùng |
|-----------|------|
| Lỗi đơn giản, người gọi chỉ cần biết "có lỗi" | `errors.New` / `fmt.Errorf` |
| Người gọi cần phân biệt loại lỗi | Sentinel error `var ErrX = errors.New(...)` + `errors.Is` |
| Người gọi cần dữ liệu chi tiết từ lỗi | Custom error type + `errors.As` |
| Nhiều lỗi cùng lúc | `errors.Join` |
| Lỗi lập trình không thể phục hồi | `panic` |

### ✅ 6. Trả về `nil` tường minh cho error

```go
// ✅ Đúng
func doWork() error {
	// ...
	return nil
}

// ❌ Sai - "interface chứa nil pointer" (xem Bài 6, Lỗi 5)
func doWork() error {
	var err *MyError
	return err // err != nil ở phía người gọi!
}
```

## 📖 9. Ví dụ tổng hợp: Hệ thống chuyển tiền

```go
package main

import (
	"errors"
	"fmt"
)

// Sentinel errors
var (
	ErrAccountNotFound = errors.New("tài khoản không tồn tại")
	ErrSameAccount     = errors.New("không thể chuyển cho chính mình")
)

// Custom error type mang dữ liệu
type InsufficientFundsError struct {
	AccountID string
	Balance   int
	Requested int
}

func (e *InsufficientFundsError) Error() string {
	return fmt.Sprintf("tài khoản %s không đủ tiền (số dư %d, cần %d)",
		e.AccountID, e.Balance, e.Requested)
}

func (e *InsufficientFundsError) Shortfall() int {
	return e.Requested - e.Balance
}

type Bank struct {
	accounts map[string]int
}

func NewBank() *Bank {
	return &Bank{accounts: map[string]int{"A001": 500, "A002": 100}}
}

func (b *Bank) Transfer(from, to string, amount int) error {
	if amount <= 0 {
		return fmt.Errorf("chuyển tiền: số tiền %d không hợp lệ", amount)
	}
	if from == to {
		return fmt.Errorf("chuyển tiền %s→%s: %w", from, to, ErrSameAccount)
	}
	fromBal, ok := b.accounts[from]
	if !ok {
		return fmt.Errorf("chuyển tiền: tài khoản nguồn %s: %w", from, ErrAccountNotFound)
	}
	if _, ok := b.accounts[to]; !ok {
		return fmt.Errorf("chuyển tiền: tài khoản đích %s: %w", to, ErrAccountNotFound)
	}
	if fromBal < amount {
		return fmt.Errorf("chuyển tiền: %w",
			&InsufficientFundsError{AccountID: from, Balance: fromBal, Requested: amount})
	}
	b.accounts[from] -= amount
	b.accounts[to] += amount
	return nil
}

func main() {
	bank := NewBank()
	cases := []struct {
		from, to string
		amount   int
	}{
		{"A001", "A002", 200},
		{"A002", "A001", 1000},
		{"A001", "A999", 50},
		{"A001", "A001", 50},
		{"A001", "A002", -5},
	}

	for _, c := range cases {
		err := bank.Transfer(c.from, c.to, c.amount)

		var fundsErr *InsufficientFundsError
		switch {
		case err == nil:
			fmt.Printf("✅ %s → %s: %d thành công\n", c.from, c.to, c.amount)
		case errors.As(err, &fundsErr):
			fmt.Printf("💸 %v → gợi ý nạp thêm %d\n", err, fundsErr.Shortfall())
		case errors.Is(err, ErrAccountNotFound):
			fmt.Printf("🔍 %v\n", err)
		case errors.Is(err, ErrSameAccount):
			fmt.Printf("🔁 %v\n", err)
		default:
			fmt.Printf("❌ %v\n", err)
		}
	}
	fmt.Println("Số dư cuối:", bank.accounts)
}

// Output:
// ✅ A001 → A002: 200 thành công
// 💸 chuyển tiền: tài khoản A002 không đủ tiền (số dư 300, cần 1000) → gợi ý nạp thêm 700
// 🔍 chuyển tiền: tài khoản đích A999: tài khoản không tồn tại
// 🔁 chuyển tiền A001→A001: không thể chuyển cho chính mình
// ❌ chuyển tiền: số tiền -5 không hợp lệ
// Số dư cuối: map[A001:300 A002:300]
```

## ⚠️ Lỗi thường gặp

### Lỗi 1: Bỏ qua lỗi

```go
result, _ := riskyOperation() // ❌ Dùng result mà không biết nó có hợp lệ không
```

✅ Luôn kiểm tra `err`. Công cụ `errcheck` (có trong `golangci-lint`) giúp phát hiện lỗi bị bỏ qua.

### Lỗi 2: So sánh lỗi bằng `==` hoặc so sánh chuỗi

```go
if err == ErrNotFound { }                     // ❌ Sai nếu err đã bị bọc
if err.Error() == "không tìm thấy" { }       // ❌ Rất dễ vỡ khi đổi thông điệp
if strings.Contains(err.Error(), "not found") {} // ❌

if errors.Is(err, ErrNotFound) { }            // ✅
```

### Lỗi 3: Dùng `%v` khi muốn bọc lỗi

```go
return fmt.Errorf("tải user: %v", err) // ❌ errors.Is không còn tìm được lỗi gốc
return fmt.Errorf("tải user: %w", err) // ✅
```

### Lỗi 4: Truyền sai tham số cho `errors.As`

```go
var ve ValidationError       // ❌ Nếu Error() dùng pointer receiver, phải là *ValidationError
errors.As(err, ve)           // ❌ Thiếu & → panic: errors: target must be a non-nil pointer

var ve *ValidationError
errors.As(err, &ve)          // ✅
```

### Lỗi 5: Dùng `panic` cho lỗi thông thường

```go
func findUser(id int) User {
	// ...
	panic("user not found") // ❌ Đây là tình huống bình thường, phải trả về error
}
```

### Lỗi 6: `recover` không nằm trong hàm defer

```go
func main() {
	recover()          // ❌ Không có tác dụng gì - chỉ hoạt động trong defer
	panic("boom")
}
```

### Lỗi 7: Dùng giá trị trả về khi đã có lỗi

```go
n, err := strconv.Atoi(input)
total += n // ❌ Dùng n trước khi kiểm tra err
if err != nil { ... }
```

### Lỗi 8: Viết hoa / thêm dấu chấm trong thông điệp lỗi

```go
errors.New("Không tìm thấy user.") // ❌ staticcheck (ST1005) sẽ cảnh báo: viết hoa + dấu chấm cuối
errors.New("không tìm thấy user")  // ✅
```

## 🏋️ Bài tập

### Bài tập 1: Parse tuổi

Viết hàm `parseAge(s string) (int, error)`:
- Trả về lỗi bọc lỗi của `strconv` nếu không phải số (dùng `%w`)
- Trả về sentinel `ErrNegativeAge` nếu tuổi âm
- Trả về sentinel `ErrTooOld` nếu tuổi > 150

Test với `"25"`, `"abc"`, `"-3"`, `"200"` và dùng `errors.Is` để in thông báo phù hợp cho từng trường hợp.

### Bài tập 2: Custom error cho HTTP

Tạo kiểu `HTTPError` có các field `StatusCode int` và `Message string`. Viết hàm `fetch(url string) error` giả lập:
- URL rỗng → `HTTPError{400, "URL rỗng"}`
- URL chứa "admin" → `HTTPError{403, "cấm truy cập"}`
- URL chứa "missing" → `HTTPError{404, "không tìm thấy"}`

Ở `main`, dùng `errors.As` để lấy `StatusCode` và in ra.

### Bài tập 3: Validate form đầy đủ

Viết hàm `validateProduct(name string, price int, stock int) error` trả về **tất cả** lỗi bằng `errors.Join`:
- Tên không rỗng, tối đa 50 ký tự
- Giá > 0
- Tồn kho >= 0

### Bài tập 4: Safe runner

Viết hàm `safeRun(f func()) (err error)` chạy hàm `f` và chuyển mọi panic thành error. Test với:
- Hàm bình thường
- Hàm truy cập slice ngoài phạm vi
- Hàm gọi `panic("tùy chỉnh")`

### Bài tập 5: Đọc file cấu hình

Viết hàm `loadConfig(path string) (map[string]string, error)` đọc file dạng `key=value` mỗi dòng (dùng `os.ReadFile` và `strings.Split`). Bọc lỗi với ngữ cảnh rõ ràng. Trả về custom error `*ParseError{Line int, Content string}` nếu có dòng không đúng định dạng. Ở `main`, phân biệt được "file không tồn tại" (`errors.Is(err, fs.ErrNotExist)`) và "sai định dạng" (`errors.As`).

## ✅ Checklist hoàn thành

- [ ] Hiểu tại sao Go dùng "lỗi là giá trị" thay vì exception
- [ ] Viết thành thạo mẫu `if err != nil { return ... }`
- [ ] Tạo lỗi bằng `errors.New` và `fmt.Errorf`
- [ ] Viết thông điệp lỗi đúng quy ước (chữ thường, không dấu chấm)
- [ ] Bọc lỗi với `%w` và hiểu khác biệt với `%v`
- [ ] Định nghĩa và dùng sentinel errors với `errors.Is`
- [ ] Tạo custom error type và dùng `errors.As`
- [ ] Gộp nhiều lỗi với `errors.Join`
- [ ] Hiểu `panic`/`recover` và biết khi nào (không) nên dùng
- [ ] Áp dụng nguyên tắc "xử lý lỗi một lần"
- [ ] Hoàn thành ít nhất 3 bài tập

## 🚀 Tiếp theo

Bạn đã biết cách viết code Go **an toàn và đáng tin cậy**! Giờ là lúc khám phá **"siêu năng lực"** nổi tiếng nhất của Go:

- Goroutine - chạy hàng nghìn tác vụ đồng thời
- Channel - giao tiếp giữa các goroutine
- `select`, `sync.WaitGroup`, `sync.Mutex`
- Worker pool và `context`

**Bài tiếp theo**: [Concurrency](./08-concurrency.md)

---

💡 **Tips ghi nhớ**:

- **Lỗi là giá trị** - kiểm tra ngay, xử lý rõ ràng
- **`%w` để bọc**, **`errors.Is` để so sánh**, **`errors.As` để lấy kiểu**
- **Thêm ngữ cảnh** mỗi khi trả lỗi lên tầng trên
- **Xử lý một lần**: log HOẶC return, không cả hai
- **`panic` chỉ cho lỗi lập trình** - lỗi nghiệp vụ luôn dùng `error`
