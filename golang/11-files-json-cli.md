# 📚 Bài 11: File, JSON & CLI

## 🎯 Mục tiêu bài học

- Đọc/ghi file với `os`, hiểu khi nào đọc **cả file** và khi nào đọc **từng dòng**
- Hiểu hai interface "xương sống" của Go: **`io.Reader`** và **`io.Writer`**
- Đọc file **rất lớn** (hàng GB) mà không tốn RAM với `bufio.Scanner`
- Làm việc với đường dẫn và thư mục: `path/filepath`, `os.ReadDir`, `filepath.WalkDir`
- Dùng `encoding/json` ở mức **nâng cao**: struct tags, `omitempty`/`omitzero`, `MarshalJSON`/`UnmarshalJSON` tự viết, `json.Decoder` đọc kiểu streaming, `json.RawMessage`
- Đọc/ghi file **CSV** với `encoding/csv` (kể cả file xuất từ Excel)
- Viết **công cụ dòng lệnh (CLI)** chuyên nghiệp: `os.Args`, package `flag`, subcommand, exit code, stdin/stdout, biến môi trường
- Xây dựng 3 công cụ thực tế: **phân tích log**, **chuyển CSV → JSON**, **quản lý config**

> 💡 **Vì sao bài này quan trọng?** Phần lớn công việc "hằng ngày" của lập trình viên backend/DevOps là: đọc file log, xử lý file CSV khách hàng gửi, đọc file cấu hình, viết script tự động hóa. Go cực kỳ mạnh ở mảng này vì chỉ cần `go build` là có **một file chạy duy nhất**, copy lên server nào cũng chạy - không cần cài Python, Node hay JVM. Docker, kubectl, terraform, gh (GitHub CLI) đều là CLI viết bằng Go!

## 📖 1. Đọc và ghi file cơ bản

### Cách đơn giản nhất: `os.ReadFile` và `os.WriteFile`

Khi file **nhỏ** (vài KB đến vài chục MB), cách đơn giản nhất là đọc/ghi **cả file một lần**:

```go
package main

import (
	"errors"
	"fmt"
	"io/fs"
	"log"
	"os"
	"path/filepath"
)

func main() {
	// Tạo thư mục tạm để ví dụ không làm "bẩn" máy của bạn
	dir, err := os.MkdirTemp("", "bai11-*")
	if err != nil {
		log.Fatal(err)
	}
	defer os.RemoveAll(dir) // Dọn dẹp khi chương trình kết thúc

	path := filepath.Join(dir, "hello.txt")

	// Ghi cả file một lần. 0o644 = chủ file được đọc/ghi, người khác chỉ đọc
	content := []byte("Xin chào Go!\nDòng thứ hai\n")
	if err := os.WriteFile(path, content, 0o644); err != nil {
		log.Fatal(err)
	}

	// Đọc cả file vào bộ nhớ → []byte
	data, err := os.ReadFile(path)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Đọc được %d byte:\n%s", len(data), data)

	// Đọc file không tồn tại → lỗi. Dùng errors.Is để kiểm tra loại lỗi
	_, err = os.ReadFile(filepath.Join(dir, "khong-co.txt"))
	if errors.Is(err, fs.ErrNotExist) {
		fmt.Println("File không tồn tại!")
	}
}

// Output:
// Đọc được 30 byte:
// Xin chào Go!
// Dòng thứ hai
// File không tồn tại!
```

> 💡 **Tại sao 30 byte mà không phải 26 ký tự?** Go lưu chuỗi dạng **UTF-8**. Các chữ có dấu như `à`, `ò` chiếm 2 byte, `ứ` chiếm 3 byte. Nhớ lại [Bài 2](./02-variables-types.md): `len()` đếm **byte**, không phải ký tự.

### Quyền file (permission) `0o644` nghĩa là gì?

Trên Linux/macOS, mỗi file có quyền cho 3 nhóm: **chủ file** (owner), **nhóm** (group), **người khác** (others). Mỗi nhóm là tổng của: đọc `4`, ghi `2`, thực thi `1`.

| Giá trị | Ý nghĩa | Dùng cho |
|---------|---------|----------|
| `0o644` | owner đọc+ghi, còn lại chỉ đọc | File thông thường |
| `0o600` | chỉ owner đọc+ghi | File chứa **bí mật** (token, mật khẩu) |
| `0o755` | owner toàn quyền, còn lại đọc+thực thi | **Thư mục**, file chạy được |
| `0o700` | chỉ owner toàn quyền | Thư mục riêng tư |

> ⚠️ Số quyền phải viết ở **hệ bát phân** (`0o644` hoặc `0644`). Viết `644` (thập phân) là **sai hoàn toàn** - bạn sẽ được file với quyền kỳ quặc. Trên Windows, quyền này gần như bị bỏ qua.

### Mở file "thủ công": `os.Open`, `os.Create`, `os.OpenFile`

Khi cần kiểm soát nhiều hơn (ghi nối tiếp, ghi từng phần, đọc từng dòng...), ta mở file và nhận về `*os.File`:

| Hàm | Tương đương | Dùng khi |
|-----|-------------|----------|
| `os.Open(name)` | `OpenFile(name, O_RDONLY, 0)` | Chỉ **đọc** |
| `os.Create(name)` | `OpenFile(name, O_RDWR\|O_CREATE\|O_TRUNC, 0o666)` | Tạo mới / **ghi đè** |
| `os.OpenFile(name, flag, perm)` | - | Tùy chỉnh: ghi **nối tiếp** (append)... |

Các cờ (flag) hay dùng, kết hợp bằng `|`:

| Cờ | Ý nghĩa |
|----|---------|
| `os.O_RDONLY` / `os.O_WRONLY` / `os.O_RDWR` | Chỉ đọc / chỉ ghi / đọc và ghi |
| `os.O_CREATE` | Tạo file nếu chưa có |
| `os.O_APPEND` | Ghi vào **cuối** file (không ghi đè) |
| `os.O_TRUNC` | Xóa sạch nội dung cũ khi mở |
| `os.O_EXCL` | Dùng với `O_CREATE`: **báo lỗi** nếu file đã tồn tại |

```go
package main

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"path/filepath"
)

// appendLine ghi thêm một dòng vào cuối file (tạo file nếu chưa có)
// Giống cách các chương trình ghi file log
func appendLine(path, line string) error {
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	defer f.Close()

	_, err = fmt.Fprintln(f, line) // *os.File là một io.Writer → dùng được Fprintln
	return err
}

// writeReport ghi nhiều dòng qua bộ đệm (buffer) - nhanh hơn nhiều khi ghi hàng nghìn dòng
// Dùng named return (err) để có thể "bắt" lỗi của Close
func writeReport(path string, lines []string) (err error) {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer func() {
		// Với file GHI, Close có thể báo lỗi (ví dụ đầy ổ đĩa) → không được bỏ qua
		if cerr := f.Close(); cerr != nil && err == nil {
			err = cerr
		}
	}()

	w := bufio.NewWriter(f) // Gom dữ liệu vào bộ đệm 4KB rồi mới ghi xuống đĩa
	for i, l := range lines {
		fmt.Fprintf(w, "%d. %s\n", i+1, l)
	}
	return w.Flush() // ❗ Đẩy phần còn lại trong bộ đệm xuống file. Quên Flush = mất dữ liệu!
}

func main() {
	dir, err := os.MkdirTemp("", "bai11-*")
	if err != nil {
		log.Fatal(err)
	}
	defer os.RemoveAll(dir)

	logPath := filepath.Join(dir, "app.log")
	for _, msg := range []string{"server khởi động", "có request mới", "server dừng"} {
		if err := appendLine(logPath, msg); err != nil {
			log.Fatal(err)
		}
	}

	reportPath := filepath.Join(dir, "report.txt")
	if err := writeReport(reportPath, []string{"Go", "Rust", "Python"}); err != nil {
		log.Fatal(err)
	}

	for _, p := range []string{logPath, reportPath} {
		data, _ := os.ReadFile(p)
		fmt.Printf("== %s ==\n%s", filepath.Base(p), data)
	}
}

// Output:
// == app.log ==
// server khởi động
// có request mới
// server dừng
// == report.txt ==
// 1. Go
// 2. Rust
// 3. Python
```

> 💡 **Ví von bộ đệm (buffer)**: Không có `bufio.Writer`, mỗi lần `Fprintf` là một chuyến xe chở **một món hàng** xuống kho (một lần gọi hệ điều hành - syscall, khá chậm). Có `bufio.Writer`, bạn chất hàng lên **xe tải**, đầy xe (4KB) mới chạy một chuyến. `Flush()` là "chạy chuyến cuối dù xe chưa đầy" - quên nó thì hàng còn trên xe sẽ **không bao giờ tới kho**.

### 💡 Tips quan trọng

- ✅ **Luôn `defer f.Close()`** ngay sau khi mở file thành công (sau khi kiểm tra `err`)
- ✅ Với file **ghi**, kiểm tra lỗi của `Close()` (hoặc gọi `f.Sync()` nếu dữ liệu cực kỳ quan trọng)
- ✅ Dùng `bufio.Writer` khi ghi nhiều lần nhỏ, và **luôn `Flush()`**
- ✅ Dùng `filepath.Join` để nối đường dẫn - tự dùng `/` hay `\` đúng theo hệ điều hành
- ⚠️ `os.ReadFile` đọc **toàn bộ** file vào RAM - với file 5GB, chương trình sẽ "nổ" RAM

## 📖 2. `io.Reader` và `io.Writer` - "Ống nước" của Go ⭐

### Hai interface nhỏ nhưng có võ

Đây là hai interface quan trọng bậc nhất trong thư viện chuẩn:

```go
type Reader interface {
	Read(p []byte) (n int, err error) // Đọc tối đa len(p) byte vào p. Hết dữ liệu → err = io.EOF
}

type Writer interface {
	Write(p []byte) (n int, err error) // Ghi p ra đâu đó
}
```

> 💡 **Ví von ống nước**: `io.Reader` là **vòi nước** - bạn hứng từng ca nước (từng đoạn byte) cho tới khi vòi cạn (`io.EOF`). `io.Writer` là **cái cống** - đổ nước vào là nó đưa đi đâu đó. Bạn không cần biết nước từ **bể nào** (file, mạng, chuỗi, bộ nhớ) hay chảy về **đâu** - chỉ cần nối các ống với nhau.

Rất nhiều kiểu trong thư viện chuẩn implement hai interface này:

| Kiểu | `io.Reader` | `io.Writer` |
|------|:-----------:|:-----------:|
| `*os.File` (file, `os.Stdin`, `os.Stdout`) | ✅ | ✅ |
| `*strings.Reader` (`strings.NewReader`) | ✅ | |
| `*bytes.Buffer` | ✅ | ✅ |
| `http.Response.Body` | ✅ | |
| `http.ResponseWriter` | | ✅ |
| `*gzip.Reader` / `*gzip.Writer` | ✅ | ✅ |
| `*bufio.Reader` / `*bufio.Writer` | ✅ | ✅ |

**Vì sao quan trọng?** Nếu hàm của bạn nhận `io.Reader` thay vì tên file, nó dùng được cho **mọi nguồn dữ liệu**: file, stdin, body của HTTP request, chuỗi trong test... Đây chính là "Accept interfaces, return structs" ở [Bài 6](./06-structs-methods-interfaces.md).

```go
package main

import (
	"bufio"
	"bytes"
	"fmt"
	"io"
	"os"
	"strings"
)

// countWords nhận BẤT KỲ nguồn dữ liệu nào: file, stdin, mạng, chuỗi...
func countWords(r io.Reader) (int, error) {
	sc := bufio.NewScanner(r)
	sc.Split(bufio.ScanWords) // Tách theo từ thay vì theo dòng
	n := 0
	for sc.Scan() {
		n++
	}
	return n, sc.Err()
}

