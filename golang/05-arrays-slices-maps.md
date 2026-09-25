# 📚 Bài 5: Array, Slice và Map

## 🎯 Mục tiêu bài học

- Hiểu **array** (mảng cố định) và tại sao ít khi dùng trực tiếp
- Thành thạo **slice** - cấu trúc dữ liệu dùng nhiều nhất trong Go
- Hiểu sâu `len`, `cap`, `append`, `copy`, `make` và cách slice hoạt động "bên dưới"
- Tránh các **cái bẫy khi cắt slice** (chia sẻ mảng nền)
- Sử dụng **map** để lưu trữ dạng key-value: thêm, đọc, sửa, xóa
- Dùng mẫu **comma-ok** để kiểm tra key có tồn tại
- Hiểu tại sao **thứ tự duyệt map là ngẫu nhiên**
- Duyệt chuỗi theo **byte** và theo **rune**
- Sử dụng package chuẩn **`slices`** và **`maps`** (Go 1.21+)

## 📖 1. Array - Mảng có kích thước cố định

### Khai báo array

**Array** là một dãy **cố định** các phần tử **cùng kiểu**. Kích thước là **một phần của kiểu dữ liệu**.

```go
package main

import "fmt"

func main() {
	var scores [5]int // Mảng 5 số nguyên, tất cả = 0 (zero value)
	fmt.Println(scores)

	scores[0] = 90 // Gán phần tử đầu tiên (index bắt đầu từ 0)
	scores[4] = 75 // Phần tử cuối cùng
	fmt.Println(scores)
	fmt.Println("Độ dài:", len(scores))

	// Khai báo và khởi tạo cùng lúc
	primes := [5]int{2, 3, 5, 7, 11}
	fmt.Println(primes)

	// Để compiler tự đếm số phần tử với [...]
	colors := [...]string{"đỏ", "xanh", "vàng"}
	fmt.Println(colors, len(colors))

	// Khởi tạo theo index cụ thể
	sparse := [5]int{1: 10, 3: 30}
	fmt.Println(sparse)

	// Mảng 2 chiều
	var grid [2][3]int
	grid[1][2] = 9
	fmt.Println(grid)
}

// Output:
// [0 0 0 0 0]
// [90 0 0 0 75]
// Độ dài: 5
// [2 3 5 7 11]
// [đỏ xanh vàng] 3
// [0 10 0 30 0]
// [[0 0 0] [0 0 9]]
```

### Đặc điểm quan trọng của array

**1. Kích thước là một phần của kiểu**: `[3]int` và `[5]int` là **hai kiểu khác nhau**!

```go
var a [3]int
var b [5]int
// a = b // ❌ cannot use b (variable of type [5]int) as [3]int value in assignment
```

**2. Array là giá trị (value type)** - gán hoặc truyền vào hàm sẽ **sao chép toàn bộ**:

```go
package main

import "fmt"

func main() {
	original := [3]int{1, 2, 3}
	copied := original // Sao chép TOÀN BỘ mảng
	copied[0] = 100

	fmt.Println("original:", original) // Không bị ảnh hưởng
	fmt.Println("copied:", copied)

	// Có thể so sánh 2 array cùng kiểu bằng ==
	fmt.Println([3]int{1, 2, 3} == original)
}

// Output:
// original: [1 2 3]
// copied: [100 2 3]
// true
```

**3. Truy cập ngoài phạm vi → lỗi**:

```go
arr := [3]int{1, 2, 3}
// arr[5] = 10 // ❌ Lỗi biên dịch: invalid argument: index 5 out of bounds [0:3]

i := 5
arr[i] = 10 // 💥 Chạy thì panic: runtime error: index out of range [5] with length 3
```

> 💡 **Khi nào dùng array?** Rất ít! Chỉ khi kích thước **thực sự cố định** và biết trước: tọa độ `[3]float64`, mã băm `[32]byte` (SHA-256), bàn cờ `[8][8]Piece`. Còn lại, **hãy dùng slice**.

## 📖 2. Slice - "Mảng động" của Go ⭐

**Slice** là thứ bạn sẽ dùng **99% thời gian**. Nó giống array nhưng **kích thước linh hoạt**.

> 💡 **So sánh**: Slice giống `List<T>` trong C#, `ArrayList` trong Java, `list` trong Python, `Array` trong JavaScript.

### Tạo slice

```go
package main

import "fmt"

func main() {
	// Cách 1: Slice literal (không ghi kích thước trong [])
	fruits := []string{"táo", "cam", "xoài"}
	fmt.Println(fruits, len(fruits))

	// Cách 2: Khai báo nil slice
	var empty []int
	fmt.Println(empty, len(empty), empty == nil)

	// Cách 3: make(kiểu, len, cap)
	nums := make([]int, 3)    // len=3, cap=3, giá trị [0 0 0]
	buf := make([]int, 0, 10) // len=0, cap=10 - "đặt chỗ trước" 10 phần tử
	fmt.Println(nums, len(nums), cap(nums))
	fmt.Println(buf, len(buf), cap(buf))

	// Cách 4: Cắt từ array hoặc slice khác
	arr := [5]int{10, 20, 30, 40, 50}
	part := arr[1:4] // Phần tử từ index 1 đến 3 (không gồm 4)
	fmt.Println(part)
}

// Output:
// [táo cam xoài] 3
// [] 0 true
// [0 0 0] 3 3
// [] 0 10
// [20 30 40]
```

