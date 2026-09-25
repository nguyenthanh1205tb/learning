# 📚 Bài 15: Generics nâng cao, Reflection & Thư viện chuẩn hữu ích

## 🎯 Mục tiêu bài học

- Hiểu sâu **constraint**: tập kiểu (`|`), **kiểu nền** (`~`), `comparable`, `cmp.Ordered`, constraint có method
- Viết **kiểu generic** (`Stack[T]`, `Set[T]`, `LRU[K, V]`) và **hàm generic** (`Map`, `Filter`, `Reduce`, `GroupBy`)
- Biết khi nào **KHÔNG nên** dùng generics
- Dùng **iterator** của Go 1.23: `range` trên hàm, `iter.Seq`, `iter.Seq2`, các hàm iterator của `slices`/`maps`
- Hiểu **reflection**: `reflect.TypeOf`/`ValueOf`, `Kind`, đọc **struct tag**, sửa giá trị qua con trỏ
- Làm việc thành thạo với **`time`**: layout `2006-01-02`, múi giờ, `Duration`, `Timer`
- Ghi log có cấu trúc với **`log/slog`**: JSON handler, level, attr, group, context
- **Nhúng file** vào binary với `//go:embed`
- Sinh văn bản bằng **`text/template`** và HTML an toàn bằng **`html/template`**
- Dùng đúng **`strings.Builder`**, **`bytes.Buffer`**, **`slices`**, **`maps`**, **`sort`**
- Xây dựng 4 ứng dụng thực tế: **validator dựa trên tag**, **LRU cache generic**, **email báo cáo bằng template**, **web server nhúng file tĩnh**

## 📖 1. Generics nâng cao - Constraint

### Ôn nhanh Bài 6

Ở [Bài 6](./06-structs-methods-interfaces.md) bạn đã viết `func Map[T, U any](...)` và `Stack[T any]`. Nhắc lại từ vựng:

```go
func Sum[T Number](nums ...T) T
//      │ └──── constraint: T được phép là những kiểu nào
//      └────── type parameter: "biến" đại diện cho một KIỂU
```

- **Type parameter** (`T`): giống tham số hàm, nhưng thay vì nhận **giá trị**, nó nhận **kiểu**
- **Constraint**: một `interface` mô tả **tập hợp kiểu được phép** và **những gì bạn được làm** với `T` (dùng `+`? `<`? `==`? gọi method?)
- **Type inference**: thường bạn không cần ghi `Sum[int](1, 2)` - compiler tự suy ra `T = int` từ tham số

> 💡 **Ví von**: Hàm generic giống **khuôn làm bánh**. Constraint là **dòng chữ in trên khuôn**: "chỉ dùng cho bột mì, bột gạo". Bạn không cần làm một khuôn riêng cho mỗi loại bột, nhưng cũng không thể đổ xi măng vào.

### Constraint là "tập hợp kiểu"

Từ Go 1.18, interface có thể liệt kê **danh sách kiểu** bằng `|`. Interface kiểu này **chỉ dùng làm constraint**, không dùng làm kiểu biến thông thường.

**Dấu `~` (tilde)** nghĩa là "**mọi kiểu có kiểu nền (underlying type) là...**". Không có `~`, constraint `int | float64` sẽ **từ chối** `type Celsius float64` vì `Celsius` là kiểu **khác** `float64` (dù kiểu nền giống nhau).

```go
package main

import (
	"cmp"
	"fmt"
	"strconv"
)

// ===== 1. Constraint là một interface mô tả "tập hợp kiểu" =====

// Number: các kiểu số. Dấu ~ nghĩa là "mọi kiểu có KIỂU NỀN (underlying type) là..."
type Number interface {
	~int | ~int32 | ~int64 | ~float32 | ~float64
}

func Sum[T Number](nums ...T) T {
	var total T // Zero value của T (0 với số)
	for _, n := range nums {
		total += n
	}
	return total
}

// Celsius có kiểu nền float64 → thỏa ~float64 → dùng được với Sum
type Celsius float64

// ===== 2. cmp.Ordered: mọi kiểu so sánh được bằng < > (số, chuỗi) =====

func MaxOf[T cmp.Ordered](first T, rest ...T) T {
	m := first
	for _, v := range rest {
		m = max(m, v) // Hàm dựng sẵn max (Go 1.21+) cũng là generic
	}
	return m
}

// ===== 3. Constraint kết hợp: tập kiểu + method =====

// IntStringer: kiểu nền int VÀ có method String()
type IntStringer interface {
	~int
	String() string
}

type Priority int

func (p Priority) String() string {
	return [...]string{"Thấp", "Vừa", "Cao"}[p]
}

// Highest trả về phần tử lớn nhất (dùng được < vì ~int) và in tên (dùng được String())
func Highest[T IntStringer](items []T) string {
	best := items[0]
	for _, it := range items[1:] {
		if it > best {
			best = it
		}
	}
	return best.String() + " (" + strconv.Itoa(int(best)) + ")"
}

// ===== 4. comparable: dùng được == và làm key của map =====

func IndexOf[T comparable](items []T, target T) int {
	for i, v := range items {
		if v == target {
			return i
		}
	}
	return -1
}

func main() {
	fmt.Println(Sum(1, 2, 3))               // T = int (tự suy luận)
	fmt.Println(Sum(1.5, 2.25))             // T = float64
	fmt.Println(Sum[Celsius](36.5, 0.7))    // T = Celsius - nhờ dấu ~
	fmt.Printf("%T\n", Sum(Celsius(20), 5)) // Kết quả vẫn là Celsius, không phải float64
	fmt.Println(MaxOf(3, 9, 4), MaxOf("chuối", "táo", "cam"))
	fmt.Println(Highest([]Priority{1, 2, 0}))
	fmt.Println(IndexOf([]string{"a", "b", "c"}, "c"))
	fmt.Println(cmp.Compare(2, 5), cmp.Compare("b", "a"), cmp.Or("", "mặc định"))
}

// Output:
// 6
// 3.75
// 37.2
// main.Celsius
// 9 táo
// Cao (2)
// 2
// -1 1 mặc định
```

### Các constraint hay dùng

| Constraint | Cho phép làm gì với `T` | Ví dụ kiểu thỏa mãn |
|------------|------------------------|---------------------|
| `any` | Gán, truyền, trả về (không so sánh được) | Mọi kiểu |
| `comparable` | `==`, `!=`, làm **key của map** | `int`, `string`, struct chỉ chứa field comparable, con trỏ... |
| `cmp.Ordered` | `<`, `<=`, `>`, `>=`, `==` | Mọi kiểu số, `string` (và các kiểu có `~` tương ứng) |
| `interface{ ~int \| ~float64 }` | Các toán tử chung của những kiểu đó (`+`, `-`, `*`, `<`...) | `int`, `float64`, `Celsius`... |
| `interface{ String() string }` | Gọi method `String()` | Mọi kiểu có method đó |
| `interface{ ~int; String() string }` | Cả hai: toán tử của int **và** gọi method | `Priority` ở ví dụ trên |

> 💡 **Package `cmp`** (Go 1.21+): `cmp.Ordered` (constraint), `cmp.Compare(a, b)` (trả về -1/0/1), `cmp.Less(a, b)`, và `cmp.Or(a, b, c...)` - trả về giá trị **khác zero đầu tiên**. `cmp.Or` cực kỳ tiện để đặt giá trị mặc định: `port := cmp.Or(os.Getenv("PORT"), "8080")`.

## 📖 2. Kiểu generic và hàm generic thực chiến

```go
package main

import (
	"fmt"
	"slices"
	"strings"
)

// ===== Kiểu generic: Stack[T] (ôn lại Bài 6) =====

type Stack[T any] struct {
	items []T
}

func (s *Stack[T]) Push(v T) { s.items = append(s.items, v) }

// Pop trả về (giá trị, true); stack rỗng thì trả về (zero value, false)
func (s *Stack[T]) Pop() (T, bool) {
	var zero T // Không biết T là gì → dùng "var zero T" để có zero value
	if len(s.items) == 0 {
		return zero, false
	}
	v := s.items[len(s.items)-1]
	s.items = s.items[:len(s.items)-1]
	return v, true
}

// ===== Kiểu generic: Set[T] =====

// Set là tập hợp không trùng lặp. T phải comparable để làm key của map.
type Set[T comparable] struct {
	m map[T]struct{}
}

func NewSet[T comparable](items ...T) *Set[T] {
	s := &Set[T]{m: make(map[T]struct{}, len(items))}
	for _, it := range items {
		s.Add(it)
	}
	return s
}

func (s *Set[T]) Add(v T)      { s.m[v] = struct{}{} }
func (s *Set[T]) Has(v T) bool { _, ok := s.m[v]; return ok }
func (s *Set[T]) Len() int     { return len(s.m) }
func (s *Set[T]) Remove(v T)   { delete(s.m, v) }

// Intersect: phần tử có trong CẢ HAI tập
func (s *Set[T]) Intersect(other *Set[T]) *Set[T] {
	out := NewSet[T]()
	for v := range s.m {
		if other.Has(v) {
			out.Add(v)
		}
	}
	return out
}

// ===== Hàm generic: Map / Filter / Reduce =====

func Map[T, R any](items []T, f func(T) R) []R {
	out := make([]R, 0, len(items)) // Cấp phát đủ chỗ ngay từ đầu
	for _, it := range items {
		out = append(out, f(it))
	}
	return out
}

func Filter[T any](items []T, keep func(T) bool) []T {
	var out []T
	for _, it := range items {
		if keep(it) {
			out = append(out, it)
		}
	}
	return out
}

func Reduce[T, A any](items []T, initial A, f func(A, T) A) A {
	acc := initial
	for _, it := range items {
		acc = f(acc, it)
	}
	return acc
}

// GroupBy: nhóm phần tử theo khóa do hàm key tính ra
func GroupBy[T any, K comparable](items []T, key func(T) K) map[K][]T {
	out := make(map[K][]T)
	for _, it := range items {
		k := key(it)
		out[k] = append(out[k], it)
	}
	return out
}

type Order struct {
	Customer string
	Amount   int
	Paid     bool
}

func main() {
	var history Stack[string] // Zero value dùng được ngay
	history.Push("/home")
	history.Push("/cart")
	page, _ := history.Pop()
	_, ok := (&Stack[int]{}).Pop()
	fmt.Println("Quay lại từ:", page, "| Pop stack rỗng:", ok)

	backend := NewSet("Go", "Java", "Python", "Rust")
	fast := NewSet("Go", "Rust", "C")
	both := backend.Intersect(fast)
	fmt.Println("Có Go?", both.Has("Go"), "| Có Java?", both.Has("Java"), "| Số phần tử:", both.Len())

	orders := []Order{
		{"An", 120000, true}, {"Bình", 50000, false},
		{"An", 300000, true}, {"Chi", 80000, true},
	}

	paid := Filter(orders, func(o Order) bool { return o.Paid })
	names := Map(paid, func(o Order) string { return strings.ToUpper(o.Customer) })
	total := Reduce(paid, 0, func(sum int, o Order) int { return sum + o.Amount })
	fmt.Println(names, total)

	byCustomer := GroupBy(orders, func(o Order) string { return o.Customer })
	fmt.Println("Số đơn của An:", len(byCustomer["An"]))

	// Thư viện chuẩn đã có sẵn nhiều hàm generic - hãy dùng trước khi tự viết!
	amounts := Map(orders, func(o Order) int { return o.Amount })
	fmt.Println(slices.Max(amounts), slices.Contains(amounts, 50000), slices.Index(amounts, 80000))
}

// Output:
// Quay lại từ: /cart | Pop stack rỗng: false
// Có Go? true | Có Java? false | Số phần tử: 2
// [AN AN CHI] 500000
// Số đơn của An: 2
// 300000 true 3
```

**Các điểm cần chú ý**:

- **`var zero T`**: Trong code generic, bạn không biết `T` là gì nên không thể viết `return 0` hay `return ""`. `var zero T` cho bạn zero value của **bất kỳ** kiểu nào
- **Method không được có type parameter riêng**: bạn viết được `func (s *Set[T]) Has(v T)`, nhưng **không** viết được `func (s *Set[T]) Map[R any](...)`. Muốn biến đổi sang kiểu khác → viết **hàm** thường như `Map[T, R]`
- **Kiểu tham số được suy luận** ở `Filter(orders, ...)`, nhưng ở `NewSet[T]()` (không có tham số) thì phải ghi rõ `NewSet[T]()` hoặc `NewSet[string]()`
- Thư viện chuẩn đã có sẵn rất nhiều: `slices.Max`, `slices.Contains`, `slices.IndexFunc`, `maps.Keys`... **Kiểm tra trước khi tự viết** (xem mục 10)

## 📖 3. Khi nào KHÔNG nên dùng generics?

Generics là công cụ mạnh, nhưng code Go "chuẩn" dùng generics **khá tiết kiệm**. Nguyên tắc từ chính Go team:

> *"Write code, don't design types."* - Hãy viết code cụ thể trước. Chỉ khi bạn thấy mình **copy-paste cùng một logic cho nhiều kiểu**, hãy cân nhắc generics.

| Tình huống | Nên dùng | Lý do |
|------------|----------|-------|
| Cấu trúc dữ liệu chứa "bất kỳ kiểu gì" (stack, set, cache, tree) | ✅ Generics | Đúng mục đích sinh ra của generics |
| Hàm xử lý slice/map/channel của mọi kiểu (`Map`, `merge`) | ✅ Generics | Logic giống hệt nhau, chỉ khác kiểu |
| Chỉ cần **gọi method** của tham số | ❌ **Interface** | `func Save(w io.Writer)` đơn giản hơn `func Save[W io.Writer](w W)` |
| Hành vi **khác nhau** cho từng kiểu | ❌ Interface / type switch | Generics dành cho logic **giống nhau** |
| Chỉ có **một** kiểu dùng thực tế | ❌ Code cụ thể | "Tổng quát hóa sớm" làm code khó đọc |
| Cần xử lý kiểu **lúc chạy** (JSON, ORM, validator) | ❌ Reflection | Generics xử lý lúc **biên dịch** |

```go
// ❌ Generics thừa thãi: chỉ gọi method → interface là đủ
func WriteAll[W io.Writer](w W, data []byte) error {
	_, err := w.Write(data)
	return err
}

// ✅ Đơn giản, rõ ràng, cùng tác dụng
func WriteAll(w io.Writer, data []byte) error {
	_, err := w.Write(data)
	return err
}
```

**Dấu hiệu bạn đang lạm dụng generics**: có hơn 2 type parameter, constraint phức tạp khó đọc, hoặc người review phải đọc lại 3 lần mới hiểu hàm làm gì.

## 📖 4. Iterators (Go 1.23) - `range` trên hàm

### Vấn đề

Trước Go 1.23, `for range` chỉ dùng được với slice, array, map, string, channel và số nguyên. Muốn duyệt **cấu trúc tự viết** (cây, danh sách liên kết, kết quả truy vấn DB theo trang...), bạn phải: (a) trả về một slice (tốn bộ nhớ, phải tính **toàn bộ** trước), hoặc (b) tự đặt ra API riêng (`Next()`, `Each(func)`...) - mỗi thư viện một kiểu.

### Giải pháp: iterator là một hàm

Go 1.23 cho phép `range` trên hàm có dạng đặc biệt, được đặt tên trong package `iter`:

```go
type Seq[V any] func(yield func(V) bool)         // Trả về 1 giá trị mỗi vòng
type Seq2[K, V any] func(yield func(K, V) bool)  // Trả về 2 giá trị mỗi vòng
```

> 💡 **Ví von**: Iterator giống **băng chuyền sushi**. Đầu bếp (iterator) đặt từng đĩa lên băng (`yield(dĩa)`). Khách (vòng `for`) lấy ăn. Khi khách no và nói "**đủ rồi**" (`break`), `yield` trả về `false` → đầu bếp **phải ngừng** làm đĩa mới. Đĩa chỉ được làm **khi cần** (lazy), không làm sẵn 1000 đĩa rồi mới dọn ra.

```go
package main

import (
	"fmt"
	"iter"
	"maps"
	"slices"
	"strings"
)

// Countdown trả về iter.Seq[int] - tức là func(yield func(int) bool)
func Countdown(from int) iter.Seq[int] {
	return func(yield func(int) bool) {
		for i := from; i >= 0; i-- {
			if !yield(i) { // yield trả về false khi vòng for bên ngoài "break"
				return // → PHẢI dừng ngay
			}
		}
	}
}

// Fibonacci: dãy VÔ HẠN, nhưng chỉ tính khi được hỏi (lazy)
func Fibonacci() iter.Seq[int] {
	return func(yield func(int) bool) {
		a, b := 0, 1
		for {
			if !yield(a) {
				return
			}
			a, b = b, a+b
		}
	}
}

// Filter trên iterator: không tạo slice trung gian
func Filter[T any](seq iter.Seq[T], keep func(T) bool) iter.Seq[T] {
	return func(yield func(T) bool) {
		for v := range seq {
			if keep(v) && !yield(v) {
				return
			}
		}
	}
}

// Take: chỉ lấy n phần tử đầu
func Take[T any](seq iter.Seq[T], n int) iter.Seq[T] {
	return func(yield func(T) bool) {
		if n <= 0 {
			return
		}
		count := 0
		for v := range seq {
			if !yield(v) {
				return
			}
			count++
			if count == n {
				return
			}
		}
	}
}

// Lines: iter.Seq2 trả về CẶP giá trị (số dòng, nội dung)
func Lines(text string) iter.Seq2[int, string] {
	return func(yield func(int, string) bool) {
		for i, line := range strings.Split(text, "\n") {
			if !yield(i+1, line) {
				return
			}
		}
	}
}

func main() {
	// 1. range trên hàm
	for n := range Countdown(3) {
		fmt.Print(n, " ")
	}
	fmt.Println("🚀")

	// 2. break giữa chừng → yield trả về false
	for n := range Countdown(100) {
		if n < 98 {
			break
		}
		fmt.Print(n, " ")
	}
	fmt.Println()

	// 3. Ghép iterator như lắp Lego: 5 số Fibonacci chẵn đầu tiên
	evens := Take(Filter(Fibonacci(), func(n int) bool { return n%2 == 0 }), 5)
	fmt.Println(slices.Collect(evens)) // Collect: iterator → slice

	// 4. Seq2
	for no, line := range Lines("package main\n\nfunc main() {}") {
		fmt.Printf("%d| %s\n", no, line)
	}

	// 5. Iterator trong thư viện chuẩn (Go 1.23+)
	prices := map[string]int{"trà": 20, "cà phê": 25, "bánh mì": 15}
	fmt.Println(slices.Sorted(maps.Keys(prices))) // Key đã sắp xếp
	for i, v := range slices.Backward([]string{"a", "b", "c"}) {
		fmt.Print(i, v, " ")
	}
	fmt.Println()
	for part := range strings.SplitSeq("go,rust,zig", ",") { // Go 1.24+
		fmt.Print("[", part, "]")
	}
	fmt.Println()
}

// Output:
// 3 2 1 0 🚀
// 100 99 98
// [0 2 8 34 144]
// 1| package main
// 2|
// 3| func main() {}
// [bánh mì cà phê trà]
// 2c 1b 0a
// [go][rust][zig]
```

**Quy tắc bắt buộc khi viết iterator**:
- Khi `yield` trả về `false` → **return ngay**. Gọi `yield` tiếp sau khi nó đã trả `false` sẽ gây **panic** lúc chạy
- Iterator có thể **vô hạn** (`Fibonacci`) - an toàn vì chỉ tính khi được hỏi
- Ghép iterator (`Take(Filter(...))`) không tạo slice trung gian nào → tiết kiệm bộ nhớ khi dữ liệu lớn

### Iterator trong thư viện chuẩn

| Hàm | Trả về | Công dụng |
|-----|--------|-----------|
| `slices.All(s)` | `Seq2[int, E]` | Chỉ số + phần tử |
| `slices.Values(s)` | `Seq[E]` | Chỉ phần tử |
| `slices.Backward(s)` | `Seq2[int, E]` | Duyệt ngược |
| `slices.Collect(seq)` | `[]E` | Iterator → slice |
| `slices.Sorted(seq)` | `[]E` | Iterator → slice đã sắp xếp |
| `slices.Chunk(s, n)` | `Seq[[]E]` | Chia thành từng lô `n` phần tử |
| `maps.Keys(m)` / `maps.Values(m)` | `Seq[K]` / `Seq[V]` | Key / value của map |
| `maps.All(m)` | `Seq2[K, V]` | Cặp key-value |
| `maps.Collect(seq2)` | `map[K]V` | Iterator → map |
| `strings.SplitSeq`, `strings.Lines`, `strings.FieldsSeq` | `Seq[string]` | Tách chuỗi không tạo slice (Go 1.24+) |

### Pull iterator (biết để đọc hiểu)

Iterator ở trên là kiểu "**push**" (iterator đẩy giá trị cho bạn). Đôi khi bạn cần "**pull**" - tự kéo từng giá trị, ví dụ khi **so sánh hai iterator song song**:

```go
next, stop := iter.Pull(Countdown(3))
defer stop() // ⚠️ Luôn gọi stop để giải phóng tài nguyên
v1, ok1 := next() // 3 true
v2, ok2 := next() // 2 true
```

## 📖 5. Reflection - Nhìn vào kiểu lúc chạy

### Reflection là gì và tại sao cần?

Generics hoạt động lúc **biên dịch**: compiler biết `T` là gì. Nhưng có những thư viện phải làm việc với **bất kỳ struct nào** mà chúng **chưa từng thấy** lúc viết: `encoding/json` (đọc tag `json:"..."`), ORM (tag `db:"..."`), validator, `fmt.Printf("%+v")`. Chúng dùng **reflection** - khả năng chương trình **tự xem xét** kiểu và giá trị lúc **chạy**.

> 💡 **Ví von**: Bình thường bạn cầm một hộp quà và biết ngay bên trong là gì (kiểu tĩnh). Reflection giống **máy chiếu X-quang ở sân bay**: nhận **bất kỳ** hộp nào, soi xem bên trong có những ngăn gì, mỗi ngăn chứa gì, có dán nhãn (tag) gì - thậm chí thay đồ bên trong (nếu hộp không bị niêm phong).

Hai "cửa sổ" chính:
- **`reflect.TypeOf(x)`** → `reflect.Type`: thông tin về **kiểu** (tên, field, tag, method)
- **`reflect.ValueOf(x)`** → `reflect.Value`: thông tin về **giá trị** (đọc, sửa, gọi method)

```go
package main

import (
	"fmt"
	"reflect"
)

type User struct {
	Name     string `json:"name" db:"full_name"`
	Age      int    `json:"age"`
	Email    string `json:"email,omitempty"`
	password string // unexported
}

func (u User) Greet() string { return "Xin chào " + u.Name }

func main() {
	u := User{Name: "Lan", Age: 25, Email: "lan@example.com", password: "123"}

	// 1. TypeOf & ValueOf - hai "cửa sổ" nhìn vào một giá trị
	t := reflect.TypeOf(u)
	v := reflect.ValueOf(u)
	fmt.Println("Type:", t, "| Name:", t.Name(), "| Kind:", t.Kind())

	// Type vs Kind: Type là tên cụ thể, Kind là "loại" nền tảng
	type Celsius float64
	fmt.Println(reflect.TypeOf(Celsius(1)), reflect.TypeOf(Celsius(1)).Kind())
	fmt.Println(reflect.TypeOf([]int{}).Kind(), reflect.TypeOf(map[string]int{}).Kind(), reflect.TypeOf(&u).Kind())

	// 2. Duyệt field và đọc struct tag
	for i := range t.NumField() {
		f := t.Field(i)
		fmt.Printf("%-8s %-6s exported=%-5v json=%q db=%q\n",
			f.Name, f.Type, f.IsExported(), f.Tag.Get("json"), f.Tag.Get("db"))
	}

	// 3. Đọc giá trị của field (chỉ Interface() được với field exported)
	fmt.Println("Name =", v.FieldByName("Name").Interface(), "| Age =", v.Field(1).Int())

	// 4. SỬA giá trị: phải đi qua CON TRỎ và gọi Elem()
	pv := reflect.ValueOf(&u).Elem()
	fmt.Println("v có sửa được?", v.Field(0).CanSet(), "| pv có sửa được?", pv.Field(0).CanSet())
	pv.FieldByName("Age").SetInt(26)
	fmt.Println("Age sau khi sửa:", u.Age)
	fmt.Println("password sửa được?", pv.FieldByName("password").CanSet())

	// 5. Gọi method theo tên
	out := v.MethodByName("Greet").Call(nil)
	fmt.Println(out[0].String())
}

// Output:
// Type: main.User | Name: User | Kind: struct
// main.Celsius float64
// slice map ptr
// Name     string exported=true  json="name" db="full_name"
// Age      int    exported=true  json="age" db=""
// Email    string exported=true  json="email,omitempty" db=""
// password string exported=false json="" db=""
// Name = Lan | Age = 25
// v có sửa được? false | pv có sửa được? true
// Age sau khi sửa: 26
// password sửa được? false
// Xin chào Lan
```