func main() {
	// 1. Nguồn là một chuỗi - cực tiện khi viết test
	n, _ := countWords(strings.NewReader("Go là ngôn ngữ rất vui"))
	fmt.Println("Số từ:", n)

	// 2. Nguồn là một bytes.Buffer
	var buf bytes.Buffer
	buf.WriteString("một hai ba\nbốn năm")
	n, _ = countWords(&buf)
	fmt.Println("Số từ:", n)

	// 3. io.Copy: "nối ống" từ Reader sang Writer, không cần tự viết vòng lặp
	io.Copy(os.Stdout, strings.NewReader("Chảy thẳng ra màn hình\n"))

	// 4. io.LimitReader: chỉ cho chảy tối đa N byte (chống đọc quá nhiều)
	io.Copy(os.Stdout, io.LimitReader(strings.NewReader("abcdefghij"), 4))
	fmt.Println()

	// 5. io.MultiWriter: một nguồn, nhiều đích (giống lệnh tee trên Linux)
	var logBuf bytes.Buffer
	w := io.MultiWriter(os.Stdout, &logBuf)
	fmt.Fprintln(w, "Ghi vào cả màn hình lẫn buffer")
	fmt.Println("Buffer đang chứa", logBuf.Len(), "byte")
}

// Output:
// Số từ: 6
// Số từ: 5
// Chảy thẳng ra màn hình
// abcd
// Ghi vào cả màn hình lẫn buffer
// Buffer đang chứa 38 byte
```

> 💡 `fmt.Fprintln(w, ...)`, `fmt.Fprintf(w, ...)` ghi vào **bất kỳ** `io.Writer` nào. `fmt.Println` thực chất là `fmt.Fprintln(os.Stdout, ...)`.

## 📖 3. Đọc file lớn từng dòng với `bufio.Scanner` ⭐

### Vấn đề

File log của server có thể nặng **vài GB**. `os.ReadFile` sẽ tải toàn bộ vào RAM → chương trình chậm hoặc bị hệ điều hành "giết" (OOM - Out Of Memory).

> 💡 **Ví von**: Đọc cả file giống **bê cả thùng nước** lên uống. Đọc từng dòng giống **rót từng cốc** - thùng to bao nhiêu cũng uống được, tay bạn chỉ cần cầm một cốc.

### `bufio.Scanner` - đọc từng dòng, RAM gần như không đổi

```go
package main

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
)

// createBigLog tạo file log giả gồm n dòng (để ví dụ tự chạy được)
func createBigLog(path string, n int) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	w := bufio.NewWriter(f)
	for i := range n {
		level := "INFO"
		if i%7 == 0 {
			level = "ERROR"
		}
		fmt.Fprintf(w, "line=%d level=%s msg=\"xử lý request\"\n", i, level)
	}
	return w.Flush()
}

func main() {
	dir, _ := os.MkdirTemp("", "bai11-*")
	defer os.RemoveAll(dir)
	path := filepath.Join(dir, "big.log")
	if err := createBigLog(path, 200_000); err != nil {
		log.Fatal(err)
	}

	f, err := os.Open(path)
	if err != nil {
		log.Fatal(err)
	}
	defer f.Close()

	total, errors := 0, 0
	sc := bufio.NewScanner(f) // Mặc định tách theo dòng (bufio.ScanLines)
	for sc.Scan() {           // Scan() trả về false khi hết file HOẶC gặp lỗi
		line := sc.Text() // Dòng hiện tại, ĐÃ bỏ ký tự xuống dòng \n (và \r\n)
		total++
		if strings.Contains(line, "level=ERROR") {
			errors++
		}
	}
	// ❗ BẮT BUỘC: kiểm tra lỗi sau vòng lặp - Scan() trả false không có nghĩa là "hết file"
	if err := sc.Err(); err != nil {
		log.Fatal("lỗi khi đọc:", err)
	}

	fmt.Printf("Tổng: %d dòng, ERROR: %d dòng\n", total, errors)
}

// Output:
// Tổng: 200000 dòng, ERROR: 28572 dòng
```

Dù file có 200 nghìn dòng hay 2 tỉ dòng, chương trình chỉ giữ **một dòng** trong bộ nhớ tại mỗi thời điểm.

### Cái bẫy: dòng dài hơn 64KB

Mặc định `bufio.Scanner` chỉ chứa được một dòng **tối đa 64KB**. File có dòng dài hơn (ví dụ log chứa cả JSON lớn, file minified) sẽ khiến `Scan()` dừng giữa chừng với lỗi `bufio.Scanner: token too long`. Nếu bạn **quên kiểm tra `sc.Err()`**, chương trình âm thầm bỏ qua phần còn lại của file!

```go
package main

import (
	"bufio"
	"fmt"
	"strings"
)

func countLines(input string, maxLine int) (int, error) {
	sc := bufio.NewScanner(strings.NewReader(input))
	if maxLine > 0 {
		// Buffer(bộ đệm ban đầu, kích thước dòng tối đa cho phép)
		sc.Buffer(make([]byte, 0, 64*1024), maxLine)
	}
	n := 0
	for sc.Scan() {
		n++
	}
	return n, sc.Err()
}

func main() {
	longLine := strings.Repeat("x", 100_000) // Một dòng dài 100KB
	input := "dòng 1\n" + longLine + "\ndòng 3\n"

	n, err := countLines(input, 0) // Dùng giới hạn mặc định 64KB
	fmt.Println("Mặc định:", n, "dòng, lỗi:", err)

	n, err = countLines(input, 1024*1024) // Cho phép dòng tới 1MB
	fmt.Println("Tăng buffer:", n, "dòng, lỗi:", err)
}

// Output:
// Mặc định: 1 dòng, lỗi: bufio.Scanner: token too long
// Tăng buffer: 3 dòng, lỗi: <nil>
```

> 💡 Nếu **không biết trước** dòng dài bao nhiêu, dùng `bufio.Reader.ReadString('\n')` - nó không giới hạn độ dài dòng (nhưng một dòng khổng lồ vẫn nằm trọn trong RAM). Lưu ý `ReadString` trả về dòng **kèm** `\n` và trả `io.EOF` cùng với dòng cuối nếu dòng cuối không có `\n`.

### So sánh các cách đọc file

| Cách | RAM | Dùng khi |
|------|-----|----------|
| `os.ReadFile` | Cả file | File nhỏ: config, template, JSON vài MB |
| `bufio.Scanner` | 1 dòng (≤ 64KB mặc định) | File lớn xử lý **theo dòng**: log, CSV, NDJSON |
| `bufio.Reader.ReadString` | 1 dòng (không giới hạn) | Dòng có thể rất dài |
| `io.Copy` | 32KB | Chuyển nguyên file: copy, upload, nén |
| `json.Decoder` / `csv.Reader` | 1 phần tử | JSON/CSV lớn (xem mục 5, 6) |

## 📖 4. Đường dẫn và thư mục

### `path/filepath` - xử lý đường dẫn đúng mọi hệ điều hành

Windows dùng `C:\Users\an\file.txt`, Linux/macOS dùng `/home/an/file.txt`. Package `path/filepath` tự xử lý khác biệt này.

```go
package main

import (
	"fmt"
	"path/filepath"
)

func main() {
	p := filepath.Join("data", "2026", "09", "report.final.csv") // Tự dùng / hoặc \ theo OS
	fmt.Println("Join:", p)
	fmt.Println("Base:", filepath.Base(p)) // Tên file
	fmt.Println("Dir: ", filepath.Dir(p))  // Thư mục chứa
	fmt.Println("Ext: ", filepath.Ext(p))  // Phần mở rộng (chỉ phần sau dấu chấm CUỐI)

	// Bỏ phần mở rộng
	name := filepath.Base(p)
	fmt.Println("Tên không đuôi:", name[:len(name)-len(filepath.Ext(name))])

	// Clean: chuẩn hóa đường dẫn "lộn xộn"
	fmt.Println("Clean:", filepath.Clean("data//2026/../2025/./x.txt"))

	// Rel: đường dẫn tương đối từ base tới target
	rel, _ := filepath.Rel("/srv/app", "/srv/app/logs/today.log")
	fmt.Println("Rel:", rel)

	// Match: so khớp mẫu (glob)
	ok, _ := filepath.Match("*.csv", "sales.csv")
	fmt.Println("Match *.csv:", ok)
}

// Output (trên Linux/macOS):
// Join: data/2026/09/report.final.csv
// Base: report.final.csv
// Dir:  data/2026/09
// Ext:  .csv
// Tên không đuôi: report.final
// Clean: data/2025/x.txt
// Rel: logs/today.log
// Match *.csv: true
```

> ⚠️ **`path` vs `path/filepath`**: Package `path` (không có `filepath`) **luôn** dùng `/` - dành cho URL và đường dẫn trong `embed`/`io/fs`. Với file trên ổ đĩa, **luôn dùng `path/filepath`**.

### Duyệt thư mục: `os.ReadDir` và `filepath.WalkDir`

- **`os.ReadDir(dir)`**: liệt kê **một cấp** (như lệnh `ls`), kết quả đã sắp xếp theo tên
- **`filepath.WalkDir(root, fn)`**: đi **đệ quy** vào mọi thư mục con (như lệnh `find`)

```go
package main

import (
	"fmt"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"strings"
)

// Tạo cây thư mục mẫu
func setup(root string) {
	files := map[string]string{
		"main.go":                "package main",
		"README.md":              "# Dự án",
		"internal/db/db.go":      "package db",
		"internal/db/db_test.go": "package db",
		"web/index.html":         "<h1>Hi</h1>",
		"web/app.js":             "console.log(1)",
		".git/config":            "[core]",
		"node_modules/x/x.js":    "// rác",
	}
	for name, content := range files {
		path := filepath.Join(root, filepath.FromSlash(name))
		os.MkdirAll(filepath.Dir(path), 0o755) // Tạo cả các thư mục cha (như mkdir -p)
		os.WriteFile(path, []byte(content), 0o644)
	}
}

func main() {
	root, _ := os.MkdirTemp("", "project-*")
	defer os.RemoveAll(root)
	setup(root)

	// 1. ReadDir - chỉ một cấp
	entries, err := os.ReadDir(root)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("== Cấp đầu tiên ==")
	for _, e := range entries {
		kind := "📄"
		if e.IsDir() {
			kind = "📁"
		}
		fmt.Println(kind, e.Name())
	}

	// 2. WalkDir - đệ quy, bỏ qua .git và node_modules
	fmt.Println("== File .go (đệ quy) ==")
	sizeByExt := map[string]int64{}
	err = filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err // Lỗi khi đọc thư mục (ví dụ không có quyền)
		}
		if d.IsDir() && (d.Name() == ".git" || d.Name() == "node_modules") {
			return fs.SkipDir // Không đi vào thư mục này
		}
		if d.IsDir() {
			return nil
		}
		info, err := d.Info() // Lấy thêm thông tin: kích thước, thời gian sửa...
		if err != nil {
			return err
		}
		sizeByExt[filepath.Ext(path)] += info.Size()
		if strings.HasSuffix(path, ".go") {
			rel, _ := filepath.Rel(root, path)
			fmt.Println("  ", filepath.ToSlash(rel))
		}
		return nil
	})
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("Dung lượng .go:", sizeByExt[".go"], "byte")

	// 3. Kiểm tra file/thư mục có tồn tại không
	if _, err := os.Stat(filepath.Join(root, "go.mod")); os.IsNotExist(err) {
		fmt.Println("Chưa có go.mod")
	}
}