### Slice hoạt động thế nào "bên dưới"?

Đây là phần **quan trọng nhất** để hiểu slice. Một slice thực chất là một **cấu trúc nhỏ gồm 3 thành phần**:

```text
Slice header
┌─────────────┐
│ pointer ────┼──────┐     Mảng nền (underlying array)
│ len = 3     │      ▼
│ cap = 4     │     ┌────┬────┬────┬────┬────┐
└─────────────┘     │ 10 │ 20 │ 30 │ 40 │ 50 │
                    └────┴────┴────┴────┴────┘
                      [0]  [1]  [2]  [3]  [4]
                           ▲
                    s := arr[1:4] → pointer trỏ vào [1], len=3, cap=4
```

- **pointer**: trỏ tới phần tử đầu tiên của slice trong **mảng nền**
- **len** (length): số phần tử slice đang "nhìn thấy"
- **cap** (capacity): số phần tử tối đa từ vị trí pointer đến **cuối mảng nền**

> 💡 **Ví von**: Mảng nền giống một **dãy ghế trong rạp chiếu phim**. Slice là **một nhóm bạn** ngồi liên tiếp trên dãy ghế đó. `len` là số người trong nhóm, `cap` là số ghế từ chỗ người đầu tiên đến hết dãy. Nhiều nhóm có thể ngồi **chồng lên cùng dãy ghế** - và đây là nguồn gốc của nhiều bug!

### Truy cập và thay đổi phần tử

```go
colors := []string{"đỏ", "xanh", "vàng"}
fmt.Println(colors[0])            // đỏ
colors[1] = "tím"                 // Thay đổi phần tử
fmt.Println(colors)               // [đỏ tím vàng]
fmt.Println(colors[len(colors)-1]) // vàng - phần tử cuối cùng

// Go KHÔNG có index âm như Python: colors[-1] ❌
```

## 📖 3. `append` - Thêm phần tử vào slice

```go
package main

import "fmt"

func main() {
	var nums []int // nil slice - vẫn append được!

	nums = append(nums, 1)       // Thêm 1 phần tử
	nums = append(nums, 2, 3, 4) // Thêm nhiều phần tử
	more := []int{5, 6}
	nums = append(nums, more...) // Nối slice khác (nhớ dấu ...)

	fmt.Println(nums)
}

// Output:
// [1 2 3 4 5 6]
```

⚠️ **Luôn gán lại kết quả của `append`**: `nums = append(nums, x)`. Vì `append` có thể tạo **mảng nền mới** và trả về slice header mới.

### Capacity tăng như thế nào?

Khi `append` mà `len == cap` (hết chỗ), Go sẽ:
1. Cấp phát một **mảng nền mới lớn hơn** (thường gấp đôi khi còn nhỏ)
2. **Sao chép** toàn bộ phần tử cũ sang
3. Thêm phần tử mới

```go
package main

import "fmt"

func main() {
	var s []int
	prevCap := cap(s)
	for i := range 10 {
		s = append(s, i)
		if cap(s) != prevCap {
			fmt.Printf("len=%-2d cap: %d → %d\n", len(s), prevCap, cap(s))
			prevCap = cap(s)
		}
	}
}

// Output:
// len=1  cap: 0 → 1
// len=2  cap: 1 → 2
// len=3  cap: 2 → 4
// len=5  cap: 4 → 8
// len=9  cap: 8 → 16
```

> 💡 Chiến lược tăng capacity cụ thể có thể thay đổi giữa các phiên bản Go - đừng viết code phụ thuộc vào con số chính xác.

✅ **Mẹo hiệu năng**: Nếu biết trước số lượng phần tử, hãy dùng `make([]T, 0, n)` để **tránh cấp phát lại nhiều lần**:

```go
// users là slice các User; u.Name là trường Name của struct User (struct: Bài 6)
results := make([]string, 0, len(users)) // Đặt chỗ trước
for _, u := range users {
	results = append(results, u.Name)
}
```

## 📖 4. Cắt slice (Slicing) và các cái bẫy

### Cú pháp `s[low:high]`

```go
package main

import "fmt"

func main() {
	s := []int{0, 1, 2, 3, 4, 5, 6, 7, 8, 9}

	fmt.Println(s[2:5]) // Từ index 2 đến 4
	fmt.Println(s[:3])  // Từ đầu đến index 2
	fmt.Println(s[7:])  // Từ index 7 đến hết
	fmt.Println(s[:])   // Toàn bộ

	// Xóa phần tử đầu / cuối
	fmt.Println(s[1:])        // Bỏ phần tử đầu
	fmt.Println(s[:len(s)-1]) // Bỏ phần tử cuối
}

// Output:
// [2 3 4]
// [0 1 2]
// [7 8 9]
// [0 1 2 3 4 5 6 7 8 9]
// [1 2 3 4 5 6 7 8 9]
// [0 1 2 3 4 5 6 7 8]
```