### Type vs Kind

- **Type** là kiểu **cụ thể**: `main.User`, `main.Celsius`, `[]int`
- **Kind** là **loại nền tảng**, chỉ có khoảng 26 giá trị: `Struct`, `Float64`, `Slice`, `Map`, `Pointer`, `String`, `Int`...

Code reflection thường `switch v.Kind()` vì có vô số Type nhưng chỉ có vài Kind.

### Ba "định luật" của reflection

1. **Từ interface → reflection object**: `reflect.ValueOf(x)` nhận `any`
2. **Từ reflection object → interface**: `v.Interface()` trả lại `any` (chỉ với field **exported**)
3. **Muốn sửa, phải "sửa được" (settable)**: `ValueOf(u)` là **bản sao** → không sửa được. Phải truyền **con trỏ** rồi gọi `.Elem()`: `reflect.ValueOf(&u).Elem()`. Field **unexported** thì không bao giờ sửa được

### ⚠️ Cái giá của reflection

- **Chậm**: chậm hơn code thường 10-100 lần. Đừng dùng trong vòng lặp nóng
- **Mất an toàn kiểu**: lỗi mà compiler lẽ ra bắt được sẽ thành **panic lúc chạy** (`v.SetInt` trên field string → panic)
- **Khó đọc**: code reflection dài và khó bảo trì

> 💡 **Châm ngôn Go**: *"Clear is better than clever. Reflection is never clear."* - Dùng reflection khi viết **thư viện/framework** cần xử lý kiểu tùy ý. Trong code ứng dụng thông thường, gần như **không bao giờ** cần.

## 📖 6. Package `time` - Làm việc với thời gian

### Layout "kỳ lạ" của Go: `2006-01-02 15:04:05`

Ngôn ngữ khác dùng `YYYY-MM-DD HH:mm:ss`. Go dùng **một thời điểm mẫu cụ thể**, và bạn viết layout bằng cách **viết thời điểm đó theo định dạng mong muốn**:

```text
Mon Jan 2 15:04:05 MST 2006
 │   │  │  │  │  │   │   │
 │   1  2  3  4  5   │   6     ← Mẹo nhớ: 1 2 3 4 5 6 7 (tháng 1, ngày 2, 3 giờ chiều...)
Thứ                  └── múi giờ (-07:00 là "7")
```

| Thành phần | Layout | Ví dụ |
|------------|--------|-------|
| Năm | `2006` / `06` | 2026 / 26 |
| Tháng | `01` / `1` / `Jan` / `January` | 03 / 3 / Mar / March |
| Ngày | `02` / `2` / `_2` | 05 / 5 / " 5" |
| Giờ (24h) | `15` | 14 |
| Giờ (12h) | `03` / `3` + `PM` | 02 / 2 PM |
| Phút / Giây | `04` / `05` | 07 / 09 |
| Phần nghìn giây | `.000` | .123 |
| Thứ | `Mon` / `Monday` | Thu / Thursday |
| Múi giờ | `MST` / `-07:00` / `Z07:00` | +07 / +07:00 / Z |

> ⚠️ Viết nhầm `2006-02-01` (đảo 01 và 02) sẽ **không báo lỗi** mà cho ra kết quả sai tháng/ngày! Các hằng số có sẵn giúp tránh nhầm: `time.RFC3339`, `time.DateOnly` (`"2006-01-02"`), `time.DateTime` (`"2006-01-02 15:04:05"`), `time.TimeOnly`.

```go
package main

import (
	"fmt"
	"time"
	_ "time/tzdata" // Nhúng dữ liệu múi giờ vào binary (~450KB) → chạy được cả trong container "scratch"
)

func main() {
	// Một thời điểm cố định để Output luôn giống nhau (thực tế dùng time.Now())
	t := time.Date(2026, time.March, 5, 14, 7, 9, 0, time.UTC)

	// ===== 1. Format: dùng "thời điểm mẫu" Mon Jan 2 15:04:05 MST 2006 =====
	fmt.Println(t.Format("2006-01-02"))          // Kiểu ISO
	fmt.Println(t.Format("02/01/2006 15:04:05")) // Kiểu Việt Nam: ngày/tháng/năm
	fmt.Println(t.Format("3:04PM, Mon 2 Jan"))   // Giờ 12h, tên thứ/tháng
	fmt.Println(t.Format(time.RFC3339))          // Chuẩn cho API/JSON

	// ===== 2. Parse: chuỗi → time.Time (cùng layout) =====
	d, err := time.Parse("02/01/2006", "25/12/2026")
	fmt.Println(d.Weekday(), d.YearDay(), err)
	_, err = time.Parse("02/01/2006", "31/02/2026")
	fmt.Println("Lỗi:", err)

	// ===== 3. Múi giờ =====
	hcm, err := time.LoadLocation("Asia/Ho_Chi_Minh")
	if err != nil {
		fmt.Println("Không nạp được múi giờ:", err)
		return
	}
	fmt.Println("Giờ Việt Nam:", t.In(hcm).Format("15:04 MST (-07:00)"))
	tokyo, _ := time.LoadLocation("Asia/Tokyo")
	fmt.Println("Giờ Tokyo:   ", t.In(tokyo).Format("15:04 MST"))
	// Parse chuỗi KHÔNG có múi giờ → mặc định UTC! Dùng ParseInLocation để chỉ rõ
	local, _ := time.ParseInLocation("2006-01-02 15:04", "2026-03-05 09:00", hcm)
	fmt.Println("9h sáng VN =", local.UTC().Format("15:04"), "UTC")

	// ===== 4. Duration & tính toán =====
	deadline := t.Add(36*time.Hour + 30*time.Minute)
	fmt.Println("Hạn chót:", deadline.Format("02/01 15:04"), "| Còn:", deadline.Sub(t))
	fmt.Println("Cộng 1 tháng:", t.AddDate(0, 1, 0).Format("2006-01-02"))
	fmt.Println("Đầu giờ:", t.Truncate(time.Hour).Format("15:04:05"))
	dur, _ := time.ParseDuration("1h15m30s")
	fmt.Println(dur.Minutes(), "phút |", dur.Round(time.Hour))
	fmt.Println("Trước/Sau:", t.Before(deadline), t.After(deadline), t.Equal(t.In(hcm)))

	// ===== 5. Timer: hẹn giờ một lần =====
	timer := time.NewTimer(50 * time.Millisecond)
	<-timer.C
	fmt.Println("⏰ Timer kêu!")

	done := make(chan struct{})
	time.AfterFunc(20*time.Millisecond, func() { // Chạy hàm trong goroutine riêng sau 20ms
		fmt.Println("⏰ AfterFunc chạy!")
		close(done)
	})
	<-done

	stopMe := time.NewTimer(time.Hour)
	fmt.Println("Hủy timer kịp:", stopMe.Stop()) // true: timer chưa kịp kêu
}

// Output:
// 2026-03-05
// 05/03/2026 14:07:09
// 2:07PM, Thu 5 Mar
// 2026-03-05T14:07:09Z
// Friday 359 <nil>
// Lỗi: parsing time "31/02/2026": day out of range
// Giờ Việt Nam: 21:07 +07 (+07:00)
// Giờ Tokyo:    23:07 JST
// 9h sáng VN = 02:00 UTC
// Hạn chót: 07/03 02:37 | Còn: 36h30m0s
// Cộng 1 tháng: 2026-04-05
// Đầu giờ: 14:00:00
// 75.5 phút | 1h0m0s
// Trước/Sau: true false true
// ⏰ Timer kêu!
// ⏰ AfterFunc chạy!
// Hủy timer kịp: true
```

**Những điều quan trọng về `time`**:

- **Luôn lưu trữ và truyền giờ ở UTC** (DB, API). Chỉ chuyển sang giờ địa phương khi **hiển thị** cho người dùng
- `time.Parse` với chuỗi không có múi giờ → hiểu là **UTC**. Người dùng Việt Nam nhập "9:00" → dùng `ParseInLocation(..., hcm)`
- `time.LoadLocation` cần **cơ sở dữ liệu múi giờ** của hệ điều hành. Trong container `scratch`/`distroless` hoặc trên Windows có thể không có → `import _ "time/tzdata"` để nhúng vào binary
- So sánh thời gian bằng `t1.Equal(t2)`, **không dùng `==`** (vì `==` so sánh cả múi giờ và dữ liệu đồng hồ monotonic bên trong)
- Đo thời gian thực thi bằng `time.Since(start)` - Go dùng **đồng hồ monotonic** nên kết quả đúng kể cả khi giờ hệ thống bị chỉnh
- `Duration` thực chất là `int64` **nano giây**: `35*time.Millisecond`, `time.Duration(n) * time.Second` (không viết được `n * time.Second` nếu `n` là `int`)

## 📖 7. `log/slog` - Structured Logging

### Tại sao cần structured logging?

```text
2026/09/25 10:00:00 user 42 đặt đơn 1001 thất bại: timeout          ← log thường (package log)
{"time":"...","level":"ERROR","msg":"đặt đơn thất bại","user_id":42,"order_id":1001,"err":"timeout"}  ← slog JSON
```

Với log thường, muốn tìm "mọi lỗi của user 42" bạn phải viết regex. Với **structured log** (log có cấu trúc), hệ thống như Grafana Loki, Elasticsearch, Datadog có thể **lọc, đếm, vẽ biểu đồ** theo từng field: `user_id = 42 AND level = ERROR`.

> 💡 **Ví von**: Log thường là **ghi chép viết tay** trong sổ - người đọc được, máy khó đọc. Structured log là **bảng Excel** - vừa người đọc được, vừa lọc/sắp xếp/thống kê được.

`log/slog` có sẵn trong thư viện chuẩn từ **Go 1.21** - không cần thư viện ngoài (trước đây phải dùng zap, zerolog, logrus).