// Output:
// == Cấp đầu tiên ==
// 📁 .git
// 📄 README.md
// 📁 internal
// 📄 main.go
// 📁 node_modules
// 📁 web
// == File .go (đệ quy) ==
//    internal/db/db.go
//    internal/db/db_test.go
//    main.go
// Dung lượng .go: 32 byte
// Chưa có go.mod
```

**Giải thích**:

- `WalkDir` duyệt theo **thứ tự từ điển** (lexical), nên kết quả luôn ổn định
- Trả về `fs.SkipDir` từ hàm callback = "đừng đi vào thư mục này" - cực hữu ích để bỏ qua `.git`, `node_modules`, `vendor`
- Trả về lỗi khác → `WalkDir` **dừng ngay** và trả lỗi đó ra ngoài
- `filepath.WalkDir` (Go 1.16+) nhanh hơn `filepath.Walk` cũ vì không gọi `os.Stat` cho mọi file - chỉ gọi `d.Info()` khi bạn thật sự cần

> 💡 **Thói quen tốt**: `os.Stat` + `errors.Is(err, fs.ErrNotExist)` (hoặc `os.IsNotExist(err)`) là cách chuẩn để kiểm tra "file có tồn tại không". Nhưng đừng lạm dụng kiểu "kiểm tra rồi mới mở" - giữa hai bước, file có thể bị xóa. Cách an toàn hơn là cứ **mở luôn** và xử lý lỗi `fs.ErrNotExist` nếu có.

## 📖 5. JSON nâng cao với `encoding/json` ⭐

Ở [Bài 10](./10-final-project.md) bạn đã dùng JSON cơ bản. Giờ ta đi sâu vào những tình huống thực tế hay gặp.

### 5.1. Struct tags - "Nhãn dán" điều khiển JSON

| Tag | Ý nghĩa |
|-----|---------|
| `json:"name"` | Đổi tên field trong JSON |
| `json:"name,omitempty"` | Bỏ qua nếu là giá trị "rỗng": `0`, `""`, `false`, `nil`, slice/map rỗng |
| `json:"name,omitzero"` | (Go 1.24+) Bỏ qua nếu là **zero value** - dùng được cho struct như `time.Time` |
| `json:"-"` | **Không bao giờ** xuất/nhận field này (mật khẩu, dữ liệu nội bộ) |
| `json:"id,string"` | Ghi số dưới dạng chuỗi: `"id":"123"` (hữu ích với JavaScript vì số > 2⁵³ bị mất chính xác) |

```go
package main

import (
	"encoding/json"
	"fmt"
	"time"
)

type Product struct {
	ID        int64     `json:"id,string"`           // Số lớn → gửi dạng chuỗi cho JS
	Name      string    `json:"name"`                // Đổi tên thành chữ thường
	Price     int64     `json:"price"`               // Tiền: dùng số nguyên (đồng), KHÔNG dùng float
	Discount  int       `json:"discount,omitempty"`  // 0 → không xuất hiện
	Tags      []string  `json:"tags,omitempty"`      // nil hoặc rỗng → không xuất hiện
	Note      *string   `json:"note"`                // Con trỏ: nil → null, phân biệt được "" và "không có"
	CostPrice int64     `json:"-"`                   // Giá nhập: bí mật kinh doanh, không lộ ra API
	CreatedAt time.Time `json:"created_at,omitzero"` // time.Time rỗng → bỏ qua (omitempty KHÔNG làm được)
	internal  string    // Field viết thường: encoding/json không nhìn thấy
}

func main() {
	note := "Hàng mới về"
	p1 := Product{
		ID: 9007199254740993, Name: "Bàn phím", Price: 1_250_000, Discount: 10,
		Tags: []string{"hot"}, Note: &note, CostPrice: 900_000,
		CreatedAt: time.Date(2026, 9, 25, 10, 0, 0, 0, time.UTC),
	}
	p2 := Product{ID: 2, Name: "Chuột", Price: 350_000, internal: "x"}

	b1, _ := json.MarshalIndent(p1, "", "  ") // Có thụt lề - dễ đọc
	fmt.Println(string(b1))

	b2, _ := json.Marshal(p2) // Gọn trên một dòng - dùng khi gửi qua mạng
	fmt.Println(string(b2))
}

// Output:
// {
//   "id": "9007199254740993",
//   "name": "Bàn phím",
//   "price": 1250000,
//   "discount": 10,
//   "tags": [
//     "hot"
//   ],
//   "note": "Hàng mới về",
//   "created_at": "2026-09-25T10:00:00Z"
// }
// {"id":"2","name":"Chuột","price":350000,"note":null}
```

> 💡 **Tại sao tiền dùng `int64` chứ không phải `float64`?** Vì `0.1 + 0.2 = 0.30000000000000004` trong máy tính. Với tiền Việt (không có xu lẻ) lưu số **đồng**; với USD lưu số **cent**. Đây là quy tắc vàng của mọi hệ thống thanh toán.

### 5.2. Phân biệt "không gửi" và "gửi giá trị 0" bằng con trỏ

Khi làm API cập nhật một phần (PATCH), bạn cần biết client **không gửi** field `price` (giữ nguyên) hay **gửi `price: 0`** (đổi thành miễn phí). Với `int` thường, cả hai đều ra `0`. Dùng **con trỏ**:

```go
package main

import (
	"encoding/json"
	"fmt"
)

type UpdateProduct struct {
	Name  *string `json:"name"`
	Price *int64  `json:"price"`
}

func describe(body string) {
	var req UpdateProduct
	if err := json.Unmarshal([]byte(body), &req); err != nil {
		fmt.Println("Lỗi:", err)
		return
	}
	if req.Name != nil {
		fmt.Printf("  đổi tên thành %q\n", *req.Name)
	}
	if req.Price != nil {
		fmt.Printf("  đổi giá thành %d\n", *req.Price)
	}
	if req.Name == nil && req.Price == nil {
		fmt.Println("  không có gì để cập nhật")
	}
}

func main() {
	for _, body := range []string{
		`{"price": 0}`,
		`{"name": "Chuột không dây"}`,
		`{}`,
		`{"price": "rẻ"}`,
	} {
		fmt.Println(body)
		describe(body)
	}
}

// Output:
// {"price": 0}
//   đổi giá thành 0
// {"name": "Chuột không dây"}
//   đổi tên thành "Chuột không dây"
// {}
//   không có gì để cập nhật
// {"price": "rẻ"}
// Lỗi: json: cannot unmarshal string into Go struct field UpdateProduct.price of type int64
```

### 5.3. JSON "không rõ cấu trúc": `map[string]any` và cái bẫy số

Khi không biết trước cấu trúc, có thể giải mã vào `map[string]any`. Nhưng hãy nhớ: **mọi số** sẽ thành `float64`!

```go
package main

import (
	"encoding/json"
	"fmt"
	"strings"
)

func main() {
	data := `{"id": 12345678901234567, "name": "An", "tags": ["a", "b"], "active": true}`

	var m map[string]any
	json.Unmarshal([]byte(data), &m)
	fmt.Printf("id: %v (%T)\n", m["id"], m["id"]) // ⚠️ float64 và đã MẤT chính xác!
	fmt.Printf("tags: %v (%T)\n", m["tags"], m["tags"])

	// Giải pháp: Decoder + UseNumber → số giữ nguyên dạng chuỗi json.Number
	dec := json.NewDecoder(strings.NewReader(data))
	dec.UseNumber()
	var m2 map[string]any
	dec.Decode(&m2)
	num := m2["id"].(json.Number)
	id, _ := num.Int64()
	fmt.Println("id chính xác:", id)
}

// Output:
// id: 1.2345678901234568e+16 (float64)
// tags: [a b] ([]interface {})
// id chính xác: 12345678901234567
```

> 💡 **Lời khuyên**: Luôn ưu tiên **struct** thay vì `map[string]any`. Struct cho bạn kiểu dữ liệu rõ ràng, compiler kiểm tra lỗi chính tả, và code dễ đọc hơn nhiều.

### 5.4. Tự viết `MarshalJSON` / `UnmarshalJSON`

Đôi khi định dạng mặc định không như ý. Ví dụ `time.Duration` mặc định ra JSON là **số nano giây** (`5000000000`) - chẳng ai đọc nổi. Ta muốn file config ghi `"5s"`, `"1m30s"`.

Go cho phép kiểu của bạn implement hai interface:

```go
type Marshaler interface   { MarshalJSON() ([]byte, error) }
type Unmarshaler interface { UnmarshalJSON([]byte) error }
```

`encoding/json` sẽ **tự gọi** các method này khi gặp kiểu của bạn.

```go
package main

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// Duration bọc time.Duration để đọc/ghi JSON dạng "5s", "1m30s"
type Duration struct {
	time.Duration // Embedding: Duration có luôn mọi method của time.Duration
}

func (d Duration) MarshalJSON() ([]byte, error) {
	return json.Marshal(d.String()) // time.Duration.String() → "1m30s"
}

func (d *Duration) UnmarshalJSON(b []byte) error { // Pointer receiver: cần SỬA d
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return fmt.Errorf("duration phải là chuỗi như \"5s\": %w", err)
	}
	v, err := time.ParseDuration(s)
	if err != nil {
		return err
	}
	d.Duration = v
	return nil
}

// Level: enum dạng số trong Go, nhưng là chữ trong JSON
// Implement TextMarshaler thay vì JSONMarshaler → dùng được cả làm KEY của map
type Level int

const (
	Debug Level = iota
	Info
	Warn
	Error
)

var levelNames = []string{"debug", "info", "warn", "error"}

func (l Level) MarshalText() ([]byte, error) {
	if l < 0 || int(l) >= len(levelNames) {
		return nil, fmt.Errorf("level không hợp lệ: %d", l)
	}
	return []byte(levelNames[l]), nil
}

func (l *Level) UnmarshalText(b []byte) error {
	s := strings.ToLower(string(b))
	for i, name := range levelNames {
		if name == s {
			*l = Level(i)
			return nil
		}
	}
	return fmt.Errorf("level %q không hợp lệ (chọn: %s)", s, strings.Join(levelNames, ", "))
}

type Config struct {
	Timeout  Duration `json:"timeout"`
	Interval Duration `json:"interval"`
	LogLevel Level    `json:"log_level"`
}

func main() {
	input := `{"timeout": "1m30s", "interval": "250ms", "log_level": "WARN"}`
	var cfg Config
	if err := json.Unmarshal([]byte(input), &cfg); err != nil {
		fmt.Println("Lỗi:", err)
		return
	}
	fmt.Println("Timeout (giây):", cfg.Timeout.Seconds()) // Gọi được method của time.Duration
	fmt.Println("Interval:", cfg.Interval, "- Level:", cfg.LogLevel)

	out, _ := json.Marshal(cfg)
	fmt.Println(string(out))

	// Dữ liệu sai → thông báo lỗi rõ ràng
	err := json.Unmarshal([]byte(`{"log_level": "verbose"}`), &cfg)
	fmt.Println("Lỗi:", err)
}

// Output:
// Timeout (giây): 90
// Interval: 250ms - Level: 2
// {"timeout":"1m30s","interval":"250ms","log_level":"warn"}
// Lỗi: level "verbose" không hợp lệ (chọn: debug, info, warn, error)
```

> 💡 `Level` in ra `2` vì ta chưa viết `String()`. Hãy thử thêm method `String()` (xem [Bài 6](./06-structs-methods-interfaces.md)) - rất đáng làm cho mọi kiểu enum.

### Cái bẫy đệ quy vô hạn và "mẹo alias"

Muốn **thêm** một field tính toán vào JSON nhưng vẫn giữ các field khác như mặc định? Nếu gọi `json.Marshal(o)` bên trong `MarshalJSON` của chính `o` → Go lại gọi `MarshalJSON` → gọi lại... **vô hạn** → stack overflow. Mẹo: tạo **kiểu alias** (không có method):

```go
package main

import (
	"encoding/json"
	"fmt"
)

type Order struct {
	ID       int   `json:"id"`
	Quantity int   `json:"quantity"`
	Price    int64 `json:"price"`
}

func (o Order) MarshalJSON() ([]byte, error) {
	type alias Order // alias có cùng field nhưng KHÔNG có method MarshalJSON → hết đệ quy
	return json.Marshal(struct {
		alias
		Total int64 `json:"total"` // Field tính toán thêm vào
	}{
		alias: alias(o),
		Total: int64(o.Quantity) * o.Price,
	})
}

func main() {
	b, _ := json.Marshal(Order{ID: 1, Quantity: 3, Price: 50_000})
	fmt.Println(string(b))
}

// Output:
// {"id":1,"quantity":3,"price":50000,"total":150000}
```

### 5.5. Streaming với `json.Decoder` - JSON lớn không tốn RAM

`json.Unmarshal` cần **toàn bộ** dữ liệu trong RAM. Với file JSON 2GB chứa một mảng triệu phần tử, hãy dùng `json.Decoder` để đọc **từng phần tử**:

```go
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"strings"
)