> 💡 **Quy tắc nhớ**: `s[low:high]` lấy các phần tử có index `low ≤ i < high`. Số phần tử = `high - low`. Giống `range(low, high)` của Python.

### ⚠️ Cái bẫy 1: Slice con CHIA SẺ mảng nền với slice cha

```go
package main

import "fmt"

func main() {
	original := []int{1, 2, 3, 4, 5}
	sub := original[1:3] // [2 3] - KHÔNG phải bản sao!

	sub[0] = 999 // Thay đổi sub...
	fmt.Println("sub:", sub)
	fmt.Println("original:", original) // ...original cũng bị đổi! 😱
}

// Output:
// sub: [999 3]
// original: [1 999 3 4 5]
```

Vì `sub` và `original` cùng "ngồi trên một dãy ghế" (mảng nền).

### ⚠️ Cái bẫy 2: `append` vào slice con ghi đè slice cha

```go
package main

import "fmt"

func main() {
	original := []int{1, 2, 3, 4, 5}
	sub := original[1:3] // len=2, cap=4 (còn chỗ đến hết mảng nền)
	fmt.Println(len(sub), cap(sub))

	sub = append(sub, 100) // Còn cap → ghi thẳng vào mảng nền, đè lên original[3]!
	fmt.Println("sub:", sub)
	fmt.Println("original:", original)
}

// Output:
// 2 4
// sub: [2 3 100]
// original: [1 2 3 100 5]
```

**Cách phòng tránh**:

```go
// Cách 1: Full slice expression s[low:high:max] - giới hạn cap = max - low
sub := original[1:3:3] // len=2, cap=2 → append sẽ buộc phải tạo mảng mới

// Cách 2: Tạo bản sao độc lập (xem copy / slices.Clone bên dưới)
sub := slices.Clone(original[1:3])
```

### Truyền slice vào hàm

Ở [Bài 4](./04-functions.md) bạn đã biết Go luôn truyền **bản sao**. Với slice, thứ được sao chép chỉ là **slice header** (pointer, len, cap) - còn **mảng nền vẫn dùng chung**. Hệ quả:

```go
package main

import "fmt"

func doubleAll(s []int) {
	for i := range s {
		s[i] *= 2 // ✅ Sửa phần tử: người gọi THẤY thay đổi (chung mảng nền)
	}
}

func addItem(s []int) {
	s = append(s, 99) // ⚠️ Chỉ đổi slice header BẢN SAO: người gọi KHÔNG thấy phần tử mới
	fmt.Println("Trong addItem:", s)
}

func addItemFixed(s []int) []int {
	return append(s, 99) // ✅ Trả về slice mới, người gọi tự gán lại
}

func main() {
	nums := []int{1, 2, 3}

	doubleAll(nums)
	fmt.Println("Sau doubleAll:", nums)

	addItem(nums)
	fmt.Println("Sau addItem:", nums)

	nums = addItemFixed(nums)
	fmt.Println("Sau addItemFixed:", nums)
}

// Output:
// Sau doubleAll: [2 4 6]
// Trong addItem: [2 4 6 99]
// Sau addItem: [2 4 6]
// Sau addItemFixed: [2 4 6 99]
```

> 💡 **Quy tắc**: Hàm **sửa phần tử** của slice → người gọi thấy thay đổi. Hàm **`append`** (thay đổi len/cap) → phải **trả về slice mới** để người gọi gán lại - giống hệt `nums = append(nums, x)`. Đây cũng là lý do các hàm như `slices.Delete`, `slices.Insert` đều trả về slice.

### `copy` - Sao chép slice

```go
package main

import "fmt"

func main() {
	src := []int{1, 2, 3, 4, 5}

	dst := make([]int, len(src)) // Phải có ĐỦ len trước khi copy!
	n := copy(dst, src)          // copy(đích, nguồn), trả về số phần tử đã copy
	dst[0] = 100

	fmt.Println("copied:", n)
	fmt.Println("src:", src) // Không bị ảnh hưởng
	fmt.Println("dst:", dst)

	// copy chỉ sao chép min(len(dst), len(src)) phần tử
	small := make([]int, 2)
	copy(small, src)
	fmt.Println("small:", small)

	// Lỗi hay gặp: dst có len = 0
	var wrong []int
	fmt.Println("copy vào nil slice:", copy(wrong, src))
}

// Output:
// copied: 5
// src: [1 2 3 4 5]
// dst: [100 2 3 4 5]
// small: [1 2]
// copy vào nil slice: 0
```

### Các thao tác slice thường gặp

```go
package main

import "fmt"

func main() {
	s := []string{"a", "b", "c", "d", "e"}

	// Xóa phần tử tại index 2 (giữ thứ tự)
	i := 2
	s = append(s[:i], s[i+1:]...)
	fmt.Println("Sau khi xóa:", s)

	// Chèn "X" vào index 1
	s = append(s[:1], append([]string{"X"}, s[1:]...)...)
	fmt.Println("Sau khi chèn:", s)

	// Đảo ngược
	for l, r := 0, len(s)-1; l < r; l, r = l+1, r-1 {
		s[l], s[r] = s[r], s[l]
	}
	fmt.Println("Đảo ngược:", s)
}

// Output:
// Sau khi xóa: [a b d e]
// Sau khi chèn: [a X b d e]
// Đảo ngược: [e d b X a]
```