```go
package main

import (
	"context"
	"log/slog"
	"os"
	"time"
)

// ===== Handler "bọc" để tự thêm request_id lấy từ context =====

type ctxKey struct{}

// ContextHandler bọc một slog.Handler khác (embedding) và chỉ ghi đè method Handle
type ContextHandler struct {
	slog.Handler
}

func (h ContextHandler) Handle(ctx context.Context, r slog.Record) error {
	if id, ok := ctx.Value(ctxKey{}).(string); ok {
		r.AddAttrs(slog.String("request_id", id))
	}
	return h.Handler.Handle(ctx, r)
}

// ⚠️ PHẢI ghi đè cả WithAttrs/WithGroup, nếu không logger.With(...) sẽ trả về
// handler bên trong (JSONHandler) và "đánh rơi" lớp bọc ContextHandler
func (h ContextHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return ContextHandler{h.Handler.WithAttrs(attrs)}
}

func (h ContextHandler) WithGroup(name string) slog.Handler {
	return ContextHandler{h.Handler.WithGroup(name)}
}

// Bỏ trường time để Output của ví dụ luôn giống nhau (code thật thì GIỮ LẠI time!)
func dropTime(groups []string, a slog.Attr) slog.Attr {
	if a.Key == slog.TimeKey && len(groups) == 0 {
		return slog.Attr{}
	}
	return a
}

func main() {
	// ===== 1. TextHandler: dễ đọc cho người, hợp khi dev =====
	text := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{ReplaceAttr: dropTime}))
	text.Info("server khởi động", "port", 8080, "env", "dev")
	text.Debug("không hiện vì mức mặc định là Info")

	// ===== 2. JSONHandler: dễ đọc cho MÁY (Loki, ELK, Datadog...) - dùng trên production =====
	level := new(slog.LevelVar) // Mức log có thể đổi lúc đang chạy
	level.Set(slog.LevelDebug)
	logger := slog.New(ContextHandler{slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level:       level,
		ReplaceAttr: dropTime,
	})})

	logger.Debug("đang kết nối DB", "host", "localhost")

	// Attr có kiểu → nhanh hơn và an toàn hơn cặp "key", value
	logger.Info("đơn hàng mới",
		slog.Int("order_id", 1001),
		slog.Duration("took", 35*time.Millisecond),
		slog.Group("customer", slog.String("name", "Lan"), slog.Bool("vip", true)),
	)

	// With: logger con luôn mang theo các attr chung
	payLog := logger.With("service", "payment")
	payLog.Warn("thanh toán chậm", "gateway", "momo")

	// Context: request_id tự được thêm bởi ContextHandler
	ctx := context.WithValue(context.Background(), ctxKey{}, "req-7f3a")
	payLog.ErrorContext(ctx, "thanh toán thất bại", "err", "timeout")

	level.Set(slog.LevelWarn) // Tắt bớt log khi đang chạy
	logger.Info("dòng này KHÔNG hiện nữa")

	// slog.SetDefault: các lệnh slog.Info(...) và cả log.Println(...) cũ đều đi qua logger này
	slog.SetDefault(logger)
	slog.Warn("dùng logger mặc định")
}

// Output:
// level=INFO msg="server khởi động" port=8080 env=dev
// {"level":"DEBUG","msg":"đang kết nối DB","host":"localhost"}
// {"level":"INFO","msg":"đơn hàng mới","order_id":1001,"took":35000000,"customer":{"name":"Lan","vip":true}}
// {"level":"WARN","msg":"thanh toán chậm","service":"payment","gateway":"momo"}
// {"level":"ERROR","msg":"thanh toán thất bại","service":"payment","err":"timeout","request_id":"req-7f3a"}
// {"level":"WARN","msg":"dùng logger mặc định"}
```

| Khái niệm | Ý nghĩa |
|-----------|---------|
| **Handler** | "Đầu ra" và "định dạng": `TextHandler` (key=value), `JSONHandler`, hoặc tự viết |
| **Level** | `Debug` < `Info` < `Warn` < `Error`. Log có level thấp hơn ngưỡng sẽ bị bỏ qua |
| **Attr** | Cặp key-value. Dùng `slog.Int`, `slog.String`... thay vì `"key", value` để tránh lỗi lệch cặp |
| **`logger.With(...)`** | Tạo logger con luôn kèm attr chung (service, request_id...) |
| **`slog.Group`** | Gom attr thành object lồng nhau |
| **`...Context(ctx, ...)`** | Truyền `ctx` cho handler - để handler lấy trace ID, request ID |
| **`slog.LevelVar`** | Level có thể **đổi khi đang chạy** (bật Debug để điều tra sự cố mà không restart) |

> ⚠️ **Bẫy khi bọc handler**: nếu bạn nhúng (embed) `slog.Handler` và chỉ ghi đè `Handle`, thì `logger.With(...)` sẽ gọi `WithAttrs` của handler **bên trong** và trả về handler bên trong → **lớp bọc của bạn biến mất**. Luôn ghi đè cả `WithAttrs` và `WithGroup` như ví dụ trên.

Bạn sẽ dùng slog xuyên suốt service production ở [Bài 16](./16-production-ready.md).

## 📖 8. `embed` - Nhúng file vào binary

### Vấn đề

Web server cần file HTML, CSS, template. Deploy lên server bạn phải copy **cả binary lẫn thư mục `static/`, `templates/`**, và chương trình phải tìm đúng đường dẫn. Quên copy một file → lỗi 404 lúc 2 giờ sáng.

### Giải pháp: `//go:embed`

Từ Go 1.16, chỉ thị `//go:embed` **nhúng file vào trong binary lúc build**. Kết quả: **một file thực thi duy nhất** chứa mọi thứ.

> 💡 **Ví von**: Thay vì gửi cho bạn bè **một chiếc máy ảnh + một túi phim rời**, bạn gửi **máy ảnh đã lắp sẵn phim bên trong**. Không thể quên phim, không thể lắp nhầm.

```go
import "embed"

//go:embed hello.txt
var greeting string // Một file → string

//go:embed logo.png
var logo []byte // Một file → []byte

//go:embed static templates/*.html
var files embed.FS // Nhiều file/thư mục → embed.FS (một hệ thống file chỉ đọc)
```

**Quy tắc**:
- Comment `//go:embed` phải nằm **ngay trên** khai báo biến, **không có dấu cách** giữa `//` và `go:embed`
- Biến phải ở **cấp package** (không trong hàm), kiểu `string`, `[]byte` hoặc `embed.FS`
- Đường dẫn **tương đối** với thư mục chứa file `.go`; không được dùng `..`, không được ra ngoài module
- File bắt đầu bằng `.` hoặc `_` bị bỏ qua khi nhúng thư mục (dùng tiền tố `all:` để lấy cả: `//go:embed all:static`)
- Phải `import "embed"` (dùng `_ "embed"` nếu chỉ nhúng vào `string`/`[]byte`)

`embed.FS` thỏa interface `fs.FS` → dùng được với `http.FileServerFS`, `template.ParseFS`, `fs.WalkDir`, `fs.ReadFile`... Xem ví dụ đầy đủ ở **Ứng dụng 3 và 4**.

> 💡 **Mẹo dev**: File nhúng chỉ cập nhật khi **build lại**. Khi đang phát triển giao diện, có thể dùng `os.DirFS("static")` (đọc trực tiếp từ đĩa) thay cho `embed.FS` - cả hai đều là `fs.FS` nên code còn lại không cần đổi.

## 📖 9. `text/template` và `html/template`

Template là "**văn bản có chỗ trống**" - bạn viết khung sẵn, Go điền dữ liệu vào. Dùng để sinh email, báo cáo, file cấu hình, trang HTML, code...

### Cú pháp cơ bản

| Cú pháp | Ý nghĩa |
|---------|---------|
| `{{.}}` | Dữ liệu hiện tại ("dot") |
| `{{.Name}}` | Field `Name` của dữ liệu |
| `{{.Name \| upper}}` | Pipeline: truyền kết quả vào hàm `upper` |
| `{{if .X}}...{{else}}...{{end}}` | Điều kiện (zero value, `nil`, slice rỗng = false) |
| `{{range .Items}}...{{else}}...{{end}}` | Lặp; `{{else}}` chạy khi rỗng. Bên trong, `.` là phần tử hiện tại |
| `{{range $i, $x := .Items}}` | Lặp có biến chỉ số và phần tử |
| `{{with .Warning}}...{{end}}` | Nếu khác rỗng thì chạy, và `.` trở thành giá trị đó |
| `{{$.Max}}` | `$` là dữ liệu **gốc** - dùng khi đang ở trong `range` |
| `{{printf "%.2f" .Price}}` | Gọi hàm có sẵn (`printf`, `len`, `index`, `eq`, `lt`, `and`, `or`, `not`...) |
| `{{- ...}}` / `{{... -}}` | Xóa khoảng trắng/xuống dòng **bên trái** / **bên phải** |
| `{{/* ghi chú */}}` | Comment |

```go
package main

import (
	htmltemplate "html/template"
	"os"
	"strings"
	"text/template"
)

type Item struct {
	Name  string
	Qty   int
	Price int
}

type Invoice struct {
	Customer string
	Items    []Item
	Note     string
}

const invoiceTmpl = `Khách hàng: {{.Customer | upper}}
{{range $i, $it := .Items -}}
{{inc $i}}. {{$it.Name}} x{{$it.Qty}} = {{mul $it.Qty $it.Price}}đ
{{else -}}
(chưa có sản phẩm)
{{end -}}
{{if .Note}}Ghi chú: {{.Note}}{{else}}Không có ghi chú{{end}}
`

func main() {
	// FuncMap: đăng ký hàm tự viết để dùng trong template
	funcs := template.FuncMap{
		"upper": strings.ToUpper,
		"inc":   func(i int) int { return i + 1 },
		"mul":   func(a, b int) int { return a * b },
	}
	// template.Must: panic nếu template sai cú pháp - hợp khi template là hằng số viết sẵn
	t := template.Must(template.New("invoice").Funcs(funcs).Parse(invoiceTmpl))

	inv := Invoice{
		Customer: "Trần Lan",
		Items:    []Item{{"Bàn phím", 1, 890000}, {"Lót chuột", 2, 50000}},
	}
	if err := t.Execute(os.Stdout, inv); err != nil {
		panic(err)
	}
	_ = t.Execute(os.Stdout, Invoice{Customer: "Minh", Note: "Giao buổi sáng"})

	// ===== html/template: TỰ ĐỘNG escape theo ngữ cảnh → chống XSS =====
	comment := `<script>alert("hack")</script>`
	page := `<p title="{{.}}">{{.}}</p><a href="/search?q={{.}}">tìm</a>` + "\n"

	text := template.Must(template.New("t").Parse(page))
	text.Execute(os.Stdout, comment) // ❌ text/template: chèn nguyên văn → XSS!

	safe := htmltemplate.Must(htmltemplate.New("h").Parse(page))
	safe.Execute(os.Stdout, comment) // ✅ html/template: escape khác nhau cho HTML, thuộc tính, URL
}

// Output:
// Khách hàng: TRẦN LAN
// 1. Bàn phím x1 = 890000đ
// 2. Lót chuột x2 = 100000đ
// Không có ghi chú
// Khách hàng: MINH
// (chưa có sản phẩm)
// Ghi chú: Giao buổi sáng
// <p title="<script>alert("hack")</script>"><script>alert("hack")</script></p><a href="/search?q=<script>alert("hack")</script>">tìm</a>
// <p title="&lt;script&gt;alert(&#34;hack&#34;)&lt;/script&gt;">&lt;script&gt;alert(&#34;hack&#34;)&lt;/script&gt;</p><a href="/search?q=%3cscript%3ealert%28%22hack%22%29%3c%2fscript%3e">tìm</a>
```

### Tại sao phải dùng `html/template` cho HTML?

Nhìn 2 dòng cuối của Output:
- `text/template` chèn **nguyên văn** `<script>...` → nếu đây là bình luận của người dùng trên trang web, **mã JavaScript của kẻ tấn công sẽ chạy** trên trình duyệt của mọi người xem (**XSS** - Cross-Site Scripting)
- `html/template` **hiểu ngữ cảnh**: trong nội dung HTML thì escape `<` thành `&lt;`, trong thuộc tính thì escape dấu `"`, trong URL thì mã hóa `%3c`...

> ⚠️ **Quy tắc**: Sinh HTML → **luôn** dùng `html/template`. Hai package có API **giống hệt nhau**, chỉ khác dòng import. Nếu bạn thật sự tin tưởng một đoạn HTML (do chính bạn viết), bọc nó trong kiểu `template.HTML` - nhưng **không bao giờ** làm vậy với dữ liệu người dùng nhập.

## 📖 10. `strings.Builder`, `bytes.Buffer` & bộ ba `slices`/`maps`/`sort`

### Nối chuỗi: tại sao không dùng `+`?

String trong Go **bất biến** (immutable). Mỗi lần `s += "x"` là một lần **cấp phát chuỗi mới** và **copy toàn bộ** nội dung cũ. Nối 10.000 lần → copy hàng chục triệu byte. `strings.Builder` dùng một **bộ đệm có thể lớn dần** và chỉ tạo string **một lần** ở cuối (bạn đã đo điều này bằng benchmark ở [Bài 9](./09-packages-modules-testing.md)).