type Tx struct {
	ID     int    `json:"id"`
	Amount int64  `json:"amount"`
	Status string `json:"status"`
}

func main() {
	// Giả sử đây là một file JSON khổng lồ - dạng mảng
	bigArray := `[
		{"id": 1, "amount": 500000, "status": "ok"},
		{"id": 2, "amount": 120000, "status": "failed"},
		{"id": 3, "amount": 990000, "status": "ok"}
	]`

	dec := json.NewDecoder(strings.NewReader(bigArray))

	// Đọc token mở mảng '['
	if _, err := dec.Token(); err != nil {
		log.Fatal(err)
	}
	var sum int64
	for dec.More() { // Còn phần tử tiếp theo trong mảng?
		var tx Tx
		if err := dec.Decode(&tx); err != nil { // Chỉ giải mã MỘT phần tử
			log.Fatal(err)
		}
		if tx.Status == "ok" {
			sum += tx.Amount
		}
	}
	dec.Token() // Đọc token đóng mảng ']'
	fmt.Println("Tổng giao dịch thành công:", sum)

	// NDJSON (JSON Lines): mỗi dòng một object - định dạng log rất phổ biến
	ndjson := `{"id": 10, "amount": 1000, "status": "ok"}
{"id": 11, "amount": 2000, "status": "ok"}
{"id": 12, "amount": 3000, "status": "failed"}
`
	dec = json.NewDecoder(strings.NewReader(ndjson))
	count := 0
	for {
		var tx Tx
		err := dec.Decode(&tx)
		if err == io.EOF { // Hết dữ liệu - thoát vòng lặp bình thường
			break
		}
		if err != nil {
			log.Fatal(err)
		}
		count++
	}
	fmt.Println("Số dòng NDJSON:", count)
}

// Output:
// Tổng giao dịch thành công: 1490000
// Số dòng NDJSON: 3
```

Chiều ngược lại, `json.NewEncoder(w)` ghi JSON **thẳng** vào một `io.Writer` (file, `os.Stdout`, HTTP response) mà không cần tạo `[]byte` trung gian:

```go
package main

import (
	"encoding/json"
	"os"
)

func main() {
	enc := json.NewEncoder(os.Stdout)
	enc.SetEscapeHTML(false) // Mặc định &, <, > bị đổi thành \u0026... - tắt đi cho dễ đọc
	enc.Encode(map[string]string{"q": "a&b <tag>"})

	enc.SetIndent("", "  ")
	enc.Encode([]int{1, 2}) // Encode tự thêm \n ở cuối mỗi lần gọi → rất hợp với NDJSON
}

// Output:
// {"q":"a&b <tag>"}
// [
//   1,
//   2
// ]
```

### 5.6. `json.RawMessage` - Hoãn giải mã

Tình huống: bạn nhận các **sự kiện** (event) có nhiều loại, mỗi loại có phần `data` khác nhau:

```json
{"type": "order_created", "data": {"order_id": 1, "total": 500000}}
{"type": "user_signup",   "data": {"email": "an@mail.com"}}
```

Làm sao biết giải mã `data` vào struct nào khi chưa đọc `type`? Dùng `json.RawMessage` - giữ nguyên `data` dạng byte thô, đọc `type` trước rồi mới quyết định:

> 💡 **Ví von**: Giống nhân viên bưu điện: đọc **nhãn ngoài phong bì** (`type`) trước để biết chuyển cho phòng nào, **chưa bóc** thư bên trong (`RawMessage`). Phòng nhận thư mới bóc và đọc nội dung.

```go
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"strings"
)

type Envelope struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"` // Chưa giải mã - chỉ giữ []byte thô
}

type OrderCreated struct {
	OrderID int   `json:"order_id"`
	Total   int64 `json:"total"`
}

type UserSignup struct {
	Email string `json:"email"`
}

func handle(env Envelope) error {
	switch env.Type {
	case "order_created":
		var e OrderCreated
		if err := json.Unmarshal(env.Data, &e); err != nil {
			return err
		}
		fmt.Printf("🛒 Đơn #%d, tổng %d đ\n", e.OrderID, e.Total)
	case "user_signup":
		var e UserSignup
		if err := json.Unmarshal(env.Data, &e); err != nil {
			return err
		}
		fmt.Printf("👤 User mới: %s\n", e.Email)
	default:
		fmt.Printf("❓ Bỏ qua sự kiện lạ %q (data = %s)\n", env.Type, env.Data)
	}
	return nil
}

func main() {
	stream := `{"type": "order_created", "data": {"order_id": 1, "total": 500000}}
{"type": "user_signup", "data": {"email": "an@mail.com"}}
{"type": "ping", "data": {"ts": 1}}`

	dec := json.NewDecoder(strings.NewReader(stream))
	for {
		var env Envelope
		if err := dec.Decode(&env); err == io.EOF {
			break
		} else if err != nil {
			log.Fatal(err)
		}
		if err := handle(env); err != nil {
			log.Fatal(err)
		}
	}
}

// Output:
// 🛒 Đơn #1, tổng 500000 đ
// 👤 User mới: an@mail.com
// ❓ Bỏ qua sự kiện lạ "ping" (data = {"ts": 1})
```

### 5.7. Bắt lỗi chính tả trong config: `DisallowUnknownFields`

Mặc định `encoding/json` **lặng lẽ bỏ qua** field lạ. Người dùng gõ nhầm `"timout"` thay vì `"timeout"` → config không có tác dụng mà không ai hay biết. Với file config, hãy bật chế độ nghiêm ngặt:

```go
package main

import (
	"encoding/json"
	"fmt"
	"strings"
)

type ServerConfig struct {
	Port    int `json:"port"`
	Timeout int `json:"timeout"`
}

func main() {
	input := `{"port": 8080, "timout": 30}` // Gõ nhầm!

	var c1 ServerConfig
	err := json.Unmarshal([]byte(input), &c1)
	fmt.Printf("Unmarshal: %+v, lỗi: %v\n", c1, err) // Timeout = 0 mà không ai hay!

	var c2 ServerConfig
	dec := json.NewDecoder(strings.NewReader(input))
	dec.DisallowUnknownFields()
	err = dec.Decode(&c2)
	fmt.Println("Decoder nghiêm ngặt:", err)
}

// Output:
// Unmarshal: {Port:8080 Timeout:0}, lỗi: <nil>
// Decoder nghiêm ngặt: json: unknown field "timout"
```

## 📖 6. File CSV với `encoding/csv`

**CSV** (Comma-Separated Values) là định dạng "quốc dân" để trao đổi dữ liệu bảng: xuất từ Excel, Google Sheets, hệ thống kế toán... Nhìn đơn giản nhưng **đừng bao giờ tự tách bằng `strings.Split(line, ",")`**, vì giá trị có thể chứa dấu phẩy, dấu ngoặc kép hoặc xuống dòng:

```text
sku,name,price
A01,"Bàn phím, loại cơ",1250000
A02,"Màn hình 27"" 4K",8990000
```

Package `encoding/csv` xử lý hết các trường hợp này theo chuẩn RFC 4180.

### Đọc CSV

```go
package main

import (
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"log"
	"strconv"
	"strings"
)

func main() {
	// "\ufeff" là BOM - Excel hay chèn vào đầu file CSV UTF-8
	data := "\ufeffsku,name,price,qty\n" +
		"A01,\"Bàn phím, loại cơ\",1250000,2\n" +
		"A02,\"Màn hình 27\"\" 4K\",8990000,1\n" +
		"A03,Chuột,abc,5\n" +
		"A04,Tai nghe,450000\n"

	r := csv.NewReader(strings.NewReader(data))
	r.FieldsPerRecord = -1 // Cho phép số cột khác nhau - ta tự kiểm tra để báo lỗi dễ hiểu hơn
	// r.Comma = ';'       // File CSV từ Excel ở máy cài tiếng Việt/châu Âu hay dùng dấu ;

	header, err := r.Read()
	if err != nil {
		log.Fatal(err)
	}
	header[0] = strings.TrimPrefix(header[0], "\ufeff") // Bỏ BOM, nếu không "sku" sẽ thành "\ufeffsku"
	fmt.Println("Header:", header)

	var total int64
	for {
		rec, err := r.Read() // Đọc TỪNG dòng → file lớn cỡ nào cũng được
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			log.Fatal(err)
		}
		line, _ := r.FieldPos(0) // Số dòng trong file của bản ghi này - để báo lỗi
		if len(rec) != len(header) {
			fmt.Printf("⚠️  dòng %d: cần %d cột, có %d\n", line, len(header), len(rec))
			continue
		}
		price, err1 := strconv.ParseInt(rec[2], 10, 64)
		qty, err2 := strconv.Atoi(rec[3])
		if err := errors.Join(err1, err2); err != nil {
			fmt.Printf("⚠️  dòng %d: %v\n", line, err)
			continue
		}
		fmt.Printf("✅ %s | %-20s | %d x %d\n", rec[0], rec[1], price, qty)
		total += price * int64(qty)
	}
	fmt.Println("Tổng tiền:", total)
}

// Output:
// Header: [sku name price qty]
// ✅ A01 | Bàn phím, loại cơ    | 1250000 x 2
// ✅ A02 | Màn hình 27" 4K      | 8990000 x 1
// ⚠️  dòng 4: strconv.ParseInt: parsing "abc": invalid syntax
// ⚠️  dòng 5: cần 4 cột, có 3
// Tổng tiền: 11490000
```

> 💡 `%-20s` căn lề trái trong 20 **ký tự**... thực ra là 20 **rune**, nên chữ tiếng Việt có dấu dựng sẵn vẫn thẳng hàng. Nếu file dùng dấu tổ hợp (combining), cột có thể lệch - chuyện thường gặp khi in bảng tiếng Việt ra terminal.

### Ghi CSV

```go
package main

import (
	"encoding/csv"
	"log"
	"os"
)

func main() {
	w := csv.NewWriter(os.Stdout) // Có thể thay bằng một *os.File
	rows := [][]string{
		{"name", "note"},
		{"An", "thích Go, Rust"},   // Có dấu phẩy → tự thêm ngoặc kép
		{"Bình", `nói "xin chào"`}, // Có ngoặc kép → tự nhân đôi thành ""
		{"Chi", "dòng 1\ndòng 2"},  // Có xuống dòng → tự bọc ngoặc kép
	}
	for _, row := range rows {
		if err := w.Write(row); err != nil {
			log.Fatal(err)
		}
	}
	w.Flush() // csv.Writer cũng có bộ đệm → PHẢI Flush
	if err := w.Error(); err != nil {
		log.Fatal(err)
	}
}

// Output:
// name,note
// An,"thích Go, Rust"
// Bình,"nói ""xin chào"""
// Chi,"dòng 1
// dòng 2"
```

> 💡 Muốn Excel mở file CSV tiếng Việt không bị lỗi font? Ghi **BOM** `"\ufeff"` ở đầu file trước khi ghi header: `f.WriteString("\ufeff")`.

## 📖 7. Viết công cụ dòng lệnh (CLI) ⭐

### 7.1. `os.Args` - Tham số dòng lệnh thô

```go
package main

import (
	"fmt"
	"os"
)

func main() {
	fmt.Println("Tên chương trình:", os.Args[0])
	fmt.Println("Số tham số:", len(os.Args)-1)
	for i, a := range os.Args[1:] {
		fmt.Printf("  [%d] %q\n", i+1, a)
	}
}
```

```bash
go build -o greet . && ./greet xin "chào bạn" --verbose
```

```text
Tên chương trình: ./greet
Số tham số: 3
  [1] "xin"
  [2] "chào bạn"
  [3] "--verbose"
```

- `os.Args[0]` là **tên chương trình** (với `go run` sẽ là một đường dẫn tạm dài ngoằng)
- Shell tách tham số theo khoảng trắng; dấu ngoặc kép giữ `"chào bạn"` thành **một** tham số
- Tự xử lý `os.Args` chỉ hợp với công cụ **rất đơn giản**. Có cờ (`--verbose`, `-n 10`) → dùng package `flag`

### 7.2. Package `flag` - Xử lý cờ (option)

```go
package main