> 💡 Viết tay như trên để hiểu cơ chế. Trong thực tế, dùng package `slices` (mục 8) cho gọn: `slices.Delete`, `slices.Insert`, `slices.Reverse`.

### nil slice vs empty slice

```go
var a []int          // nil slice: a == nil là true
b := []int{}         // empty slice: b == nil là false
c := make([]int, 0)  // empty slice

// Cả ba đều: len = 0, append được, range được (không lặp lần nào)
```

✅ Trong hầu hết trường hợp, **dùng `len(s) == 0`** để kiểm tra rỗng, đừng so sánh với `nil`. Khác biệt chủ yếu khi encode JSON: nil slice → `null`, empty slice → `[]`.

### Slice 2 chiều

```go
package main

import "fmt"

func main() {
	rows, cols := 3, 4
	matrix := make([][]int, rows)
	for i := range matrix {
		matrix[i] = make([]int, cols) // Mỗi hàng phải được make riêng
	}
	matrix[1][2] = 7

	for _, row := range matrix {
		fmt.Println(row)
	}
}

// Output:
// [0 0 0 0]
// [0 0 7 0]
// [0 0 0 0]
```

## 📖 5. Map - Bảng tra cứu key-value ⭐

**Map** lưu trữ các cặp **key → value**, cho phép tra cứu **cực nhanh** theo key.