| | `strings.Builder` | `bytes.Buffer` |
|---|------------------|----------------|
| Mục đích | **Xây** một string | **Đọc và ghi** dữ liệu byte |
| Đọc ra được? | Không (chỉ `String()`) | Có: `Read`, `ReadString`, `ReadByte`... |
| `String()` | Không copy (rất nhanh) | Copy |
| Dùng khi | Ghép chuỗi, sinh văn bản | Xử lý giao thức, làm `io.Reader` cho hàm khác, template output |

### `slices`, `maps` và `sort`

Package `slices` và `maps` (Go 1.21+) là **generics trong thư viện chuẩn** - bạn đã gặp một phần ở [Bài 5](./05-arrays-slices-maps.md). Package `sort` là thế hệ cũ, vẫn gặp nhiều trong code có sẵn.

```go
package main

import (
	"bytes"
	"cmp"
	"fmt"
	"maps"
	"slices"
	"sort"
	"strings"
)

type Student struct {
	Name  string
	Class string
	Score float64
}

func main() {
	// ===== 1. strings.Builder: nối chuỗi hiệu quả =====
	var sb strings.Builder
	sb.Grow(64) // Tùy chọn: cấp phát trước nếu biết kích thước ước lượng
	for i := 1; i <= 3; i++ {
		fmt.Fprintf(&sb, "dòng %d; ", i) // Builder là io.Writer → dùng được với Fprintf
	}
	sb.WriteString("hết")
	fmt.Println(sb.String(), "| len =", sb.Len()) // Len tính theo BYTE, không phải ký tự

	// ===== 2. bytes.Buffer: vừa ĐỌC vừa GHI được, làm việc với []byte =====
	var buf bytes.Buffer
	buf.WriteString("GET / HTTP/1.1\r\n")
	buf.Write([]byte("Host: example.com\r\n"))
	line, _ := buf.ReadString('\n') // Đọc ra khỏi buffer
	fmt.Printf("%q | còn lại %d byte\n", line, buf.Len())

	// ===== 3. slices: sắp xếp nhiều tiêu chí =====
	students := []Student{
		{"Minh", "10A", 8.5}, {"An", "10B", 9.0}, {"Lan", "10A", 9.0},
		{"Bình", "10B", 7.5}, {"Chi", "10A", 8.5},
	}
	// Theo lớp tăng dần, rồi điểm GIẢM dần, rồi tên tăng dần
	slices.SortFunc(students, func(a, b Student) int {
		return cmp.Or(
			cmp.Compare(a.Class, b.Class),
			cmp.Compare(b.Score, a.Score), // Đảo a, b → giảm dần
			strings.Compare(a.Name, b.Name),
		)
	})
	for _, s := range students {
		fmt.Printf("%s %-5s %.1f\n", s.Class, s.Name, s.Score)
	}

	// Tìm kiếm
	i := slices.IndexFunc(students, func(s Student) bool { return s.Score < 8 })
	fmt.Println("Người đầu tiên dưới 8 điểm:", students[i].Name)
	best := slices.MaxFunc(students, func(a, b Student) int { return cmp.Compare(a.Score, b.Score) })
	fmt.Println("Điểm cao nhất (người đầu tiên gặp):", best.Name)

	// ===== 4. Các hàm tiện ích khác của slices =====
	nums := []int{5, 1, 4, 1, 5, 9, 2, 6, 5}
	sorted := slices.Sorted(slices.Values(nums)) // Bản sao đã sắp xếp, nums giữ nguyên
	fmt.Println(sorted, "→ Compact:", slices.Compact(slices.Clone(sorted)))
	pos, found := slices.BinarySearch(sorted, 6) // Chỉ dùng trên slice ĐÃ SẮP XẾP
	fmt.Println("BinarySearch(6):", pos, found)
	fmt.Println("Reverse:", reversed(nums), "| Equal:", slices.Equal([]int{1, 2}, []int{1, 2}))
	for chunk := range slices.Chunk([]int{1, 2, 3, 4, 5}, 2) { // Go 1.23+: chia thành từng lô
		fmt.Print(chunk, " ")
	}
	fmt.Println()

	// ===== 5. maps =====
	stock := map[string]int{"táo": 5, "cam": 0, "chuối": 12}
	for _, k := range slices.Sorted(maps.Keys(stock)) { // Duyệt map theo thứ tự cố định
		fmt.Print(k, "=", stock[k], " ")
	}
	fmt.Println()
	maps.DeleteFunc(stock, func(k string, v int) bool { return v == 0 }) // Xóa hàng hết
	fmt.Println("Còn hàng:", len(stock), "| Clone bằng nhau:", maps.Equal(stock, maps.Clone(stock)))

	// ===== 6. package sort (cũ) - vẫn gặp nhiều trong code cũ =====
	names := []string{"Chi", "An", "Bình"}
	sort.Strings(names)
	fmt.Println(names, sort.SearchInts([]int{10, 20, 30}, 25))
}

func reversed(s []int) []int {
	c := slices.Clone(s) // Reverse sửa TẠI CHỖ → clone trước để giữ bản gốc
	slices.Reverse(c)
	return c
}

// Output:
// dòng 1; dòng 2; dòng 3; hết | len = 32
// "GET / HTTP/1.1\r\n" | còn lại 19 byte
// 10A Lan   9.0
// 10A Chi   8.5
// 10A Minh  8.5
// 10B An    9.0
// 10B Bình  7.5
// Người đầu tiên dưới 8 điểm: Bình
// Điểm cao nhất (người đầu tiên gặp): Lan
// [1 1 2 4 5 5 5 6 9] → Compact: [1 2 4 5 6 9]
// BinarySearch(6): 7 true
// Reverse: [5 6 2 9 5 1 4 1 5] | Equal: true
// [1 2] [3 4] [5]
// cam=0 chuối=12 táo=5
// Còn hàng: 2 | Clone bằng nhau: true
// [An Bình Chi] 2
```

**Mẹo hay**:
- **Sắp xếp nhiều tiêu chí** với `cmp.Or(cmp.Compare(...), cmp.Compare(...))`: `cmp.Or` trả về kết quả khác 0 **đầu tiên** → tiêu chí sau chỉ được xét khi tiêu chí trước **bằng nhau**
- `slices.SortFunc` **không ổn định** (phần tử bằng nhau có thể đổi chỗ). Cần giữ thứ tự ban đầu → `slices.SortStableFunc`
- `slices.Sort`, `Reverse`, `Compact` **sửa tại chỗ**. Muốn giữ bản gốc → `slices.Clone` trước, hoặc dùng `slices.Sorted(slices.Values(s))`
- `slices.BinarySearch` chỉ đúng trên slice **đã sắp xếp** - nhanh O(log n) thay vì O(n)
- Map trong Go duyệt theo **thứ tự ngẫu nhiên** → muốn in ổn định, dùng `slices.Sorted(maps.Keys(m))`
- Code mới: ưu tiên `slices.SortFunc` hơn `sort.Slice` (nhanh hơn, an toàn kiểu hơn)

### 💡 Tips quan trọng

- ✅ Generics cho **cấu trúc dữ liệu** và **thuật toán chung**; interface cho **hành vi**; reflection cho **thư viện xử lý kiểu tùy ý**
- ✅ Hàm trả về tập kết quả lớn hoặc vô hạn → cân nhắc trả về `iter.Seq` thay vì slice
- ✅ Giờ: **lưu UTC, hiển thị giờ địa phương**, `import _ "time/tzdata"` khi build image tối giản
- ✅ Log: JSON handler trên production, `With` để gắn ngữ cảnh, **không log mật khẩu/token**
- ✅ HTML: **luôn** `html/template`
- ✅ Parse template **một lần** lúc khởi động (`template.Must`), không parse lại mỗi request

## 🌍 Ứng dụng thực tế

### Ứng dụng 1: Validator struct dựa trên tag

**Bài toán**: API nhận request đăng ký. Bạn muốn khai báo quy tắc kiểm tra **ngay trên struct** thay vì viết hàng chục dòng `if`:

```go
Username string `json:"username" validate:"required,min=3,max=20"`
```

Đây chính là cách thư viện nổi tiếng `github.com/go-playground/validator` hoạt động. Chúng ta tự viết phiên bản thu nhỏ hỗ trợ: `required`, `min`, `max` (với chuỗi: số **ký tự**; với số: **giá trị**; với slice/map: số **phần tử**), `email`, `oneof`, và struct lồng nhau.

```go
package main

import (
	"errors"
	"fmt"
	"reflect"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"unicode/utf8"
)

// ======================= Phần 1: Thư viện validate =======================

// FieldError mô tả MỘT lỗi của MỘT field
type FieldError struct {
	Field string // Tên field (lấy từ tag json nếu có)
	Rule  string // Quy tắc bị vi phạm, ví dụ "min=3"
	Msg   string
}

func (e FieldError) Error() string { return e.Field + ": " + e.Msg }

// ValidationErrors gom TẤT CẢ lỗi → người dùng sửa một lần, không phải submit nhiều lần
type ValidationErrors []FieldError

func (ve ValidationErrors) Error() string {
	msgs := make([]string, len(ve))
	for i, e := range ve {
		msgs[i] = e.Error()
	}
	return strings.Join(msgs, "; ")
}

var emailRe = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)

// Validate kiểm tra struct (hoặc con trỏ tới struct) theo tag `validate:"..."`
func Validate(v any) error {
	rv := reflect.ValueOf(v)
	if rv.Kind() == reflect.Pointer {
		if rv.IsNil() {
			return errors.New("validate: nil pointer")
		}
		rv = rv.Elem()
	}
	if rv.Kind() != reflect.Struct {
		return fmt.Errorf("validate: cần struct, nhận %s", rv.Kind())
	}
	var errs ValidationErrors
	validateStruct(rv, "", &errs)
	if len(errs) == 0 {
		return nil // ⚠️ Trả nil thật sự, KHÔNG trả ValidationErrors rỗng (xem Bài 7: nil interface)
	}
	return errs
}

func validateStruct(rv reflect.Value, prefix string, errs *ValidationErrors) {
	rt := rv.Type()
	for i := range rt.NumField() {
		field := rt.Field(i)
		if !field.IsExported() {
			continue // Không đọc được field unexported
		}
		fv := rv.Field(i)
		name := prefix + fieldName(field)

		// Struct lồng nhau → kiểm tra đệ quy
		if fv.Kind() == reflect.Struct {
			validateStruct(fv, name+".", errs)
			continue
		}

		tag := field.Tag.Get("validate")
		if tag == "" || tag == "-" {
			continue
		}
		for _, rule := range strings.Split(tag, ",") {
			if msg := checkRule(fv, rule); msg != "" {
				*errs = append(*errs, FieldError{Field: name, Rule: rule, Msg: msg})
				if rule == "required" {
					break // Đã trống thì khỏi kiểm tra min/max/email nữa
				}
			}
		}
	}
}

// fieldName lấy tên từ tag json (`json:"user_name,omitempty"` → "user_name")
func fieldName(f reflect.StructField) string {
	if name, _, _ := strings.Cut(f.Tag.Get("json"), ","); name != "" && name != "-" {
		return name
	}
	return f.Name
}

// checkRule trả về "" nếu hợp lệ, ngược lại trả về thông báo lỗi
func checkRule(fv reflect.Value, rule string) string {
	name, param, _ := strings.Cut(rule, "=") // "min=3" → "min", "3"
	switch name {
	case "required":
		if fv.IsZero() {
			return "không được để trống"
		}
	case "min", "max":
		limit, err := strconv.Atoi(param)
		if err != nil {
			return "tag sai: " + rule
		}
		n, unit := measure(fv)
		if name == "min" && n < limit {
			return fmt.Sprintf("tối thiểu %d%s", limit, unit)
		}
		if name == "max" && n > limit {
			return fmt.Sprintf("tối đa %d%s", limit, unit)
		}
	case "email":
		if fv.Kind() == reflect.String && fv.String() != "" && !emailRe.MatchString(fv.String()) {
			return "email không hợp lệ"
		}
	case "oneof":
		options := strings.Split(param, "|")
		if s := fmt.Sprint(fv.Interface()); !slices.Contains(options, s) {
			return "phải là một trong " + strings.Join(options, ", ")
		}
	default:
		return "quy tắc không hỗ trợ: " + name
	}
	return ""
}

// measure: chuỗi → số ký tự, số → giá trị, slice/map → số phần tử
func measure(fv reflect.Value) (int, string) {
	switch fv.Kind() {
	case reflect.String:
		return utf8.RuneCountInString(fv.String()), " ký tự"
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return int(fv.Int()), ""
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return int(fv.Uint()), ""
	case reflect.Slice, reflect.Map, reflect.Array:
		return fv.Len(), " phần tử"
	}
	return 0, ""
}

// ======================= Phần 2: Sử dụng =======================

type Address struct {
	City string `json:"city" validate:"required"`
}

type SignupRequest struct {
	Username string   `json:"username" validate:"required,min=3,max=20"`
	Email    string   `json:"email" validate:"required,email"`
	Age      int      `json:"age" validate:"min=13,max=120"`
	Role     string   `json:"role" validate:"oneof=user|admin"`
	Tags     []string `json:"tags" validate:"max=3"`
	Address  Address  `json:"address"`
	internal string   // Bị bỏ qua
}

func main() {
	good := SignupRequest{
		Username: "lan_nguyen", Email: "lan@example.com", Age: 25, Role: "user",
		Address: Address{City: "Hà Nội"},
	}
	fmt.Println("Hợp lệ:", Validate(good))

	bad := &SignupRequest{
		Username: "Lý", Email: "lan@", Age: 10, Role: "root",
		Tags: []string{"go", "rust", "zig", "c"},
	}
	err := Validate(bad)

	var verrs ValidationErrors
	if errors.As(err, &verrs) { // Bài 7: lấy ra kiểu lỗi cụ thể
		fmt.Printf("Có %d lỗi:\n", len(verrs))
		for _, e := range verrs {
			fmt.Printf("  - %-12s [%s] %s\n", e.Field, e.Rule, e.Msg)
		}
	}

	fmt.Println(Validate(42))
}

// Output:
// Hợp lệ: <nil>
// Có 6 lỗi:
//   - username     [min=3] tối thiểu 3 ký tự
//   - email        [email] email không hợp lệ
//   - age          [min=13] tối thiểu 13
//   - role         [oneof=user|admin] phải là một trong user, admin
//   - tags         [max=3] tối đa 3 phần tử
//   - address.city [required] không được để trống
// validate: cần struct, nhận int
```