import (
	"flag"
	"fmt"
	"os"
	"strings"
	"time"
)

func main() {
	// Mỗi hàm trả về một CON TRỎ tới giá trị (giá trị chỉ có sau khi Parse)
	name := flag.String("name", "bạn", "tên người cần chào")
	times := flag.Int("n", 1, "số lần chào")
	upper := flag.Bool("upper", false, "in hoa toàn bộ")
	delay := flag.Duration("delay", 0, "nghỉ giữa các lần chào (vd: 500ms, 1s)")

	// Hoặc gắn thẳng vào biến có sẵn với ...Var
	var lang string
	flag.StringVar(&lang, "lang", "vi", "ngôn ngữ: vi hoặc en")

	// Tùy biến thông báo hướng dẫn (hiện khi gõ -h hoặc cờ sai)
	flag.Usage = func() {
		fmt.Fprintf(flag.CommandLine.Output(), "Cách dùng: greet [tùy chọn] [lời nhắn...]\n\nTùy chọn:\n")
		flag.PrintDefaults()
	}

	flag.Parse() // ❗ Phải gọi trước khi đọc giá trị

	greeting := "Xin chào"
	if lang == "en" {
		greeting = "Hello"
	}
	msg := fmt.Sprintf("%s, %s!", greeting, *name)
	if flag.NArg() > 0 { // flag.Args(): các tham số còn lại KHÔNG phải cờ
		msg += " " + strings.Join(flag.Args(), " ")
	}
	if *upper {
		msg = strings.ToUpper(msg)
	}
	for i := range *times {
		if i > 0 {
			time.Sleep(*delay)
		}
		fmt.Println(msg)
	}
	os.Exit(0)
}
```

```bash
$ go run . -name An -n 2 hẹn gặp lại
Xin chào, An! hẹn gặp lại
Xin chào, An! hẹn gặp lại

$ go run . --name=Bình -upper -lang en
HELLO, BÌNH!

$ go run . -n abc
invalid value "abc" for flag -n: parse error
Cách dùng: greet [tùy chọn] [lời nhắn...]
...
exit status 2

$ go run . -h
Cách dùng: greet [tùy chọn] [lời nhắn...]

Tùy chọn:
  -delay duration
    	nghỉ giữa các lần chào (vd: 500ms, 1s)
  -lang string
    	ngôn ngữ: vi hoặc en (default "vi")
  -n int
    	số lần chào (default 1)
  -name string
    	tên người cần chào (default "bạn")
  -upper
    	in hoa toàn bộ
```

**Quy tắc cú pháp của `flag`** (khác một chút với các CLI kiểu GNU):

- `-name An`, `-name=An`, `--name An`, `--name=An` đều **giống nhau** (một hay hai gạch đều được)
- Cờ bool: `-upper` là `true`; muốn tắt phải viết `-upper=false` (**không** được viết `-upper false`)
- ⚠️ `flag` **dừng phân tích** ở tham số đầu tiên không phải cờ: `greet An -n 2` → `-n 2` bị coi là tham số thường! Luôn đặt cờ **trước**
- `-h` / `-help` được xử lý tự động, cờ sai → in hướng dẫn và thoát với **exit code 2**

### 7.3. Cờ lặp lại: `flag.Func` và `flag.Value`

Muốn cho phép `-tag go -tag cli -tag json`? Dùng `flag.Func` (Go 1.16+) - hàm được gọi **mỗi lần** cờ xuất hiện:

```go
package main

import (
	"flag"
	"fmt"
	"strings"
)

func main() {
	var tags []string
	flag.Func("tag", "thêm nhãn (lặp lại được)", func(s string) error {
		s = strings.TrimSpace(s)
		if s == "" {
			return fmt.Errorf("nhãn không được rỗng")
		}
		tags = append(tags, s)
		return nil
	})

	// Giả lập dòng lệnh: prog -tag go -tag cli -tag json
	flag.CommandLine.Parse([]string{"-tag", "go", "-tag", "cli", "-tag", "json"})
	fmt.Println("Nhãn:", tags)
}

// Output:
// Nhãn: [go cli json]
```

> 💡 `flag.CommandLine.Parse([]string{...})` cho phép "giả lập" dòng lệnh - rất tiện để **viết test** cho CLI. Còn `flag.Parse()` chính là `flag.CommandLine.Parse(os.Args[1:])`.

### 7.4. Subcommand - Kiểu `git commit`, `docker run`

Các CLI lớn có nhiều **lệnh con** (subcommand), mỗi lệnh có bộ cờ riêng: `git commit -m "..."`, `git log --oneline`. Dùng `flag.NewFlagSet` cho mỗi lệnh con:

```go
package main

import (
	"flag"
	"fmt"
	"io"
	"os"
)

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr))
}

// run chứa toàn bộ logic, nhận args + nơi ghi output → dễ test, không đụng os.Exit
func run(args []string, stdout, stderr io.Writer) int {
	if len(args) < 1 {
		fmt.Fprintln(stderr, "cách dùng: todo <add|list> [tùy chọn]")
		return 2 // 2 = dùng sai cú pháp
	}

	switch args[0] {
	case "add":
		fs := flag.NewFlagSet("add", flag.ContinueOnError) // ContinueOnError: trả lỗi thay vì tự thoát
		fs.SetOutput(stderr)
		priority := fs.String("p", "medium", "độ ưu tiên: low|medium|high")
		if err := fs.Parse(args[1:]); err != nil {
			return 2
		}
		if fs.NArg() == 0 {
			fmt.Fprintln(stderr, "add: thiếu nội dung công việc")
			return 2
		}
		fmt.Fprintf(stdout, "Đã thêm [%s] %s\n", *priority, fs.Arg(0))
	case "list":
		fs := flag.NewFlagSet("list", flag.ContinueOnError)
		fs.SetOutput(stderr)
		all := fs.Bool("all", false, "hiện cả việc đã xong")
		if err := fs.Parse(args[1:]); err != nil {
			return 2
		}
		fmt.Fprintf(stdout, "Danh sách công việc (all=%v)\n", *all)
	default:
		fmt.Fprintf(stderr, "lệnh không hợp lệ: %q\n", args[0])
		return 2
	}
	return 0
}
```

```bash
$ go run . add -p high "Mua sữa"
Đã thêm [high] Mua sữa

$ go run . list -all
Danh sách công việc (all=true)

$ go run . remove; echo "exit code: $?"
lệnh không hợp lệ: "remove"
exit status 2
exit code: 1
```

> 💡 `go run` in `exit status 2` và **bản thân `go run`** thoát với code 1. Muốn thấy đúng exit code của chương trình, hãy `go build` rồi chạy file binary: `./todo remove; echo $?` → `2`.

> 💡 Khi CLI lớn dần (hàng chục lệnh con, tự sinh tài liệu, auto-complete), cộng đồng Go hay dùng thư viện **`github.com/spf13/cobra`** (kubectl, gh, hugo dùng nó). Nhưng hãy thành thạo `flag` trước - nó đủ cho 90% công cụ nội bộ.

### 7.5. Exit code - "Mã kết thúc"

Mỗi chương trình khi kết thúc trả về một số cho hệ điều hành. Script shell, CI/CD (GitHub Actions, Jenkins), cron... dựa vào số này để biết chương trình **thành công hay thất bại**.

| Exit code | Quy ước |
|-----------|---------|
| `0` | Thành công |
| `1` | Lỗi chung |
| `2` | Dùng sai cú pháp (cờ sai, thiếu tham số) - `flag` dùng mã này |
| `130` | Bị ngắt bằng Ctrl+C |

```bash
./mytool && echo "OK" || echo "Thất bại"   # Shell dùng exit code để rẽ nhánh
```

⚠️ **Cái bẫy của `os.Exit`**: nó kết thúc chương trình **ngay lập tức**, các lệnh `defer` **không được chạy** (file không được đóng, buffer không được flush!). `log.Fatal` cũng gọi `os.Exit(1)` bên trong.

```go
func main() {
	f, _ := os.Create("out.txt")
	defer f.Close()          // ❌ KHÔNG chạy nếu os.Exit bên dưới được gọi
	w := bufio.NewWriter(f)
	defer w.Flush()          // ❌ Dữ liệu trong buffer bị mất
	fmt.Fprintln(w, "data")
	os.Exit(1)
}
```

✅ **Mẫu chuẩn**: đặt toàn bộ logic vào `run()` trả về `error` (hoặc exit code), `main()` chỉ gọi `os.Exit` **một lần ở cuối** - lúc đó mọi `defer` trong `run()` đã chạy xong:

```go
func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "lỗi:", err)
		os.Exit(1)
	}
}
```

### 7.6. stdin, stdout, stderr và pipe

Mỗi chương trình có sẵn 3 "ống":

| Ống | Biến Go | Dùng cho |
|-----|---------|----------|
| **stdin** (vào) | `os.Stdin` | Dữ liệu đầu vào (bàn phím hoặc pipe) |
| **stdout** (ra) | `os.Stdout` | **Kết quả** của chương trình |
| **stderr** (lỗi) | `os.Stderr` | Thông báo lỗi, log, tiến trình |

**Vì sao phải tách stdout và stderr?** Để người dùng có thể nối (pipe) kết quả sang chương trình khác mà log/lỗi **không lẫn vào** dữ liệu: `mytool < in.txt > out.txt` - lỗi vẫn hiện trên màn hình, còn `out.txt` chỉ chứa kết quả sạch.

> 💡 **Triết lý Unix**: Mỗi chương trình làm **một việc** thật tốt, đọc từ stdin, ghi ra stdout, để người dùng tự "lắp ghép" bằng pipe `|`. Ví dụ: `cat access.log | grep 500 | wc -l`.

```go
package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

// Công cụ "upper": đọc từng dòng từ stdin, in hoa, ghi ra stdout
func main() {
	// Nếu stdin là bàn phím (không có pipe) → nhắc người dùng
	if info, _ := os.Stdin.Stat(); info.Mode()&os.ModeCharDevice != 0 {
		fmt.Fprintln(os.Stderr, "Gõ nội dung rồi nhấn Ctrl+D (Windows: Ctrl+Z, Enter) để kết thúc:")
	}

	sc := bufio.NewScanner(os.Stdin)
	out := bufio.NewWriter(os.Stdout)

	n := 0
	for sc.Scan() {
		fmt.Fprintln(out, strings.ToUpper(sc.Text()))
		n++
	}
	out.Flush() // Đẩy hết kết quả ra stdout trước khi in thống kê
	if err := sc.Err(); err != nil {
		fmt.Fprintln(os.Stderr, "lỗi đọc stdin:", err)
		os.Exit(1)
	}
	fmt.Fprintf(os.Stderr, "(đã xử lý %d dòng)\n", n) // Thông tin phụ → stderr
}
```

```bash
$ printf "xin chào\ngo rất vui\n" | go run .
XIN CHÀO
GO RẤT VUI
(đã xử lý 2 dòng)

$ printf "a\nb\n" | go run . > out.txt   # Chỉ kết quả vào file, dòng "(đã xử lý...)" vẫn hiện
(đã xử lý 2 dòng)
```

### 7.7. Biến môi trường (Environment variables)

Biến môi trường là cách phổ biến nhất để **cấu hình** ứng dụng khi chạy trong Docker, Kubernetes, CI... (nguyên tắc *12-Factor App*). Đặc biệt với **bí mật** (mật khẩu DB, API key): **không bao giờ** viết cứng trong code - đọc từ biến môi trường.

```go
package main

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port    int
	DBURL   string
	Debug   bool
	Timeout time.Duration
}

// getenv trả về giá trị biến môi trường hoặc giá trị mặc định
func getenv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok { // ok = false nếu biến CHƯA ĐƯỢC ĐẶT (khác với đặt = "")
		return v
	}
	return fallback
}