> 💡 **Ví von**: Map giống **cuốn danh bạ điện thoại**: tra tên (key) → ra số điện thoại (value). Tương đương `Dictionary<K,V>` (C#), `HashMap` (Java), `dict` (Python), `Object`/`Map` (JavaScript).

### Tạo map

```go
package main

import "fmt"

func main() {
	// Cách 1: Map literal
	ages := map[string]int{
		"An":   20,
		"Bình": 25,
		"Chi":  22, // Dấu phẩy cuối là BẮT BUỘC khi xuống dòng
	}
	fmt.Println(ages)

	// Cách 2: make
	scores := make(map[string]float64)
	scores["Toán"] = 8.5
	fmt.Println(scores)

	// Cách 3: Map rỗng
	empty := map[int]string{}
	fmt.Println(len(empty))
}

// Output:
// map[An:20 Bình:25 Chi:22]
// map[Toán:8.5]
// 0
```

> 💡 `fmt.Println` in map theo thứ tự key **đã sắp xếp** cho dễ đọc, nhưng khi bạn tự duyệt bằng `range` thì thứ tự là **ngẫu nhiên**.

### CRUD - Thêm, Đọc, Sửa, Xóa

```go
package main

import "fmt"

func main() {
	stock := map[string]int{}

	// CREATE - Thêm
	stock["táo"] = 50
	stock["cam"] = 30

	// READ - Đọc
	fmt.Println("Táo:", stock["táo"])

	// Đọc key KHÔNG tồn tại → trả về zero value (không lỗi!)
	fmt.Println("Nho:", stock["nho"])

	// UPDATE - Sửa
	stock["táo"] = 45
	stock["cam"] += 10 // Đọc + sửa cùng lúc

	// Tăng số đếm - zero value giúp code rất gọn
	stock["chuối"]++ // "chuối" chưa có → 0 + 1 = 1

	// DELETE - Xóa
	delete(stock, "cam")
	delete(stock, "không-có") // Xóa key không tồn tại: không lỗi

	fmt.Println(stock, "- số loại:", len(stock))
}

// Output:
// Táo: 50
// Nho: 0
// map[chuối:1 táo:45] - số loại: 2
```

### Mẫu comma-ok: Key có tồn tại không?

Vấn đề: `stock["nho"]` trả về `0`. Vậy là "nho có 0 quả" hay "không có nho"? Dùng **comma-ok**:

```go
package main

import "fmt"

func main() {
	stock := map[string]int{"táo": 0, "cam": 30}

	qty, ok := stock["táo"]
	fmt.Println(qty, ok) // Có key, giá trị 0

	qty, ok = stock["nho"]
	fmt.Println(qty, ok) // Không có key

	// Cách viết phổ biến nhất: kết hợp với if init
	if q, found := stock["cam"]; found {
		fmt.Println("Còn", q, "quả cam")
	} else {
		fmt.Println("Không bán cam")
	}
}

// Output:
// 0 true
// 0 false
// Còn 30 quả cam
```

> 💡 Tên `ok` là quy ước trong Go. Mẫu `value, ok := ...` còn xuất hiện ở type assertion ([Bài 6](./06-structs-methods-interfaces.md)) và nhận từ channel ([Bài 8](./08-concurrency.md)).

### Duyệt map - Thứ tự NGẪU NHIÊN

```go
package main

import (
	"fmt"
	"sort"
)

func main() {
	prices := map[string]int{"cà phê": 25, "trà": 15, "bánh mì": 20, "nước ép": 30}

	// Thứ tự có thể KHÁC NHAU mỗi lần chạy!
	for name, price := range prices {
		_ = name
		_ = price
	}

	// ✅ Muốn có thứ tự: lấy key ra, sắp xếp, rồi duyệt
	keys := make([]string, 0, len(prices))
	for k := range prices {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for _, k := range keys {
		fmt.Printf("%-8s %d.000đ\n", k, prices[k])
	}
}

// Output:
// bánh mì  20.000đ
// cà phê   25.000đ
// nước ép  30.000đ
// trà      15.000đ
```

**Tại sao Go cố tình làm thứ tự ngẫu nhiên?** Để lập trình viên **không vô tình phụ thuộc** vào thứ tự. Trong các ngôn ngữ khác, thứ tự "tình cờ" ổn định khiến code chạy đúng trên máy dev nhưng sai khi đổi phiên bản. Go "phá" thứ tự ngay từ đầu để bạn phát hiện sớm.

> 💡 Cột `%-8s` căn theo byte nên chữ có dấu có thể lệch một chút - đây là giới hạn của `Printf` với Unicode.

### Map với value phức tạp

```go
package main

import "fmt"

func main() {
	// Map từ lớp → danh sách học sinh
	classes := map[string][]string{}
	classes["10A"] = append(classes["10A"], "An") // nil slice vẫn append được
	classes["10A"] = append(classes["10A"], "Bình")
	classes["10B"] = append(classes["10B"], "Chi")
	fmt.Println(classes)

	// Map lồng map - phải khởi tạo map con trước khi ghi!
	grades := map[string]map[string]float64{}
	if grades["An"] == nil {
		grades["An"] = map[string]float64{}
	}
	grades["An"]["Toán"] = 9
	grades["An"]["Văn"] = 7.5
	fmt.Println(grades)
}

// Output:
// map[10A:[An Bình] 10B:[Chi]]
// map[An:map[Toán:9 Văn:7.5]]
```

### Đặc điểm quan trọng của map

- **Key phải so sánh được** (`==`): string, số, bool, array, struct (chỉ chứa field so sánh được). **Không** dùng slice, map, function làm key
- **Map là kiểu tham chiếu**: gán map cho biến khác hoặc truyền vào hàm → **cùng một map**
- **Zero value của map là `nil`**: đọc từ nil map OK, nhưng **ghi vào nil map → panic**!
- **Không an toàn khi nhiều goroutine cùng ghi** → cần `sync.Mutex` ([Bài 8](./08-concurrency.md))

```go
m1 := map[string]int{"a": 1}
m2 := m1       // m2 và m1 là CÙNG một map
m2["a"] = 100
fmt.Println(m1["a"]) // 100
```

### Ví dụ thực tế: Đếm tần suất từ

```go
package main

import (
	"fmt"
	"sort"
	"strings"
)

func main() {
	text := "go is fun and go is fast and go is simple"

	counts := map[string]int{}
	for _, word := range strings.Fields(text) {
		counts[word]++
	}

	// Sắp xếp theo số lần xuất hiện giảm dần, bằng nhau thì theo chữ cái
	words := make([]string, 0, len(counts))
	for w := range counts {
		words = append(words, w)
	}
	sort.Slice(words, func(i, j int) bool {
		if counts[words[i]] != counts[words[j]] {
			return counts[words[i]] > counts[words[j]]
		}
		return words[i] < words[j]
	})

	for _, w := range words {
		fmt.Printf("%-7s %s %d\n", w, strings.Repeat("█", counts[w]), counts[w])
	}
}

// Output:
// go      ███ 3
// is      ███ 3
// and     ██ 2
// fast    █ 1
// fun     █ 1
// simple  █ 1
```

## 📖 6. Duyệt chuỗi: byte vs rune

Nhắc lại từ [Bài 2](./02-variables-types.md): string trong Go là **dãy byte UTF-8**. Có 2 cách duyệt:

```go
package main

import "fmt"

func main() {
	s := "Hà Nội"

	// Cách 1: Duyệt theo INDEX → từng BYTE
	fmt.Print("Bytes: ")
	for i := 0; i < len(s); i++ {
		fmt.Printf("%x ", s[i]) // s[i] là byte
	}
	fmt.Println()

	// Cách 2: Duyệt bằng RANGE → từng RUNE (ký tự) ✅
	for i, r := range s {
		fmt.Printf("vị trí byte %d: %c\n", i, r)
	}

	fmt.Println("len (byte):", len(s))
	fmt.Println("số ký tự:", len([]rune(s)))
}

// Output:
// Bytes: 48 c3 a0 20 4e e1 bb 99 69
// vị trí byte 0: H
// vị trí byte 1: à
// vị trí byte 3:
// vị trí byte 4: N
// vị trí byte 5: ộ
// vị trí byte 8: i
// len (byte): 9
// số ký tự: 6
```

Để ý: index **nhảy cóc** (1 → 3, 5 → 8) vì "à" chiếm 2 byte, "ộ" chiếm 3 byte.

| Cách | Mỗi phần tử là | Dùng khi |
|------|---------------|----------|
| `for i := 0; i < len(s); i++` + `s[i]` | `byte` | Dữ liệu ASCII, xử lý nhị phân |
| `for i, r := range s` | `rune` | Văn bản có Unicode (tiếng Việt, emoji) ✅ |
| `[]rune(s)` rồi truy cập `rs[i]` | `rune` | Cần truy cập ngẫu nhiên ký tự thứ i |
| `[]byte(s)` | `byte` | Cần sửa đổi dữ liệu, ghi file/mạng |

### Ví dụ: Viết hoa chữ cái đầu và đếm loại ký tự

```go
package main

import (
	"fmt"
	"strings"
	"unicode"
)

func capitalize(s string) string {
	words := strings.Fields(s)
	for i, w := range words {
		rs := []rune(w)
		rs[0] = unicode.ToUpper(rs[0]) // Sửa trên []rune, không sửa được trên string
		words[i] = string(rs)
	}
	return strings.Join(words, " ")
}

func main() {
	fmt.Println(capitalize("nguyễn thị ánh"))

	letters, digits, spaces := 0, 0, 0
	for _, r := range "Xin chào 2024!" {
		switch {
		case unicode.IsLetter(r): // "à" vẫn được tính là MỘT chữ cái
			letters++
		case unicode.IsDigit(r):
			digits++
		case unicode.IsSpace(r):
			spaces++
		}
	}
	fmt.Println("Chữ cái:", letters, "- Chữ số:", digits, "- Khoảng trắng:", spaces)
}

// Output:
// Nguyễn Thị Ánh
// Chữ cái: 7 - Chữ số: 4 - Khoảng trắng: 2
```

> 💡 Package `unicode` có nhiều hàm kiểm tra rune hữu ích: `IsLetter`, `IsDigit`, `IsSpace`, `IsUpper`, `IsLower`, `IsPunct`, `ToUpper`, `ToLower`. Nếu bạn duyệt theo **byte** thay vì rune, chữ "à" sẽ bị tách thành 2 byte vô nghĩa và bị đếm sai.

## 📖 7. Hàm dựng sẵn hữu ích: `min`, `max`, `clear` (Go 1.21+)

```go
package main

import "fmt"

func main() {
	fmt.Println(min(3, 1, 2), max(3, 1, 2)) // Nhận bao nhiêu tham số cũng được
	fmt.Println(min(2.5, 1.5), max("apple", "banana"))

	m := map[string]int{"a": 1, "b": 2}
	clear(m) // Xóa hết phần tử của map
	fmt.Println(len(m))

	s := []int{1, 2, 3}
	clear(s) // Đặt mọi phần tử về zero value (len giữ nguyên)
	fmt.Println(s)
}

// Output:
// 1 3
// 1.5 banana
// 0
// [0 0 0]
```

## 📖 8. Package `slices` và `maps` (Go 1.21+) ⭐

Trước Go 1.21, bạn phải tự viết vòng lặp cho những việc đơn giản như "tìm phần tử", "sắp xếp". Giờ đây đã có package chuẩn!

### Package `slices`

```go
package main

import (
	"fmt"
	"slices"
)

func main() {
	nums := []int{5, 2, 8, 1, 9, 3}

	// Tìm kiếm
	fmt.Println(slices.Contains(nums, 8)) // Có chứa 8?
	fmt.Println(slices.Index(nums, 9))    // Vị trí của 9
	fmt.Println(slices.Index(nums, 100))  // Không có → -1

	// Min, Max (panic nếu slice rỗng)
	fmt.Println(slices.Min(nums), slices.Max(nums))

	// Sắp xếp (sắp xếp TẠI CHỖ - thay đổi slice gốc)
	sorted := slices.Clone(nums) // Sao chép để giữ nguyên bản gốc
	slices.Sort(sorted)
	fmt.Println(nums, "→", sorted)

	// Tìm kiếm nhị phân trên slice đã sắp xếp
	idx, found := slices.BinarySearch(sorted, 8)
	fmt.Println(idx, found)

	// Đảo ngược
	slices.Reverse(sorted)
	fmt.Println(sorted)

	// So sánh 2 slice
	fmt.Println(slices.Equal([]int{1, 2}, []int{1, 2}))

	// Xóa, chèn (trả về slice mới - nhớ gán lại)
	s := []string{"a", "b", "c", "d"}
	s = slices.Delete(s, 1, 3) // Xóa index [1, 3)
	fmt.Println(s)
	s = slices.Insert(s, 1, "X", "Y") // Chèn tại index 1
	fmt.Println(s)

	// Loại bỏ phần tử trùng LIÊN TIẾP (thường dùng sau khi Sort)
	dup := []int{1, 1, 2, 3, 3, 3, 4}
	fmt.Println(slices.Compact(dup))

	// Tìm với điều kiện tùy ý
	i := slices.IndexFunc(nums, func(n int) bool { return n > 6 })
	fmt.Println("Số đầu tiên > 6 ở vị trí", i)
}

// Output:
// true
// 4
// -1
// 1 9
// [5 2 8 1 9 3] → [1 2 3 5 8 9]
// 4 true
// [9 8 5 3 2 1]
// true
// [a d]
// [a X Y d]
// [1 2 3 4]
// Số đầu tiên > 6 ở vị trí 2
```

### Sắp xếp theo tiêu chí tùy chỉnh với `slices.SortFunc`

```go
package main

import (
	"cmp"
	"fmt"
	"slices"
	"strings"
)

func main() {
	names := []string{"minh", "An", "bình", "Chi"}

	// Sắp xếp không phân biệt hoa thường
	slices.SortFunc(names, func(a, b string) int {
		return strings.Compare(strings.ToLower(a), strings.ToLower(b))
	})
	fmt.Println(names)

	// Sắp xếp theo độ dài giảm dần
	words := []string{"go", "golang", "gopher", "g"}
	slices.SortFunc(words, func(a, b string) int {
		return cmp.Compare(len(b), len(a)) // b trước a → giảm dần
	})
	fmt.Println(words)
}

// Output:
// [An bình Chi minh]
// [golang gopher go g]
```

> 💡 Hàm so sánh trả về: **số âm** nếu `a` đứng trước `b`, **0** nếu bằng nhau, **số dương** nếu `a` đứng sau `b`. `cmp.Compare` làm việc này giúp bạn.

### Package `maps`

```go
package main

import (
	"fmt"
	"maps"
	"slices"
)

func main() {
	stock := map[string]int{"táo": 5, "cam": 3, "xoài": 8}

	// Lấy danh sách key ĐÃ SẮP XẾP (Go 1.23+: maps.Keys trả về iterator)
	keys := slices.Sorted(maps.Keys(stock))
	fmt.Println(keys)

	// Lấy danh sách value đã sắp xếp
	values := slices.Sorted(maps.Values(stock))
	fmt.Println(values)

	// Sao chép map (bản sao độc lập)
	backup := maps.Clone(stock)
	backup["táo"] = 0
	fmt.Println(stock["táo"], backup["táo"])

	// So sánh 2 map
	fmt.Println(maps.Equal(stock, backup))

	// Chép tất cả phần tử từ map này sang map khác (ghi đè nếu trùng key)
	extra := map[string]int{"nho": 10, "cam": 99}
	maps.Copy(stock, extra)
	fmt.Println(stock)

	// Xóa theo điều kiện
	maps.DeleteFunc(stock, func(k string, v int) bool { return v < 6 })
	fmt.Println(stock)
}

// Output:
// [cam táo xoài]
// [3 5 8]
// 5 0
// false
// map[cam:99 nho:10 táo:5 xoài:8]
// map[cam:99 nho:10 xoài:8]
```

> 💡 **`iter` (Go 1.23)**: `maps.Keys` và `maps.Values` trả về một **iterator** (`iter.Seq`) chứ không phải slice. Bạn có thể `for k := range maps.Keys(m)` trực tiếp, hoặc gom thành slice bằng `slices.Collect(...)` / `slices.Sorted(...)`.

## ⚠️ Lỗi thường gặp

### Lỗi 1: Ghi vào nil map → panic

```go
var m map[string]int // nil map
m["a"] = 1           // 💥 panic: assignment to entry in nil map
```

✅ Luôn khởi tạo: `m := map[string]int{}` hoặc `m := make(map[string]int)`.

### Lỗi 2: Quên gán lại kết quả `append`

```go
nums := []int{1, 2}
append(nums, 3) // ❌ Lỗi biên dịch: append(nums, 3) (value of type []int) is not used
nums = append(nums, 3) // ✅
```

### Lỗi 3: Truy cập ngoài phạm vi slice

```go
s := []int{1, 2, 3}
fmt.Println(s[3]) // 💥 panic: runtime error: index out of range [3] with length 3
```

✅ Luôn kiểm tra `len(s)` trước, hoặc duyệt bằng `range`.

### Lỗi 4: Bất ngờ vì slice con chia sẻ mảng nền

Xem mục 4 - dùng `slices.Clone` hoặc full slice expression `s[a:b:b]` khi cần độc lập.

### Lỗi 5: `make([]int, n)` rồi lại `append`

```go
s := make([]int, 3)   // [0 0 0] - len = 3!
s = append(s, 1, 2)
fmt.Println(s)        // [0 0 0 1 2] - có 3 số 0 thừa ở đầu 😱

s2 := make([]int, 0, 3) // ✅ len = 0, cap = 3
s2 = append(s2, 1, 2)
fmt.Println(s2)         // [1 2]
```

### Lỗi 6: Phụ thuộc vào thứ tự duyệt map

✅ Sắp xếp key trước khi duyệt nếu cần thứ tự (dùng `slices.Sorted(maps.Keys(m))`).

### Lỗi 7: So sánh slice bằng `==`

```go
a := []int{1, 2}
b := []int{1, 2}
// fmt.Println(a == b) // ❌ invalid operation: a == b (slice can only be compared to nil)
fmt.Println(slices.Equal(a, b)) // ✅ true
```

### Lỗi 8: Dùng slice làm key của map

```go
// m := map[[]int]string{} // ❌ invalid map key type []int
m := map[[2]int]string{}   // ✅ Array dùng được làm key
m[[2]int{1, 2}] = "điểm A"
```

### Lỗi 9: Cắt chuỗi tiếng Việt theo byte

```go
s := "Việt Nam"
fmt.Println(s[:2])            // "Vi" - may mắn đúng
fmt.Println(s[:3])            // "Vi\xe1" - ký tự bị cắt đôi, in ra ký tự lỗi �
fmt.Println(string([]rune(s)[:3])) // "Việ" ✅
```

## 🏋️ Bài tập

### Bài tập 1: Thống kê điểm

Cho `scores := []float64{7.5, 8.0, 6.5, 9.0, 5.5, 8.5}`. Tính và in ra: điểm cao nhất, thấp nhất, trung bình, và danh sách điểm đã sắp xếp giảm dần (không làm thay đổi `scores` gốc).

### Bài tập 2: Loại bỏ trùng lặp

Viết hàm `unique(nums []int) []int` trả về slice không có phần tử trùng, **giữ nguyên thứ tự xuất hiện đầu tiên**. Gợi ý: dùng `map[int]bool` để đánh dấu đã gặp.

```go
unique([]int{3, 1, 3, 2, 1, 4}) // [3 1 2 4]
```

### Bài tập 3: Nhóm theo độ dài

Cho danh sách từ, nhóm chúng theo độ dài (số ký tự) vào `map[int][]string`. In kết quả theo thứ tự độ dài tăng dần.

```text
2: [go là]
4: [ngôn]
...
```

### Bài tập 4: Anagram

Viết hàm `isAnagram(a, b string) bool` kiểm tra hai chuỗi có phải là đảo chữ của nhau không (ví dụ "listen" và "silent"). Gợi ý: đếm tần suất rune bằng map, hoặc sắp xếp `[]rune`.

### Bài tập 5: Chunk

Viết hàm `chunk(s []int, size int) [][]int` chia slice thành các phần có kích thước `size`:

```go
chunk([]int{1, 2, 3, 4, 5, 6, 7}, 3) // [[1 2 3] [4 5 6] [7]]
```

(Go 1.23 có sẵn `slices.Chunk` trả về iterator - hãy tự viết trước rồi so sánh.)

### Bài tập 6: Danh bạ điện thoại

Xây dựng danh bạ bằng `map[string]string` với các hàm: `add(name, phone)`, `find(name) (string, bool)`, `remove(name)`, `listAll()` (in theo thứ tự tên A-Z). Xử lý trường hợp tìm/xóa người không tồn tại.

### Bài tập 7: Dự đoán output

```go
a := []int{1, 2, 3, 4}
b := a[:2]
b = append(b, 99)
fmt.Println(a, b)
```

<details>
<summary>👉 Xem đáp án</summary>

```text
[1 2 99 4] [1 2 99]
```

`b` có len=2 nhưng cap=4, nên `append` ghi đè vào `a[2]`.

</details>

## ✅ Checklist hoàn thành

- [ ] Khai báo và sử dụng array, hiểu array là value type
- [ ] Tạo slice bằng literal, `make`, và cắt từ slice/array khác
- [ ] Giải thích được slice header gồm pointer, len, cap
- [ ] Dùng `append` và luôn gán lại kết quả
- [ ] Hiểu cái bẫy chia sẻ mảng nền và cách phòng tránh
- [ ] Dùng `copy` và `slices.Clone` để sao chép
- [ ] Hiểu khi truyền slice vào hàm: sửa phần tử thì người gọi thấy, `append` thì phải trả về slice mới
- [ ] Phân biệt `make([]T, n)` và `make([]T, 0, n)`
- [ ] Tạo map, thêm/đọc/sửa/xóa phần tử
- [ ] Dùng comma-ok để kiểm tra key tồn tại
- [ ] Biết ghi vào nil map gây panic
- [ ] Duyệt map theo thứ tự bằng cách sắp xếp key
- [ ] Duyệt chuỗi theo byte và theo rune
- [ ] Sử dụng các hàm trong package `slices` và `maps`
- [ ] Hoàn thành ít nhất 4 bài tập

## 🚀 Tiếp theo

Bạn đã nắm vững các cấu trúc dữ liệu cốt lõi! Tiếp theo, hãy học cách tự **định nghĩa kiểu dữ liệu riêng** và cách Go làm "hướng đối tượng":

- Struct - gom dữ liệu liên quan lại với nhau
- Con trỏ - `&` và `*`
- Method và receiver
- Interface - "hợp đồng hành vi"
- Generics cơ bản

**Bài tiếp theo**: [Struct, Method & Interface](./06-structs-methods-interfaces.md)

---

💡 **Tips ghi nhớ**:

- **Dùng slice, không dùng array** (trừ khi kích thước thật sự cố định)
- **`s = append(s, x)`** - luôn gán lại
- **Slice con chia sẻ mảng nền** - `slices.Clone` khi cần bản độc lập
- **Map phải được khởi tạo** trước khi ghi
- **Thứ tự map là ngẫu nhiên** - sắp xếp key khi cần thứ tự
- **`range` trên string cho rune** - an toàn với tiếng Việt