**Điểm thiết kế**:

- **Gom tất cả lỗi** thay vì dừng ở lỗi đầu tiên → form đăng ký hiện hết lỗi một lượt, người dùng không phải bấm "Gửi" 6 lần
- `ValidationErrors` là kiểu lỗi riêng → handler HTTP dùng `errors.As` để trả về **400** kèm danh sách lỗi dạng JSON, còn các lỗi khác (ví dụ truyền sai kiểu) là lỗi lập trình → **500**
- **Tên field lấy từ tag `json`** → thông báo lỗi khớp với tên field mà client gửi lên (`username`, không phải `Username`)
- `required` thất bại thì **bỏ qua** các quy tắc còn lại của field đó - tránh báo "trống" rồi lại báo "quá ngắn"
- `Validate` trả về **`nil` thật sự** khi hợp lệ. Nếu trả về `ValidationErrors(nil)` thì `err != nil` sẽ là `true` - cái bẫy "nil interface" đã học ở [Bài 7](./07-error-handling.md)
- 💡 Trong production, thư viện thật **cache** kết quả phân tích tag theo `reflect.Type` (dùng `sync.Map`) để không phải phân tích lại mỗi request

### Ứng dụng 2: LRU cache generic

**Bài toán**: Cache hồ sơ người dùng trong RAM, nhưng RAM có hạn → chỉ giữ tối đa N mục. Khi đầy, xóa mục **lâu nhất chưa được dùng** (Least Recently Used). Đây là chiến lược cache phổ biến nhất - CPU cache, trình duyệt, Redis (`allkeys-lru`) đều dùng.

> 💡 **Ví von**: **Tủ quần áo nhỏ** chỉ treo được 3 bộ. Mỗi lần mặc bộ nào, bạn treo nó lên **đầu** tủ. Mua bộ mới mà tủ đầy → bỏ bộ ở **cuối** tủ (bộ lâu nhất không mặc).

**Cấu trúc dữ liệu**: **map** (tìm theo key trong O(1)) + **danh sách liên kết đôi** (di chuyển lên đầu / xóa cuối trong O(1)). Cả `Get` và `Put` đều O(1).

📄 **`lru.go`**

```go
package main

import (
	"iter"
	"sync"
)

// node là một mắt xích trong danh sách liên kết đôi
type node[K comparable, V any] struct {
	key        K
	value      V
	prev, next *node[K, V]
}

// LRU (Least Recently Used): khi đầy, xóa phần tử LÂU NHẤT không được dùng.
//
//	head (mới dùng nhất) ⇄ ... ⇄ tail (lâu nhất chưa dùng)
type LRU[K comparable, V any] struct {
	mu       sync.Mutex
	capacity int
	items    map[K]*node[K, V] // Tìm node trong O(1)
	head     *node[K, V]
	tail     *node[K, V]
	onEvict  func(K, V) // Callback tùy chọn khi một phần tử bị đẩy ra
}

func NewLRU[K comparable, V any](capacity int, onEvict func(K, V)) *LRU[K, V] {
	if capacity <= 0 {
		panic("lru: capacity phải > 0")
	}
	return &LRU[K, V]{capacity: capacity, items: make(map[K]*node[K, V], capacity), onEvict: onEvict}
}

// Get trả về giá trị và đánh dấu key là "vừa được dùng"
func (c *LRU[K, V]) Get(key K) (V, bool) {
	c.mu.Lock() // Lock (không phải RLock) vì Get cũng SỬA danh sách
	defer c.mu.Unlock()
	n, ok := c.items[key]
	if !ok {
		var zero V
		return zero, false
	}
	c.moveToFront(n)
	return n.value, true
}

// Put thêm hoặc cập nhật; nếu vượt capacity thì xóa phần tử ở cuối
func (c *LRU[K, V]) Put(key K, value V) {
	c.mu.Lock()
	var evicted *node[K, V]
	if n, ok := c.items[key]; ok {
		n.value = value
		c.moveToFront(n)
	} else {
		n := &node[K, V]{key: key, value: value}
		c.items[key] = n
		c.pushFront(n)
		if len(c.items) > c.capacity {
			evicted = c.tail
			c.unlink(evicted)
			delete(c.items, evicted.key)
		}
	}
	c.mu.Unlock()

	// Gọi callback NGOÀI khóa: callback có thể chậm hoặc gọi lại cache → tránh deadlock
	if evicted != nil && c.onEvict != nil {
		c.onEvict(evicted.key, evicted.value)
	}
}

func (c *LRU[K, V]) Len() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.items)
}

// All duyệt từ mới dùng nhất → cũ nhất (iterator Go 1.23). Chụp "ảnh" dữ liệu
// trước khi yield để không giữ khóa trong lúc code bên ngoài chạy.
func (c *LRU[K, V]) All() iter.Seq2[K, V] {
	return func(yield func(K, V) bool) {
		c.mu.Lock()
		type kv struct {
			k K
			v V
		}
		snapshot := make([]kv, 0, len(c.items))
		for n := c.head; n != nil; n = n.next {
			snapshot = append(snapshot, kv{n.key, n.value})
		}
		c.mu.Unlock()

		for _, e := range snapshot {
			if !yield(e.k, e.v) {
				return
			}
		}
	}
}

// ----- Các thao tác trên danh sách liên kết (gọi khi ĐANG giữ khóa) -----

func (c *LRU[K, V]) pushFront(n *node[K, V]) {
	n.prev, n.next = nil, c.head
	if c.head != nil {
		c.head.prev = n
	}
	c.head = n
	if c.tail == nil {
		c.tail = n
	}
}

func (c *LRU[K, V]) unlink(n *node[K, V]) {
	if n.prev != nil {
		n.prev.next = n.next
	} else {
		c.head = n.next
	}
	if n.next != nil {
		n.next.prev = n.prev
	} else {
		c.tail = n.prev
	}
	n.prev, n.next = nil, nil
}

func (c *LRU[K, V]) moveToFront(n *node[K, V]) {
	if c.head == n {
		return
	}
	c.unlink(n)
	c.pushFront(n)
}
```

📄 **`main.go`**

```go
package main

import "fmt"

type Profile struct {
	Name  string
	Posts int
}

func main() {
	cache := NewLRU(3, func(k int, v Profile) {
		fmt.Printf("  🗑️  đẩy ra: user %d (%s)\n", k, v.Name)
	})

	cache.Put(1, Profile{"An", 10})
	cache.Put(2, Profile{"Bình", 3})
	cache.Put(3, Profile{"Chi", 7})

	cache.Get(1) // User 1 vừa được dùng → không bị xóa
	fmt.Println("Thêm user 4:")
	cache.Put(4, Profile{"Dũng", 1}) // Đầy → xóa user 2 (lâu nhất chưa dùng)

	_, ok := cache.Get(2)
	fmt.Println("Còn user 2?", ok)

	fmt.Println("Từ mới → cũ:")
	for id, p := range cache.All() {
		fmt.Printf("  %d: %s\n", id, p.Name)
	}

	// Cùng một kiểu LRU, dùng với kiểu khác - đây là sức mạnh của generics
	pages := NewLRU[string, []byte](2, nil)
	pages.Put("/home", []byte("<h1>Home</h1>"))
	html, _ := pages.Get("/home")
	fmt.Println(string(html), pages.Len())
}

// Output:
// Thêm user 4:
//   🗑️  đẩy ra: user 2 (Bình)
// Còn user 2? false
// Từ mới → cũ:
//   4: Dũng
//   1: An
//   3: Chi
// <h1>Home</h1> 1
```

📄 **`lru_test.go`**

```go
package main

import (
	"maps"
	"sync"
	"testing"
)

func TestLRU_Eviction(t *testing.T) {
	var evicted []string
	c := NewLRU(2, func(k string, _ int) { evicted = append(evicted, k) })

	c.Put("a", 1)
	c.Put("b", 2)
	c.Get("a")     // a mới dùng → b là "cũ nhất"
	c.Put("c", 3)  // → xóa b
	c.Put("a", 10) // Cập nhật, không xóa gì

	if len(evicted) != 1 || evicted[0] != "b" {
		t.Fatalf("evicted = %v; muốn [b]", evicted)
	}
	got := maps.Collect(c.All())
	want := map[string]int{"a": 10, "c": 3}
	if !maps.Equal(got, want) {
		t.Fatalf("nội dung = %v; muốn %v", got, want)
	}
}

func TestLRU_Concurrent(t *testing.T) {
	c := NewLRU[int, int](50, nil)
	var wg sync.WaitGroup
	for g := range 8 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := range 1000 {
				c.Put((g*1000+i)%100, i)
				c.Get(i % 100)
			}
		}()
	}
	wg.Wait()
	if c.Len() != 50 {
		t.Fatalf("Len = %d; muốn 50", c.Len())
	}
}
```

```bash
go test -race -v .
```

```text
=== RUN   TestLRU_Eviction
--- PASS: TestLRU_Eviction (0.00s)
=== RUN   TestLRU_Concurrent
--- PASS: TestLRU_Concurrent (0.02s)
PASS
ok  	example	1.030s
```

**Điểm thiết kế**:

- **Kiểu generic lồng nhau**: `node[K, V]` và `LRU[K, V]` - các kiểu generic có thể tham chiếu lẫn nhau
- `Get` dùng `Lock` chứ **không phải `RLock`** - vì `Get` **sửa** danh sách (đưa lên đầu). Đây là lỗi rất hay gặp khi viết LRU!
- **Callback `onEvict` được gọi NGOÀI khóa** - nếu callback chậm (ghi log, ghi đĩa) hoặc gọi lại `cache.Put`, gọi trong khóa sẽ làm chậm mọi người hoặc **deadlock**
- `All()` trả về **iterator** (`iter.Seq2`) - người dùng duyệt bằng `for k, v := range cache.All()`, và `maps.Collect(c.All())` hoạt động ngay nhờ chuẩn chung của Go 1.23. Iterator **chụp ảnh** dữ liệu trước khi `yield` để không giữ khóa trong lúc code của người gọi chạy
- 💡 Thư viện chuẩn có `container/list` (danh sách liên kết đôi) nhưng **không generic** (dùng `any`). Tự viết bản generic giúp an toàn kiểu và luyện tập con trỏ. Trong production, `github.com/hashicorp/golang-lru/v2` là lựa chọn phổ biến

### Ứng dụng 3: Tạo email báo cáo bằng template

**Bài toán**: Mỗi sáng thứ Hai, hệ thống gửi email báo cáo doanh thu tuần cho quản lý. Email cần **tiêu đề**, **bản text** (cho ứng dụng email không hiển thị HTML) và **bản HTML**. Template được **tách ra file riêng** để người không biết Go cũng sửa được nội dung, và được **nhúng vào binary** bằng `embed`.

Cấu trúc thư mục:

```text
report/
├── go.mod
├── main.go
└── templates/
    ├── subject.tmpl
    ├── body.txt.tmpl
    └── body.html.tmpl
```

📄 **`templates/subject.tmpl`**

```text
[Báo cáo] Doanh thu tuần {{.Week}} - {{vnd .Total}}{{if .Warning}} ⚠️{{end}}
```

📄 **`templates/body.txt.tmpl`**

```text
Chào {{.Manager}},

Doanh thu tuần {{.Week}} ({{date .From}} - {{date .To}}):
{{- range .Days}}
  {{printf "%-10s" .Day}} {{printf "%12s" (vnd .Revenue)}} {{bar .Revenue $.Max}}
{{- end}}

Tổng: {{vnd .Total}} ({{pct .Growth}} so với tuần trước)
{{with .Warning}}
⚠️ Lưu ý: {{.}}
{{end}}
Trân trọng,
Hệ thống báo cáo tự động
```

📄 **`templates/body.html.tmpl`**

```html
<h2>Doanh thu tuần {{.Week}}</h2>
<p>Chào {{.Manager}},</p>
<table>
  {{- range .Days}}
  <tr><td>{{.Day}}</td><td style="text-align:right">{{vnd .Revenue}}</td></tr>
  {{- end}}
  <tr><th>Tổng</th><th>{{vnd .Total}}</th></tr>
</table>
{{with .Warning}}<p style="color:red">⚠️ {{.}}</p>{{end}}
```

📄 **`main.go`**

```go
package main

import (
	"bytes"
	"embed"
	"fmt"
	htmltemplate "html/template"
	"os"
	"strconv"
	"strings"
	"text/template"
	"time"
)

//go:embed templates/*.tmpl
var templateFS embed.FS // Template được NHÚNG vào binary lúc build

type DayRevenue struct {
	Day     string
	Revenue int64
}

type Report struct {
	Manager  string
	Week     int
	From, To time.Time
	Days     []DayRevenue
	Total    int64
	Max      int64
	Growth   float64
	Warning  string
}

// vnd định dạng số tiền kiểu Việt Nam: 1234567 → "1.234.567đ"
func vnd(n int64) string {
	s := strconv.FormatInt(n, 10)
	var b strings.Builder
	for i, ch := range s {
		if i > 0 && (len(s)-i)%3 == 0 {
			b.WriteByte('.')
		}
		b.WriteRune(ch)
	}
	return b.String() + "đ"
}

// Các hàm dùng chung cho cả text/template và html/template
var funcs = map[string]any{
	"vnd":  vnd,
	"date": func(t time.Time) string { return t.Format("02/01") },
	"pct":  func(f float64) string { return fmt.Sprintf("%+.1f%%", f*100) },
	"bar": func(v, maxV int64) string { // Biểu đồ cột bằng ký tự
		return strings.Repeat("█", int(v*20/maxV))
	},
}

func buildReport(manager string, week int, from time.Time, revenues []int64, lastWeek int64) Report {
	names := []string{"Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"}
	r := Report{Manager: manager, Week: week, From: from, To: from.AddDate(0, 0, 6)}
	for i, rev := range revenues {
		r.Days = append(r.Days, DayRevenue{names[i], rev})
		r.Total += rev
		r.Max = max(r.Max, rev)
	}
	r.Growth = float64(r.Total-lastWeek) / float64(lastWeek)
	if r.Growth < -0.1 {
		r.Warning = "doanh thu giảm hơn 10%, cần xem lại chiến dịch quảng cáo"
	}
	return r
}

func main() {
	// Parse template từ embed.FS - chỉ làm MỘT LẦN lúc khởi động
	subjectT := template.Must(template.New("subject.tmpl").Funcs(funcs).ParseFS(templateFS, "templates/subject.tmpl"))
	textT := template.Must(template.New("body.txt.tmpl").Funcs(funcs).ParseFS(templateFS, "templates/body.txt.tmpl"))
	htmlT := htmltemplate.Must(htmltemplate.New("body.html.tmpl").Funcs(funcs).ParseFS(templateFS, "templates/body.html.tmpl"))

	monday := time.Date(2026, 9, 14, 0, 0, 0, 0, time.UTC)
	report := buildReport("chị Hoa", 38, monday,
		[]int64{12_500_000, 9_800_000, 15_200_000, 11_000_000, 18_750_000, 22_300_000, 6_400_000},
		107_000_000)

	var subject, text, html bytes.Buffer
	for _, job := range []struct {
		name string
		exec func() error
	}{
		{"subject", func() error { return subjectT.Execute(&subject, report) }},
		{"text", func() error { return textT.Execute(&text, report) }},
		{"html", func() error { return htmlT.Execute(&html, report) }},
	} {
		if err := job.exec(); err != nil {
			fmt.Fprintf(os.Stderr, "lỗi render %s: %v\n", job.name, err)
			os.Exit(1)
		}
	}

	fmt.Print("Tiêu đề: ", subject.String())
	fmt.Println("---")
	fmt.Print(text.String())
	fmt.Println("---")
	fmt.Printf("Bản HTML: %d byte, có <table>: %v\n", html.Len(), strings.Contains(html.String(), "<table>"))
}

// Output:
// Tiêu đề: [Báo cáo] Doanh thu tuần 38 - 95.950.000đ ⚠️
// ---
// Chào chị Hoa,
//
// Doanh thu tuần 38 (14/09 - 20/09):
//   Thứ Hai     12.500.000đ ███████████
//   Thứ Ba       9.800.000đ ████████
//   Thứ Tư      15.200.000đ █████████████
//   Thứ Năm     11.000.000đ █████████
//   Thứ Sáu     18.750.000đ ████████████████
//   Thứ Bảy     22.300.000đ ████████████████████
//   Chủ Nhật     6.400.000đ █████
//
// Tổng: 95.950.000đ (-10.3% so với tuần trước)
//
// ⚠️ Lưu ý: doanh thu giảm hơn 10%, cần xem lại chiến dịch quảng cáo
//
// Trân trọng,
// Hệ thống báo cáo tự động
// ---
// Bản HTML: 757 byte, có <table>: true
```

**Giải thích**:

- **Cùng một `funcs` map** dùng cho cả `text/template` và `html/template` (kiểu `map[string]any` gán được cho cả `template.FuncMap` của hai package)
- `ParseFS(templateFS, "templates/...")` đọc template từ `embed.FS`. Tên template (`New("body.txt.tmpl")`) phải **trùng tên file** để `Execute` tìm đúng template
- `{{- range .Days}}` và `{{- end}}`: dấu `-` xóa dòng trống thừa → email gọn gàng. Đây là phần mất thời gian nhất khi viết template văn bản - hãy thử bỏ dấu `-` để thấy sự khác biệt
- `{{bar .Revenue $.Max}}`: bên trong `range`, `.` là `DayRevenue`, nên phải dùng `$.Max` để lấy field của dữ liệu **gốc**
- `{{with .Warning}}`: chỉ hiện đoạn cảnh báo khi có cảnh báo
- Render vào `bytes.Buffer` **trước**, chỉ gửi khi **cả 3 phần đều thành công** - tránh gửi email bị cắt nửa chừng
- 💡 Để gửi email thật, dùng `net/smtp` (thư viện chuẩn) hoặc API của dịch vụ như SendGrid/Amazon SES, với nội dung `multipart/alternative` gồm cả bản text và HTML

### Ứng dụng 4: Web server nhúng file tĩnh bằng `embed`

**Bài toán**: Một web app nhỏ (trang giới thiệu, dashboard nội bộ, tài liệu...) cần phục vụ HTML/CSS và vài trang động. Yêu cầu: deploy bằng **một file binary duy nhất**.

Cấu trúc thư mục:

```text
embedserver/
├── go.mod
├── main.go
├── main_test.go
├── static/
│   ├── index.html
│   └── css/
│       └── style.css
└── templates/
    └── hello.html
```

📄 **`static/index.html`**

```html
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>Go Embed Demo</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <h1>🐹 Xin chào từ file nhúng!</h1>
  <p>Thử trang động: <a href="/hello/Lan">/hello/Lan</a></p>
</body>
</html>
```

📄 **`static/css/style.css`**

```css
body { font-family: sans-serif; max-width: 640px; margin: 40px auto; color: #222; }
h1 { color: #00add8; }
```

📄 **`templates/hello.html`**

```html
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="utf-8"><title>Chào {{.Name}}</title><link rel="stylesheet" href="/css/style.css"></head>
<body>
  <h1>Xin chào, {{.Name}}! 👋</h1>
  <p>Server phiên bản {{.Version}}, render lúc {{.Now.Format "15:04:05"}}</p>
</body>
</html>
```

📄 **`main.go`**

```go
package main

import (
	"embed"
	"flag"
	"html/template"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"time"
)

// Nhúng CẢ THƯ MỤC static (kể cả thư mục con) và các file template.
// Đường dẫn tính từ thư mục chứa file .go này; không dùng được ".." để ra ngoài.
//
//go:embed static
var staticFiles embed.FS

//go:embed templates/*.html
var templateFiles embed.FS

// Nhúng một file đơn lẻ vào string (hoặc []byte)
//
//go:embed static/css/style.css
var styleCSS string

const version = "1.0.0"

// newServer tạo handler - tách riêng khỏi main để test được bằng httptest
func newServer() (http.Handler, error) {
	tmpl, err := template.ParseFS(templateFiles, "templates/*.html")
	if err != nil {
		return nil, err
	}

	// fs.Sub "cắt" tiền tố "static/" → URL /css/style.css ánh xạ tới static/css/style.css
	staticRoot, err := fs.Sub(staticFiles, "static")
	if err != nil {
		return nil, err
	}

	mux := http.NewServeMux()
	mux.Handle("GET /", http.FileServerFS(staticRoot)) // Go 1.22+: phục vụ file từ fs.FS

	mux.HandleFunc("GET /hello/{name}", func(w http.ResponseWriter, r *http.Request) {
		data := struct {
			Name    string
			Version string
			Now     time.Time
		}{r.PathValue("name"), version, time.Now()}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		if err := tmpl.ExecuteTemplate(w, "hello.html", data); err != nil {
			slog.Error("render template", "err", err)
		}
	})

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})
	return mux, nil
}

func main() {
	addr := flag.String("addr", ":8080", "địa chỉ lắng nghe")
	flag.Parse()

	handler, err := newServer()
	if err != nil {
		slog.Error("khởi tạo server", "err", err)
		os.Exit(1)
	}

	slog.Info("server đang chạy", "addr", *addr, "css_bytes", len(styleCSS))
	srv := &http.Server{
		Addr:              *addr,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
	}
	if err := srv.ListenAndServe(); err != nil {
		slog.Error("server dừng", "err", err)
		os.Exit(1)
	}
}
```

📄 **`main_test.go`** - kiểm thử mà không cần mở cổng thật