func loadConfig() (Config, error) {
	var c Config
	var err error

	if c.Port, err = strconv.Atoi(getenv("APP_PORT", "8080")); err != nil {
		return c, fmt.Errorf("APP_PORT không hợp lệ: %w", err)
	}
	if c.Debug, err = strconv.ParseBool(getenv("APP_DEBUG", "false")); err != nil {
		return c, fmt.Errorf("APP_DEBUG không hợp lệ: %w", err)
	}
	if c.Timeout, err = time.ParseDuration(getenv("APP_TIMEOUT", "5s")); err != nil {
		return c, fmt.Errorf("APP_TIMEOUT không hợp lệ: %w", err)
	}
	c.DBURL = os.Getenv("DATABASE_URL") // Getenv trả "" nếu chưa đặt
	if c.DBURL == "" {
		return c, fmt.Errorf("thiếu biến bắt buộc DATABASE_URL")
	}
	return c, nil
}

func main() {
	// Giả lập môi trường (thực tế sẽ đặt từ shell: APP_PORT=3000 ./app)
	os.Setenv("APP_PORT", "3000")
	os.Setenv("APP_DEBUG", "true")

	_, err := loadConfig()
	fmt.Println("Lần 1:", err)

	os.Setenv("DATABASE_URL", "postgres://localhost/shop")
	cfg, err := loadConfig()
	fmt.Printf("Lần 2: %+v, lỗi: %v\n", cfg, err)

	os.Setenv("APP_TIMEOUT", "5") // Quên đơn vị - lỗi rất hay gặp!
	_, err = loadConfig()
	fmt.Println("Lần 3:", err)

	// ExpandEnv: thay $VAR / ${VAR} trong chuỗi
	fmt.Println(os.ExpandEnv("Kết nối tới ${DATABASE_URL} trên cổng $APP_PORT"))
}

// Output:
// Lần 1: thiếu biến bắt buộc DATABASE_URL
// Lần 2: {Port:3000 DBURL:postgres://localhost/shop Debug:true Timeout:5s}, lỗi: <nil>
// Lần 3: APP_TIMEOUT không hợp lệ: time: missing unit in duration "5"
// Kết nối tới postgres://localhost/shop trên cổng 3000
```

**Thứ tự ưu tiên cấu hình** mà hầu hết CLI chuyên nghiệp tuân theo (cao → thấp):

```text
Cờ dòng lệnh (-port 9000)  >  Biến môi trường (APP_PORT)  >  File config  >  Giá trị mặc định
```

Mẹo cài đặt đơn giản với `flag`: dùng giá trị từ biến môi trường làm **mặc định** cho cờ:

```go
port := flag.Int("port", envInt("APP_PORT", 8080), "cổng lắng nghe (env: APP_PORT)")
```

### 💡 Tips quan trọng

- ✅ Hàm xử lý dữ liệu nên nhận `io.Reader`/`io.Writer`, **không** nhận tên file → dễ test, dễ tái sử dụng
- ✅ Kết quả → **stdout**, log/lỗi → **stderr**
- ✅ Tách logic vào `run(args, stdout, stderr)`, `main()` chỉ gọi `os.Exit` một lần
- ✅ Luôn kiểm tra `sc.Err()` sau vòng lặp `Scan()`, `w.Flush()` + `w.Error()` với writer có buffer
- ✅ Ghi file quan trọng theo kiểu **atomic**: ghi ra file tạm rồi `os.Rename` (xem ví dụ quản lý config bên dưới)
- ⚠️ Không đặt bí mật vào **cờ** dòng lệnh - lệnh `ps` của hệ điều hành cho mọi người thấy tham số. Dùng biến môi trường hoặc file

## 🌍 Ứng dụng thực tế

### Ứng dụng 1: Công cụ phân tích log - Đếm lỗi theo giờ

**Bài toán**: Server ghi log dạng `2026-09-25T08:15:32Z ERROR payment: timeout` vào file vài GB mỗi ngày. Sếp hỏi: *"Hôm qua lỗi tập trung vào giờ nào? Thành phần (component) nào lỗi nhiều nhất?"*

**Thiết kế**:
- Đọc **từng dòng** với `bufio.Scanner` (buffer 1MB cho dòng dài) → file bao nhiêu GB cũng chạy
- Dòng sai định dạng không làm chương trình dừng - chỉ đếm và báo cáo
- Hàm `analyze` nhận `io.Reader` → dùng được cho file, stdin, hoặc chuỗi trong test
- Nếu không truyền `-file`, chương trình tự sinh file log mẫu để bạn chạy thử ngay

```go
package main

import (
	"bufio"
	"cmp"
	"errors"
	"flag"
	"fmt"
	"io"
	"maps"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"
)

// Stats là kết quả phân tích
type Stats struct {
	Lines       int
	Malformed   int
	ByLevel     map[string]int
	ErrorByHour map[int]int    // giờ (0-23) → số lỗi
	ErrorByComp map[string]int // component → số lỗi
}

// parseLine tách "2026-09-25T08:15:32Z ERROR payment: timeout ..."
func parseLine(line string) (t time.Time, level, comp string, err error) {
	parts := strings.SplitN(line, " ", 3)
	if len(parts) < 3 {
		return t, "", "", errors.New("thiếu trường")
	}
	t, err = time.Parse(time.RFC3339, parts[0])
	if err != nil {
		return t, "", "", err
	}
	comp, _, ok := strings.Cut(parts[2], ":")
	if !ok {
		return t, "", "", errors.New("thiếu component")
	}
	return t, parts[1], comp, nil
}

func analyze(r io.Reader) (*Stats, error) {
	s := &Stats{
		ByLevel:     map[string]int{},
		ErrorByHour: map[int]int{},
		ErrorByComp: map[string]int{},
	}
	sc := bufio.NewScanner(r)
	sc.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" {
			continue
		}
		s.Lines++
		t, level, comp, err := parseLine(line)
		if err != nil {
			s.Malformed++
			continue
		}
		s.ByLevel[level]++
		if level == "ERROR" {
			s.ErrorByHour[t.Hour()]++
			s.ErrorByComp[comp]++
		}
	}
	return s, sc.Err()
}

func printReport(w io.Writer, s *Stats) {
	fmt.Fprintf(w, "📄 Tổng %d dòng (%d dòng sai định dạng)\n", s.Lines, s.Malformed)
	for _, lv := range slices.Sorted(maps.Keys(s.ByLevel)) {
		fmt.Fprintf(w, "   %-5s %d\n", lv, s.ByLevel[lv])
	}

	fmt.Fprintln(w, "\n⏰ Lỗi theo giờ:")
	maxCount := 0
	for _, c := range s.ErrorByHour {
		maxCount = max(maxCount, c)
	}
	for _, h := range slices.Sorted(maps.Keys(s.ErrorByHour)) {
		c := s.ErrorByHour[h]
		bar := strings.Repeat("█", c*30/maxCount) // Thanh dài tối đa 30 ô
		fmt.Fprintf(w, "   %02dh %-30s %d\n", h, bar, c)
	}

	fmt.Fprintln(w, "\n🔥 Top component lỗi nhiều nhất:")
	comps := slices.Collect(maps.Keys(s.ErrorByComp))
	slices.SortFunc(comps, func(a, b string) int {
		// Sắp giảm dần theo số lỗi, bằng nhau thì theo tên
		return cmp.Or(cmp.Compare(s.ErrorByComp[b], s.ErrorByComp[a]), cmp.Compare(a, b))
	})
	for i, c := range comps[:min(3, len(comps))] {
		fmt.Fprintf(w, "   %d. %-10s %d lỗi\n", i+1, c, s.ErrorByComp[c])
	}
}

// generateSample tạo file log mẫu có quy luật (để kết quả luôn giống nhau)
func generateSample(path string) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	w := bufio.NewWriter(f)
	comps := []string{"auth", "payment", "order", "search"}
	start := time.Date(2026, 9, 25, 8, 0, 0, 0, time.UTC)
	for i := range 6000 {
		t := start.Add(time.Duration(i) * 3 * time.Second) // 6000 dòng x 3 giây = 5 tiếng
		level := "INFO"
		switch {
		case t.Hour() == 10 && i%4 == 0: // Giờ cao điểm 10h: rất nhiều lỗi
			level = "ERROR"
		case i%25 == 0:
			level = "ERROR"
		case i%10 == 0:
			level = "WARN"
		}
		comp := comps[i%len(comps)]
		if level == "ERROR" && t.Hour() == 10 {
			comp = "payment" // Lỗi giờ cao điểm tập trung ở payment
		}
		fmt.Fprintf(w, "%s %s %s: xử lý request #%d\n", t.Format(time.RFC3339), level, comp, i)
		if i%1000 == 999 {
			fmt.Fprintln(w, "dòng rác không đúng định dạng")
		}
	}
	return w.Flush()
}

func main() {
	file := flag.String("file", "", "đường dẫn file log (để trống = tự sinh dữ liệu mẫu)")
	flag.Parse()

	if *file == "" {
		dir, err := os.MkdirTemp("", "logstat-*")
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		defer os.RemoveAll(dir)
		*file = filepath.Join(dir, "app.log")
		if err := generateSample(*file); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
	}

	if err := run(*file, os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, "lỗi:", err)
		os.Exit(1)
	}
}

func run(path string, w io.Writer) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	s, err := analyze(f)
	if err != nil {
		return fmt.Errorf("đọc %s: %w", path, err)
	}
	printReport(w, s)
	return nil
}

// Output:
// 📄 Tổng 6006 dòng (6 dòng sai định dạng)
//    ERROR 528
//    INFO  5040
//    WARN  432
//
// ⏰ Lỗi theo giờ:
//    08h ████                           48
//    09h ████                           48
//    10h ██████████████████████████████ 336
//    11h ████                           48
//    12h ████                           48
//
// 🔥 Top component lỗi nhiều nhất:
//    1. payment    384 lỗi
//    2. auth       48 lỗi
//    3. order      48 lỗi
```

> 💡 Nhìn báo cáo là thấy ngay: **10h** lỗi tăng vọt và tập trung ở **payment** → khả năng cao do cổng thanh toán quá tải giờ cao điểm. Đây chính là giá trị của một công cụ phân tích log 150 dòng code!

Dùng với file thật:

```bash
go build -o logstat .
./logstat -file /var/log/myapp/app.log
```

### Ứng dụng 2: Chuyển đổi CSV → JSON

**Bài toán**: Phòng kinh doanh gửi file sản phẩm dạng CSV (xuất từ Excel). Hệ thống web cần dữ liệu JSON có **kiểu dữ liệu đúng** (giá là số, nhãn là mảng). Dòng lỗi phải được báo rõ **dòng số mấy, lỗi gì**, nhưng không làm hỏng cả file.

**Thiết kế**:
- Map cột theo **tên header** chứ không theo vị trí → người dùng đổi thứ tự cột vẫn chạy
- Hỗ trợ đọc từ file, hoặc từ stdin với `-in -` (để dùng được với pipe)
- Hai định dạng ra: mảng JSON (mặc định) hoặc NDJSON (`-ndjson`, hợp với dữ liệu lớn)
- Lỗi từng dòng → stderr; kết quả → stdout

```go
package main

import (
	"encoding/csv"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"
)

type Product struct {
	SKU   string   `json:"sku"`
	Name  string   `json:"name"`
	Price int64    `json:"price"`
	Qty   int      `json:"qty"`
	Tags  []string `json:"tags,omitempty"`
}

const sampleCSV = "\ufeffname,sku,price,qty,tags\n" +
	"\"Bàn phím cơ, switch đỏ\",KB01,1250000,10,hot|gaming\n" +
	"Chuột không dây,MS02,350000,25,\n" +
	"Tai nghe,HP03,giá sốc,5,sale\n" +
	"Màn hình 27\",MN04,6990000,-1,\n" +
	"Lót chuột,PD05,90000,100,phụ kiện\n"

var requiredCols = []string{"sku", "name", "price", "qty"}

// convert đọc CSV từ r, gọi emit cho mỗi sản phẩm hợp lệ, trả về danh sách lỗi theo dòng
func convert(r io.Reader, emit func(Product) error) (ok int, rowErrs []error, err error) {
	cr := csv.NewReader(r)
	cr.FieldsPerRecord = -1
	cr.TrimLeadingSpace = true
	cr.LazyQuotes = true // Chấp nhận dấu " lẻ trong trường không bọc ngoặc - CSV "bẩn" rất hay gặp

	header, err := cr.Read()
	if err != nil {
		return 0, nil, fmt.Errorf("đọc header: %w", err)
	}
	col := map[string]int{} // tên cột → vị trí
	for i, h := range header {
		h = strings.ToLower(strings.TrimSpace(strings.TrimPrefix(h, "\ufeff")))
		col[h] = i
	}
	for _, c := range requiredCols {
		if _, found := col[c]; !found {
			return 0, nil, fmt.Errorf("thiếu cột bắt buộc %q", c)
		}
	}

	get := func(rec []string, name string) string {
		if i, found := col[name]; found && i < len(rec) {
			return strings.TrimSpace(rec[i])
		}
		return ""
	}

	for {
		rec, err := cr.Read()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return ok, rowErrs, err // Lỗi cú pháp CSV nghiêm trọng → dừng
		}
		line, _ := cr.FieldPos(0)

		p := Product{SKU: get(rec, "sku"), Name: get(rec, "name")}
		var errs []error
		if p.SKU == "" {
			errs = append(errs, errors.New("sku rỗng"))
		}
		if p.Price, err = strconv.ParseInt(get(rec, "price"), 10, 64); err != nil {
			errs = append(errs, fmt.Errorf("price %q không phải số", get(rec, "price")))
		}
		if p.Qty, err = strconv.Atoi(get(rec, "qty")); err != nil || p.Qty < 0 {
			errs = append(errs, fmt.Errorf("qty %q phải là số nguyên ≥ 0", get(rec, "qty")))
		}
		if t := get(rec, "tags"); t != "" {
			p.Tags = strings.Split(t, "|")
		}
		if len(errs) > 0 {
			rowErrs = append(rowErrs, fmt.Errorf("dòng %d: %w", line, errors.Join(errs...)))
			continue
		}
		if err := emit(p); err != nil {
			return ok, rowErrs, err
		}
		ok++
	}
	return ok, rowErrs, nil
}

func run(args []string, stdin io.Reader, stdout, stderr io.Writer) int {
	fs := flag.NewFlagSet("csv2json", flag.ContinueOnError)
	fs.SetOutput(stderr)
	in := fs.String("in", "", "file CSV đầu vào, \"-\" = stdin, để trống = dữ liệu mẫu")
	ndjson := fs.Bool("ndjson", false, "xuất NDJSON (mỗi dòng một object)")
	if err := fs.Parse(args); err != nil {
		return 2
	}

	var src io.Reader
	switch *in {
	case "":
		src = strings.NewReader(sampleCSV)
	case "-":
		src = stdin
	default:
		f, err := os.Open(*in)
		if err != nil {
			fmt.Fprintln(stderr, "lỗi:", err)
			return 1
		}
		defer f.Close()
		src = f
	}

	enc := json.NewEncoder(stdout)
	enc.SetEscapeHTML(false)
	var all []Product
	emit := func(p Product) error {
		if *ndjson {
			return enc.Encode(p) // Ghi ngay, không giữ trong RAM
		}
		all = append(all, p)
		return nil
	}

	ok, rowErrs, err := convert(src, emit)
	if err != nil {
		fmt.Fprintln(stderr, "lỗi:", err)
		return 1
	}
	if !*ndjson {
		enc.SetIndent("", "  ")
		if all == nil {
			all = []Product{} // Xuất [] thay vì null
		}
		if err := enc.Encode(all); err != nil {
			fmt.Fprintln(stderr, "lỗi:", err)
			return 1
		}
	}
	for _, e := range rowErrs {
		fmt.Fprintln(stderr, "⚠️ ", e)
	}
	fmt.Fprintf(stderr, "✅ %d dòng hợp lệ, ⚠️  %d dòng lỗi\n", ok, len(rowErrs))
	if len(rowErrs) > 0 {
		return 1 // Báo cho script biết có vấn đề, dù vẫn xuất phần hợp lệ
	}
	return 0
}

func main() {
	os.Exit(run(os.Args[1:], os.Stdin, os.Stdout, os.Stderr))
}
```

Chạy với dữ liệu mẫu và chế độ NDJSON:

```bash
$ go run . -ndjson
{"sku":"KB01","name":"Bàn phím cơ, switch đỏ","price":1250000,"qty":10,"tags":["hot","gaming"]}
{"sku":"MS02","name":"Chuột không dây","price":350000,"qty":25}
{"sku":"PD05","name":"Lót chuột","price":90000,"qty":100,"tags":["phụ kiện"]}
⚠️  dòng 4: price "giá sốc" không phải số
⚠️  dòng 5: qty "-1" phải là số nguyên ≥ 0
✅ 3 dòng hợp lệ, ⚠️  2 dòng lỗi
exit status 1
```

Kết hợp với pipe - chỉ lấy JSON sạch vào file, lỗi vẫn hiện trên màn hình:

```bash
$ cat products.csv | go run . -in - > products.json
⚠️  dòng 4: price "giá sốc" không phải số
...
```

> 💡 **Vì sao cần `LazyQuotes`?** Trong chuỗi Go, `"Màn hình 27\""` là `Màn hình 27"` trong CSV - một dấu ngoặc kép **lẻ** nằm trong trường không được bọc ngoặc. Theo chuẩn RFC 4180, đây là CSV **sai**, và `csv.Reader` mặc định sẽ dừng với lỗi `parse error on line 5, column 14: bare " in non-quoted-field`. File CSV do người dùng tự gõ hoặc hệ thống cũ xuất ra thường "bẩn" như vậy, nên bật `LazyQuotes` giúp công cụ dễ tính hơn. Hãy thử xóa dòng `cr.LazyQuotes = true` để tự thấy lỗi.

### Ứng dụng 3: CLI quản lý config

**Bài toán**: Viết công cụ `cfgctl` quản lý file cấu hình JSON của ứng dụng, giống `git config`:

```text
cfgctl init              Tạo file config mới
cfgctl set <key> <value> Đặt giá trị
cfgctl get <key>         Đọc giá trị (exit code 1 nếu không có)
cfgctl unset <key>       Xóa một key
cfgctl list [-json]      Liệt kê tất cả
```

**Thiết kế**:
- Đường dẫn file theo thứ tự ưu tiên: cờ `-file` > biến môi trường `CFG_FILE` > mặc định `<UserConfigDir>/cfgctl/config.json`
- **Ghi atomic**: ghi ra file tạm cùng thư mục rồi `os.Rename` → nếu máy mất điện giữa chừng, file cũ vẫn nguyên vẹn (không bao giờ có file config "ghi dở")
- Kiểm tra tên key hợp lệ; file config quyền `0o600` vì có thể chứa bí mật
- Chạy không có tham số → chế độ **demo** thực thi một loạt lệnh trên file tạm

```go
package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"maps"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
)

var keyPattern = regexp.MustCompile(`^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$`) // vd: db.host, server.port

type Store struct {
	path string
}

func (s Store) load() (map[string]string, error) {
	data, err := os.ReadFile(s.path)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, fmt.Errorf("chưa có file config %s (chạy 'cfgctl init' trước)", s.path)
	}
	if err != nil {
		return nil, err
	}
	m := map[string]string{}
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, fmt.Errorf("file config hỏng: %w", err)
	}
	return m, nil
}

// save ghi ATOMIC: file tạm → rename. Rename trong cùng thư mục là thao tác nguyên tử
func (s Store) save(m map[string]string) error {
	data, err := json.MarshalIndent(m, "", "  ") // Map được sắp xếp key tự động khi Marshal
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(s.path), 0o700); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(s.path), ".config-*.tmp")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name()) // Nếu rename thành công, lệnh này chỉ báo lỗi "không tồn tại" - vô hại
	if _, err := tmp.Write(append(data, '\n')); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Chmod(0o600); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), s.path)
}

func resolvePath(flagValue string) (string, error) {
	if flagValue != "" {
		return flagValue, nil
	}
	if env := os.Getenv("CFG_FILE"); env != "" {
		return env, nil
	}
	dir, err := os.UserConfigDir() // ~/.config (Linux), ~/Library/Application Support (macOS), %AppData% (Windows)
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "cfgctl", "config.json"), nil
}

func run(args []string, stdout, stderr io.Writer) int {
	global := flag.NewFlagSet("cfgctl", flag.ContinueOnError)
	global.SetOutput(stderr)
	file := global.String("file", "", "đường dẫn file config (env: CFG_FILE)")
	if err := global.Parse(args); err != nil {
		return 2
	}
	rest := global.Args()
	if len(rest) == 0 {
		fmt.Fprintln(stderr, "cách dùng: cfgctl [-file path] <init|set|get|unset|list> ...")
		return 2
	}
	path, err := resolvePath(*file)
	if err != nil {
		fmt.Fprintln(stderr, "lỗi:", err)
		return 1
	}
	store := Store{path: path}
	cmd, cmdArgs := rest[0], rest[1:]

	fail := func(err error) int {
		fmt.Fprintln(stderr, "lỗi:", err)
		return 1
	}
	usage := func(msg string) int {
		fmt.Fprintln(stderr, msg)
		return 2
	}

	switch cmd {
	case "init":
		fs := flag.NewFlagSet("init", flag.ContinueOnError)
		fs.SetOutput(stderr)
		force := fs.Bool("force", false, "ghi đè file đã có")
		if err := fs.Parse(cmdArgs); err != nil {
			return 2
		}
		if _, err := os.Stat(path); err == nil && !*force {
			return fail(fmt.Errorf("file đã tồn tại, dùng -force để ghi đè"))
		}
		if err := store.save(map[string]string{}); err != nil {
			return fail(err)
		}
		fmt.Fprintln(stdout, "Đã tạo", filepath.Base(path))

	case "set":
		if len(cmdArgs) != 2 {
			return usage("cách dùng: cfgctl set <key> <value>")
		}
		key, value := cmdArgs[0], cmdArgs[1]
		if !keyPattern.MatchString(key) {
			return fail(fmt.Errorf("key %q không hợp lệ (vd hợp lệ: server.port)", key))
		}
		m, err := store.load()
		if err != nil {
			return fail(err)
		}
		old, existed := m[key]
		m[key] = value
		if err := store.save(m); err != nil {
			return fail(err)
		}
		if existed {
			fmt.Fprintf(stdout, "%s: %q → %q\n", key, old, value)
		} else {
			fmt.Fprintf(stdout, "%s = %q\n", key, value)
		}

	case "get":
		if len(cmdArgs) != 1 {
			return usage("cách dùng: cfgctl get <key>")
		}
		m, err := store.load()
		if err != nil {
			return fail(err)
		}
		v, ok := m[cmdArgs[0]]
		if !ok {
			return fail(fmt.Errorf("không có key %q", cmdArgs[0]))
		}
		fmt.Fprintln(stdout, v) // Chỉ in giá trị → dễ dùng trong script: PORT=$(cfgctl get server.port)

	case "unset":
		if len(cmdArgs) != 1 {
			return usage("cách dùng: cfgctl unset <key>")
		}
		m, err := store.load()
		if err != nil {
			return fail(err)
		}
		if _, ok := m[cmdArgs[0]]; !ok {
			return fail(fmt.Errorf("không có key %q", cmdArgs[0]))
		}
		delete(m, cmdArgs[0])
		if err := store.save(m); err != nil {
			return fail(err)
		}
		fmt.Fprintln(stdout, "Đã xóa", cmdArgs[0])

	case "list":
		fs := flag.NewFlagSet("list", flag.ContinueOnError)
		fs.SetOutput(stderr)
		asJSON := fs.Bool("json", false, "xuất JSON")
		if err := fs.Parse(cmdArgs); err != nil {
			return 2
		}
		m, err := store.load()
		if err != nil {
			return fail(err)
		}
		if *asJSON {
			json.NewEncoder(stdout).Encode(m)
			return 0
		}
		for _, k := range slices.Sorted(maps.Keys(m)) {
			fmt.Fprintf(stdout, "%-15s %s\n", k, m[k])
		}

	default:
		return usage(fmt.Sprintf("lệnh không hợp lệ: %q", cmd))
	}
	return 0
}