```go
package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestEmbeddedServer(t *testing.T) {
	h, err := newServer()
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(h)
	defer srv.Close()

	tests := []struct {
		path, wantType, wantBody string
		wantStatus               int
	}{
		{"/", "text/html", "Xin chào từ file nhúng", 200},
		{"/css/style.css", "text/css", "#00add8", 200},
		{"/hello/Lan", "text/html", "Xin chào, Lan!", 200},
		{"/hello/%3Cb%3E", "text/html", "&lt;b&gt;", 200}, // html/template tự escape
		{"/khong-ton-tai.txt", "text/plain", "404 page not found", 404},
	}
	for _, tc := range tests {
		t.Run(tc.path, func(t *testing.T) {
			resp, err := http.Get(srv.URL + tc.path)
			if err != nil {
				t.Fatal(err)
			}
			defer resp.Body.Close()
			body, _ := io.ReadAll(resp.Body)

			if resp.StatusCode != tc.wantStatus {
				t.Errorf("status = %d; muốn %d", resp.StatusCode, tc.wantStatus)
			}
			if ct := resp.Header.Get("Content-Type"); !strings.HasPrefix(ct, tc.wantType) {
				t.Errorf("Content-Type = %q; muốn bắt đầu bằng %q", ct, tc.wantType)
			}
			if !strings.Contains(string(body), tc.wantBody) {
				t.Errorf("body không chứa %q:\n%s", tc.wantBody, body)
			}
		})
	}
}
```

Chạy thử:

```bash
go test -v .
go build -o site .
cd /tmp && ./đường-dẫn-tới/site -addr :8080   # Chạy từ THƯ MỤC KHÁC vẫn hoạt động!
```

```bash
curl -i http://localhost:8080/hello/Lan
```

```text
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Content-Length: 250

<!DOCTYPE html>
<html lang="vi">
<head><meta charset="utf-8"><title>Chào Lan</title><link rel="stylesheet" href="/css/style.css"></head>
<body>
  <h1>Xin chào, Lan! 👋</h1>
  <p>Server phiên bản 1.0.0, render lúc 05:43:15</p>
</body>
```

**Điểm thiết kế**:

- **Chạy từ thư mục khác vẫn hoạt động** - đây là bằng chứng file đã nằm **trong** binary. Không còn lỗi "không tìm thấy templates/..." khi deploy
- `fs.Sub(staticFiles, "static")` "cắt" tiền tố để URL `/css/style.css` không phải viết thành `/static/css/style.css`
- `http.FileServerFS` (Go 1.22+) phục vụ file từ `fs.FS`, tự đặt `Content-Type` theo đuôi file, hỗ trợ `Range` request, và tự trả `index.html` cho `/`
- **Tách `newServer()` khỏi `main()`** → test gọi thẳng `newServer()` với `httptest` - không cần mở cổng, không cần trình duyệt. Pattern này sẽ được dùng lại ở [Bài 16](./16-production-ready.md)
- Test case `/hello/%3Cb%3E` chứng minh `html/template` **tự escape** dữ liệu từ URL
- `ReadHeaderTimeout` trên `http.Server` chống tấn công Slowloris (xem [Bài 16](./16-production-ready.md))

## ⚠️ Lỗi thường gặp

### Lỗi 1: Thiếu `~` trong constraint

```go
type Number interface{ int | float64 }
type Celsius float64
Sum[Celsius](1, 2) // ❌ Celsius does not satisfy Number (possibly missing ~ for float64 in Number)
```

✅ `type Number interface{ ~int | ~float64 }`. Compiler còn gợi ý luôn "possibly missing ~".

### Lỗi 2: Cố viết method có type parameter riêng

```go
func (s *Set[T]) Map[R any](f func(T) R) *Set[R] // ❌ syntax error: method must have no type parameters
```

✅ Viết thành hàm: `func MapSet[T, R comparable](s *Set[T], f func(T) R) *Set[R]`.

### Lỗi 3: Iterator gọi `yield` sau khi nó trả `false`

```go
func Bad(yield func(int) bool) {
	yield(1) // ❌ Bỏ qua giá trị trả về
	yield(2) // Nếu vòng for đã break → panic: runtime error: range function continued iteration after function for loop body returned false
}
```

✅ Luôn `if !yield(v) { return }`.

### Lỗi 4: Reflection sửa giá trị không qua con trỏ

```go
v := reflect.ValueOf(user)
v.Field(0).SetString("x") // ❌ panic: reflect: reflect.Value.SetString using unaddressable value
```

✅ `reflect.ValueOf(&user).Elem().Field(0).SetString("x")`. Kiểm tra trước bằng `CanSet()`.

### Lỗi 5: Layout thời gian sai

```go
t.Format("YYYY-MM-DD")  // ❌ In ra nguyên văn "YYYY-MM-DD"
t.Format("2006-02-01")  // ❌ Đảo tháng và ngày - không báo lỗi!
t.Format("2006-01-02")  // ✅ hoặc time.DateOnly
```

### Lỗi 6: So sánh `time.Time` bằng `==`

```go
t1 := time.Now()
t2 := t1.In(hcm)
fmt.Println(t1 == t2)     // false - khác múi giờ bên trong
fmt.Println(t1.Equal(t2)) // true ✅ cùng một thời điểm
```

Tương tự, đừng dùng `time.Time` làm **key của map** - hãy dùng `t.Unix()` hoặc `t.UTC()` đã chuẩn hóa.

### Lỗi 7: Lệch cặp key-value trong slog

```go
slog.Info("đăng nhập", "user_id", 42, "ip") // ❌ Thiếu value → in ra "!BADKEY=ip"
slog.Info("đăng nhập", slog.Int("user_id", 42), slog.String("ip", ip)) // ✅
```

`go vet` có kiểm tra `slog` và sẽ cảnh báo trường hợp này.

### Lỗi 8: Dùng `text/template` để sinh HTML

Như đã thấy ở mục 9 - lỗ hổng **XSS**. ✅ `html/template`.

### Lỗi 9: Sai cú pháp `//go:embed`

```go
// go:embed static   ❌ Có dấu cách → chỉ là comment thường, biến rỗng, không báo lỗi!
//go:embed ../assets ❌ pattern ../assets: invalid pattern syntax - không được ra ngoài thư mục
//go:embed static    ✅
```

### Lỗi 10: `slices.Sort` rồi dùng bản gốc

```go
sorted := original
slices.Sort(sorted) // ❌ Slice dùng chung mảng nền → original CŨNG bị sắp xếp
sorted := slices.Sorted(slices.Values(original)) // ✅ hoặc slices.Clone rồi Sort
```

## 🏋️ Bài tập

### Bài tập 1: Hàm generic tiện ích (⭐ Dễ)

Viết và test (table-driven) các hàm: `Uniq[T comparable](s []T) []T` (giữ thứ tự xuất hiện đầu tiên), `Partition[T any](s []T, pred func(T) bool) (yes, no []T)`, `SumBy[T any, N Number](s []T, f func(T) N) N`. Thử `SumBy` với `[]Order` để tính tổng tiền.

### Bài tập 2: Định dạng thời gian thân thiện (⭐ Dễ)

Viết `HumanizeSince(t, now time.Time) string` trả về "vừa xong" (< 1 phút), "5 phút trước", "3 giờ trước", "hôm qua", "4 ngày trước", và ngày dạng `02/01/2006` nếu quá 7 ngày. Nhận `now` làm tham số để test được (không gọi `time.Now()` bên trong - kỹ thuật này gọi là **dependency injection**, sẽ học kỹ ở Bài 16).

### Bài tập 3: Iterator cho cây nhị phân (⭐⭐ Trung bình)

Viết `Tree[T cmp.Ordered]` (cây nhị phân tìm kiếm) với `Insert(v T)` và `All() iter.Seq[T]` duyệt **theo thứ tự tăng dần** (in-order). Kiểm tra: `break` giữa chừng không panic; `slices.Collect(tree.All())` cho slice đã sắp xếp.

### Bài tập 4: Mở rộng validator (⭐⭐ Trung bình)

Thêm vào validator ở Ứng dụng 1:
- Quy tắc `url` (dùng `net/url.ParseRequestURI`) và `regex=...`
- Hỗ trợ field là **con trỏ** (`*string`: `nil` thì `required` thất bại, khác `nil` thì kiểm tra giá trị bên trong)
- Hỗ trợ **slice các struct** (kiểm tra từng phần tử, tên lỗi dạng `items[2].name`)
- Viết HTTP handler trả về `400` với JSON `{"errors": {"username": "tối thiểu 3 ký tự", ...}}`

### Bài tập 5: LRU có TTL và thống kê (⭐⭐⭐ Khó)

Kết hợp LRU (bài này) với TTL cache ([Bài 14](./14-advanced-concurrency.md)):
- Mỗi mục có thời gian hết hạn; `Get` mục hết hạn → trả về không có và xóa luôn
- Thêm `Stats()` trả về số hit, miss, eviction (dùng `atomic`)
- Viết benchmark so sánh LRU của bạn với `map` + `sync.Mutex` thuần; chạy `go test -race`

### Bài tập 6: Trình sinh trang tĩnh mini (⭐⭐⭐ Khó)

Viết CLI tool đọc thư mục `posts/*.md` (mỗi file có dòng đầu là tiêu đề, dòng 2 là ngày `2006-01-02`), sinh ra thư mục `public/` gồm `index.html` (danh sách bài, **mới nhất trước**) và một trang HTML cho mỗi bài, dùng `html/template` với layout chung được **nhúng** bằng `embed`. Log tiến trình bằng `slog`. Thêm cờ `-serve` để chạy web server xem trước bằng `http.FileServerFS(os.DirFS("public"))`.

## ✅ Checklist hoàn thành

- [ ] Viết constraint với `|`, `~`, method; hiểu `comparable` và `cmp.Ordered`
- [ ] Viết kiểu generic (`Set[T]`, `LRU[K, V]`) và hàm generic (`Map`, `Filter`, `Reduce`, `GroupBy`)
- [ ] Giải thích được khi nào dùng generics, interface hay reflection
- [ ] Viết iterator `iter.Seq`/`iter.Seq2`, xử lý đúng `yield` trả `false`
- [ ] Dùng `slices.Collect`, `slices.Sorted(maps.Keys(m))`, `slices.Chunk`
- [ ] Đọc struct tag và sửa field bằng reflection
- [ ] Format/parse thời gian với layout `2006-01-02`, dùng múi giờ và `Duration` đúng cách
- [ ] Cấu hình `slog` với JSON handler, level, `With`, `Group`, context
- [ ] Nhúng file bằng `//go:embed` và phục vụ bằng `http.FileServerFS`
- [ ] Viết template với `range`, `if`, `with`, `FuncMap`; biết vì sao phải dùng `html/template`
- [ ] Chọn đúng `strings.Builder` / `bytes.Buffer`; sắp xếp nhiều tiêu chí với `cmp.Or`
- [ ] Chạy thành công cả 4 ứng dụng thực tế
- [ ] Hoàn thành ít nhất 4 bài tập

## 🚀 Tiếp theo

Bạn đã có trong tay gần như toàn bộ "hộp đồ nghề" mà một Go developer dùng hằng ngày. Bài cuối cùng sẽ ghép tất cả lại thành một **service sẵn sàng cho production**:

- Cấu trúc project thực tế: `cmd/`, `internal/`
- Cấu hình, dependency injection, functional options
- Graceful shutdown, health check, metrics, profiling với `pprof`
- Build, Docker multi-stage, CI với GitHub Actions
- **Capstone**: Bookmark API với SQLite, slog, middleware, test và Dockerfile

**Bài tiếp theo**: [Go trong Production](./16-production-ready.md)

---

💡 **Tips ghi nhớ**:

- **Generics** cho cấu trúc dữ liệu & thuật toán chung - **interface** cho hành vi - **reflection** cho thư viện
- **`~T`** = "mọi kiểu có kiểu nền T"
- **Iterator**: `if !yield(v) { return }` - không bao giờ quên
- **Thời gian**: `2006-01-02 15:04:05`, lưu UTC, so sánh bằng `Equal`
- **Log** có cấu trúc (`slog`) - máy đọc được, người đọc được
- **HTML** thì `html/template` - không ngoại lệ
- **Một binary** chứa mọi thứ nhờ `embed`