// demo chạy một loạt lệnh để bạn thấy công cụ hoạt động mà không cần gõ tay
func demo() {
	dir, _ := os.MkdirTemp("", "cfgctl-*")
	defer os.RemoveAll(dir)
	os.Chdir(dir)                     // Làm việc trong thư mục tạm
	os.Setenv("CFG_FILE", "app.json") // Đường dẫn tương đối → output gọn, giống nhau mỗi lần chạy

	commands := []string{
		"get server.port",
		"init",
		"set server.port 8080",
		"set db.host localhost",
		"set server.port 9090",
		"set Server-Port 1",
		"get server.port",
		"list",
		"unset db.host",
		"list -json",
		"get db.host",
	}
	for _, c := range commands {
		fmt.Println("$ cfgctl", c)
		// Gộp stderr vào stdout để thấy mọi thứ theo đúng thứ tự
		code := run(strings.Fields(c), os.Stdout, os.Stdout)
		if code != 0 {
			fmt.Println("  (exit code", code, ")")
		}
	}
}

func main() {
	if len(os.Args) < 2 {
		demo()
		return
	}
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr))
}

// Output:
// $ cfgctl get server.port
// lỗi: chưa có file config app.json (chạy 'cfgctl init' trước)
//   (exit code 1 )
// $ cfgctl init
// Đã tạo app.json
// $ cfgctl set server.port 8080
// server.port = "8080"
// $ cfgctl set db.host localhost
// db.host = "localhost"
// $ cfgctl set server.port 9090
// server.port: "8080" → "9090"
// $ cfgctl set Server-Port 1
// lỗi: key "Server-Port" không hợp lệ (vd hợp lệ: server.port)
//   (exit code 1 )
// $ cfgctl get server.port
// 9090
// $ cfgctl list
// db.host         localhost
// server.port     9090
// $ cfgctl unset db.host
// Đã xóa db.host
// $ cfgctl list -json
// {"server.port":"9090"}
// $ cfgctl get db.host
// lỗi: không có key "db.host"
//   (exit code 1 )
```

> 💡 Để ý cách `get` chỉ in **đúng giá trị** (không kèm tên key hay chữ trang trí) và báo lỗi bằng **exit code** - nhờ vậy script shell có thể dùng `PORT=$(cfgctl get server.port) || exit 1`.

Dùng thật sau khi build:

```bash
go build -o cfgctl .
./cfgctl init
./cfgctl set server.port 8080
PORT=$(./cfgctl get server.port) && echo "Cổng: $PORT"
./cfgctl -file ./staging.json init       # Làm việc với file khác
CFG_FILE=./prod.json ./cfgctl list       # Hoặc qua biến môi trường
```

## ⚠️ Lỗi thường gặp

### Lỗi 1: `defer f.Close()` trong vòng lặp

```go
for _, name := range files { // 10.000 file
	f, _ := os.Open(name)
	defer f.Close() // ❌ Chỉ đóng khi HÀM kết thúc → mở 10.000 file cùng lúc → "too many open files"
}
```

✅ Tách thân vòng lặp ra một hàm riêng (`processFile(name)`) có `defer f.Close()` bên trong.

### Lỗi 2: Quên `Flush()` với `bufio.Writer` / `csv.Writer`

File kết quả bị **thiếu vài dòng cuối** (hoặc rỗng hoàn toàn nếu dữ liệu < 4KB). ✅ Luôn `Flush()` và kiểm tra lỗi của nó.

### Lỗi 3: Không kiểm tra `sc.Err()`

```go
for sc.Scan() { ... }
// ❌ Gặp dòng > 64KB, Scan() trả false → vòng lặp dừng giữa chừng, chương trình tưởng đã hết file
```

✅ Luôn `if err := sc.Err(); err != nil { ... }` sau vòng lặp, và dùng `sc.Buffer(...)` nếu dòng có thể dài.

### Lỗi 4: Mở file bằng đường dẫn tương đối rồi chạy ở thư mục khác

```go
os.ReadFile("config.json") // Tương đối với thư mục ĐANG ĐỨNG khi chạy lệnh, KHÔNG phải thư mục chứa code
```

Chạy `cd /tmp && /app/mytool` → tìm `/tmp/config.json`. ✅ Cho người dùng truyền đường dẫn qua cờ/biến môi trường, hoặc dùng `embed` để nhúng file vào binary.

### Lỗi 5: Field JSON viết thường hoặc sai tag

```go
type User struct {
	name  string `json:"name"`  // ❌ unexported → luôn bị bỏ qua
	Email string `json:"email"` // ✅
	Age   int    `json:age`     // ❌ Thiếu ngoặc kép → tag không có tác dụng (go vet sẽ cảnh báo)
}
```

### Lỗi 6: Đệ quy vô hạn trong `MarshalJSON`

```go
func (o Order) MarshalJSON() ([]byte, error) {
	return json.Marshal(o) // ❌ Gọi lại chính nó → stack overflow
}
```

✅ Dùng mẹo `type alias Order` như mục 5.4.

### Lỗi 7: Đặt cờ sau tham số thường

```bash
./greet An -n 3   # ❌ flag dừng ở "An" → -n 3 thành tham số thường, n vẫn = 1
./greet -n 3 An   # ✅
```

### Lỗi 8: `os.Exit` / `log.Fatal` bỏ qua `defer`

Dữ liệu trong buffer chưa flush, file tạm chưa xóa... ✅ Dùng mẫu `run() error` và chỉ `os.Exit` ở `main()`.

### Lỗi 9: Viết số quyền bằng hệ thập phân

```go
os.WriteFile("secret.txt", data, 600)   // ❌ 600 thập phân = 0o1130 → quyền kỳ quặc
os.WriteFile("secret.txt", data, 0o600) // ✅
```

### Lỗi 10: Tự tách CSV bằng `strings.Split`

```go
strings.Split(`A01,"Bàn phím, loại cơ",1250000`, ",") // ❌ Ra 4 phần thay vì 3
```

✅ Luôn dùng `encoding/csv`.

## 🏋️ Bài tập

### Bài tập 1: `wc` mini (⭐ Dễ)

Viết lại lệnh `wc`: đếm số **dòng**, **từ**, **ký tự** (rune, không phải byte!) của file truyền qua tham số, hoặc của stdin nếu không có tham số. Hỗ trợ cờ `-l`, `-w`, `-c` để chỉ in một loại. Hàm đếm phải nhận `io.Reader` và có unit test dùng `strings.NewReader`.

### Bài tập 2: Tìm file trùng lặp (⭐ Dễ)

Viết `dupfind <thư mục>`: dùng `filepath.WalkDir` duyệt đệ quy, nhóm các file có **cùng kích thước**, sau đó tính SHA-256 (`crypto/sha256` + `io.Copy`) để xác nhận trùng nội dung. In ra các nhóm file trùng và tổng dung lượng có thể tiết kiệm. Bỏ qua `.git`.

### Bài tập 3: JSON → CSV (⭐⭐ Trung bình)

Làm ngược Ứng dụng 2: đọc file JSON là **mảng** sản phẩm bằng `json.Decoder` streaming (`Token` + `More`), ghi ra CSV có BOM để Excel mở không lỗi font. Cột `tags` nối bằng `|`. Test với file 100.000 sản phẩm (tự sinh) và đo RAM bằng `/usr/bin/time -v` (Linux) để thấy RAM gần như không đổi.

### Bài tập 4: Kiểu `Money` tự định dạng (⭐⭐ Trung bình)

Tạo kiểu `type Money int64` (đơn vị: đồng) với:
- `MarshalJSON` → `"1.250.000 ₫"` (có dấu chấm phân cách hàng nghìn)
- `UnmarshalJSON` nhận được cả số `1250000` lẫn chuỗi `"1.250.000 ₫"`
- Viết table-driven test cho cả hai chiều, gồm các trường hợp lỗi

### Bài tập 5: Nâng cấp logstat (⭐⭐⭐ Nâng cao)

Mở rộng Ứng dụng 1:
- Cờ `-from` và `-to` (dạng `2026-09-25T09:00:00Z`) để lọc khoảng thời gian
- Cờ `-format json` để xuất báo cáo dạng JSON (cho hệ thống khác đọc)
- Đọc được file nén `.gz` (gợi ý: `compress/gzip.NewReader` cũng là một `io.Reader`!)
- Nhận **nhiều file** (`logstat -file a.log -file b.log.gz`) và xử lý **song song** mỗi file một goroutine ([Bài 8](./08-concurrency.md)), sau đó gộp kết quả

### Bài tập 6: cfgctl phiên bản typed (⭐⭐⭐ Nâng cao)

Mở rộng Ứng dụng 3:
- Thêm lệnh `cfgctl import <file.env>` đọc file dạng `KEY=VALUE` (bỏ qua dòng trống và dòng bắt đầu bằng `#`)
- Thêm lệnh `cfgctl export` in ra dạng `export SERVER_PORT="9090"` để dùng với `eval $(cfgctl export)`
- Viết test cho `run()` bằng `bytes.Buffer` làm stdout/stderr và `t.TempDir()` làm thư mục config, kiểm tra cả **exit code**

## ✅ Checklist hoàn thành

- [ ] Đọc/ghi file với `os.ReadFile`, `os.WriteFile`, `os.OpenFile` và hiểu các cờ `O_APPEND`, `O_CREATE`...
- [ ] Hiểu quyền file `0o644`, `0o600`, `0o755`
- [ ] Dùng `bufio.Writer` và nhớ `Flush()`
- [ ] Giải thích được `io.Reader`/`io.Writer` và viết hàm nhận `io.Reader`
- [ ] Đọc file lớn từng dòng với `bufio.Scanner`, kiểm tra `sc.Err()`, xử lý dòng dài bằng `sc.Buffer`
- [ ] Dùng `filepath.Join/Base/Ext/Rel`, `os.ReadDir`, `filepath.WalkDir` với `fs.SkipDir`
- [ ] Dùng struct tags: `omitempty`, `omitzero`, `-`, `string`
- [ ] Phân biệt "không gửi" và "giá trị 0" bằng field con trỏ
- [ ] Tự viết `MarshalJSON`/`UnmarshalJSON` (hoặc `MarshalText`) và biết mẹo alias
- [ ] Đọc JSON lớn/NDJSON bằng `json.Decoder`, dùng `json.RawMessage` cho dữ liệu đa hình
- [ ] Đọc/ghi CSV với `encoding/csv`, xử lý BOM của Excel
- [ ] Viết CLI với `flag`, `flag.Func`, subcommand bằng `flag.NewFlagSet`
- [ ] Trả exit code đúng quy ước, dùng mẫu `run()` thay vì `os.Exit` rải rác
- [ ] Tách stdout/stderr, đọc từ stdin để dùng được với pipe
- [ ] Đọc cấu hình từ biến môi trường với giá trị mặc định
- [ ] Chạy thành công cả 3 ứng dụng thực tế
- [ ] Hoàn thành ít nhất 4 bài tập

## 🚀 Tiếp theo

Bạn đã biết cách làm việc với dữ liệu **trên máy của mình**: file, JSON, CSV, dòng lệnh. Bài tiếp theo sẽ đưa dữ liệu **ra mạng**:

- HTTP client "chuẩn production": timeout, context, retry với backoff
- Gọi REST API bên ngoài (GitHub, thời tiết...) và test hoàn toàn offline với `httptest`
- Server nâng cao: middleware chain, validation, error chuẩn, phân trang, upload file
- Xác thực webhook bằng chữ ký HMAC và xây dựng dịch vụ rút gọn link

**Bài tiếp theo**: [HTTP Client & Web API thực tế](./12-http-apis.md)

---

💡 **Tips ghi nhớ**:

- **`io.Reader`/`io.Writer` là ống nước** - viết hàm nhận interface, nối ống thoải mái
- **File lớn → đọc từng dòng**, file nhỏ → `os.ReadFile`
- **Buffer thì phải Flush**, Scanner thì phải kiểm tra `Err()`
- **Tiền là `int64`**, không bao giờ là `float64`
- **stdout cho kết quả, stderr cho lời nói** - để người dùng pipe thoải mái
- **`main()` mỏng, `run()` dày** - dễ test, exit code chuẩn
