# 📚 Bài 8: Concurrency - Lập trình đồng thời

## 🎯 Mục tiêu bài học

- Phân biệt **concurrency** (đồng thời) và **parallelism** (song song)
- Tạo và chạy **goroutine** với từ khóa `go`
- Chờ goroutine hoàn thành với **`sync.WaitGroup`**
- Giao tiếp giữa các goroutine bằng **channel** (unbuffered và buffered)
- **Đóng channel** và duyệt channel bằng `range`
- Chờ nhiều channel cùng lúc với **`select`**, làm timeout
- Bảo vệ dữ liệu dùng chung với **`sync.Mutex`**
- Xây dựng **worker pool** - mẫu thiết kế concurrency phổ biến nhất
- Dùng **`context`** để hủy và đặt timeout cho tác vụ
- Phát hiện **data race** bằng `go run -race`
- Tránh các lỗi kinh điển: **deadlock**, **goroutine leak**, **biến vòng lặp**

## 📖 1. Concurrency là gì?

### Concurrency vs Parallelism

> 💡 **Ví von nhà bếp**:
> - **Tuần tự (sequential)**: Một đầu bếp nấu cơm xong → mới luộc rau → xong mới rán cá. Rất chậm!
> - **Concurrency (đồng thời)**: Một đầu bếp bắc nồi cơm lên, **trong lúc chờ** cơm chín thì nhặt rau, **trong lúc chờ** nước sôi thì ướp cá. Một người nhưng **xử lý nhiều việc xen kẽ**.
> - **Parallelism (song song)**: **Ba đầu bếp** cùng lúc, mỗi người làm một món. Nhiều việc chạy **thực sự cùng một thời điểm**.

- **Concurrency** là về **cấu trúc** chương trình: chia thành nhiều tác vụ độc lập có thể xen kẽ nhau
- **Parallelism** là về **thực thi**: chạy nhiều tác vụ cùng lúc trên nhiều nhân CPU

> Rob Pike: *"Concurrency is about **dealing with** lots of things at once. Parallelism is about **doing** lots of things at once."*

Go giúp bạn viết code **concurrent** dễ dàng, và Go runtime sẽ tự động chạy **song song** trên tất cả nhân CPU có sẵn.

### Tại sao concurrency quan trọng?

Phần lớn thời gian của chương trình thực tế là **chờ đợi**: chờ database, chờ gọi API, chờ đọc file... Trong lúc chờ, CPU rảnh rỗi. Concurrency giúp tận dụng thời gian chờ đó.

Ví dụ: Gọi 10 API, mỗi cái mất 1 giây:
- Tuần tự: **10 giây**
- Đồng thời: **~1 giây** 🚀

## 📖 2. Goroutine

### Goroutine là gì?

**Goroutine** là một "luồng nhẹ" (lightweight thread) do Go runtime quản lý. Để chạy một hàm trong goroutine mới, chỉ cần thêm từ khóa **`go`** phía trước:

```go
go doSomething() // Chạy doSomething() đồng thời, KHÔNG chờ nó xong
```

| | OS Thread (Java, C++) | Goroutine |
|---|----------------------|-----------|
| Bộ nhớ khởi đầu | ~1-8 MB | ~2 KB (tự tăng khi cần) |
| Thời gian tạo | Chậm (gọi hệ điều hành) | Rất nhanh |
| Số lượng thực tế | Vài nghìn | **Hàng trăm nghìn, thậm chí hàng triệu** |
| Quản lý bởi | Hệ điều hành | Go runtime (scheduler) |

### Goroutine đầu tiên - và cái bẫy đầu tiên

```go
package main

import "fmt"

func sayHello() {
	fmt.Println("Xin chào từ goroutine!")
}

func main() {
	go sayHello()
	fmt.Println("Xin chào từ main!")
}

// Output (thường gặp):
// Xin chào từ main!
```

😱 **"Xin chào từ goroutine!" đâu rồi?**

**Lý do**: Khi hàm `main` kết thúc, **chương trình kết thúc ngay lập tức** - kéo theo mọi goroutine đang chạy dở. `main` không chờ ai cả!

> 💡 **Ví von**: `main` là **người quản lý cửa hàng**. Khi quản lý về và **khóa cửa**, mọi nhân viên (goroutine) đang làm dở cũng phải về, dù chưa xong việc.

### ❌ Cách "chữa cháy" sai: `time.Sleep`

```go
go sayHello()
time.Sleep(100 * time.Millisecond) // ❌ Đoán mò thời gian - không đáng tin cậy!
```

Nếu goroutine chạy lâu hơn 100ms thì sao? Nếu nó chỉ mất 1ms thì phí 99ms? Cần một cơ chế **đồng bộ** thực sự.

## 📖 3. `sync.WaitGroup` - Chờ các goroutine hoàn thành

`WaitGroup` giống một **bộ đếm**:
- `wg.Add(n)`: tăng bộ đếm thêm `n` (có n việc cần chờ)
- `wg.Done()`: giảm bộ đếm 1 (xong một việc)
- `wg.Wait()`: **chặn** (đứng chờ) cho đến khi bộ đếm về 0

```go
package main

import (
	"fmt"
	"sync"
	"time"
)

func download(file string, wg *sync.WaitGroup) { // Phải truyền CON TRỎ
	defer wg.Done()                    // Luôn gọi Done khi xong, dùng defer để chắc chắn
	time.Sleep(100 * time.Millisecond) // Giả lập tải file mất 100ms
	fmt.Println("✅ Đã tải xong", file)
}

func main() {
	start := time.Now()
	files := []string{"a.jpg", "b.pdf", "c.mp4"}

	var wg sync.WaitGroup
	for _, f := range files {
		wg.Add(1) // Gọi Add TRƯỚC khi chạy goroutine
		go download(f, &wg)
	}

	wg.Wait() // Chờ tất cả tải xong
	fmt.Printf("Tải %d file trong ~%dms (thay vì 300ms)\n",
		len(files), time.Since(start).Round(100*time.Millisecond).Milliseconds())
}

// Output (thứ tự 3 dòng đầu có thể khác mỗi lần chạy):
// ✅ Đã tải xong c.mp4
// ✅ Đã tải xong a.jpg
// ✅ Đã tải xong b.pdf
// Tải 3 file trong ~100ms (thay vì 300ms)
```

**Để ý**: Thứ tự hoàn thành **không đoán trước được**. Đây là bản chất của concurrency - các goroutine chạy độc lập và Go scheduler quyết định ai chạy trước.

### Dùng closure với goroutine (cách viết phổ biến)

```go
package main

import (
	"fmt"
	"sync"
)

func main() {
	var wg sync.WaitGroup
	results := make([]int, 5) // Mỗi goroutine ghi vào MỘT ô riêng → an toàn

	for i := range 5 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			results[i] = i * i // Từ Go 1.22, mỗi vòng lặp có biến i riêng
		}()
	}

	wg.Wait()
	fmt.Println(results)
}

// Output:
// [0 1 4 9 16]
```

> 💡 Go 1.25 có thêm method `wg.Go(func() {...})` gộp `Add(1)` + `go` + `Done()`. Bài này dùng cách viết truyền thống để chạy được trên mọi phiên bản.

## 📖 4. Channel - "Đường ống" giữa các goroutine ⭐

### Triết lý của Go

> *"Don't communicate by sharing memory; share memory by communicating."*
> — Đừng giao tiếp bằng cách chia sẻ bộ nhớ; hãy chia sẻ bộ nhớ bằng cách giao tiếp.

Thay vì nhiều goroutine cùng đọc/ghi một biến (dễ lỗi), Go khuyến khích **gửi dữ liệu qua channel**.

> 💡 **Ví von**: Channel giống **băng chuyền** trong nhà máy, hoặc **ống gửi tài liệu** trong tòa nhà văn phòng. Một người bỏ đồ vào đầu này, người khác lấy ra ở đầu kia. Mỗi món đồ chỉ được **một người nhận**.

### Tạo và sử dụng channel

```go
ch := make(chan int)   // Tạo channel truyền giá trị kiểu int

ch <- 42               // GỬI 42 vào channel (mũi tên chỉ VÀO ch)
value := <-ch          // NHẬN từ channel (mũi tên chỉ RA KHỎI ch)
```

```go
package main

import "fmt"

func sum(nums []int, result chan int) {
	total := 0
	for _, n := range nums {
		total += n
	}
	result <- total // Gửi kết quả vào channel
}

func main() {
	nums := []int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	ch := make(chan int)

	// Chia đôi công việc cho 2 goroutine
	go sum(nums[:5], ch)
	go sum(nums[5:], ch)

	a, b := <-ch, <-ch // Nhận 2 kết quả (chờ đến khi có)
	fmt.Println("Tổng hai nửa:", a+b)
}

// Output:
// Tổng hai nửa: 55
```

Để ý: **Không cần WaitGroup!** Vì `<-ch` **chặn** (block) cho đến khi có dữ liệu - chính nó đã là cơ chế đồng bộ.

### Unbuffered channel - "Trao tay trực tiếp"

`make(chan T)` tạo **unbuffered channel** (không có bộ đệm):
- **Gửi** sẽ **chặn** cho đến khi có người **nhận**
- **Nhận** sẽ **chặn** cho đến khi có người **gửi**

> 💡 **Ví von**: Giống **trao tay một món quà**. Bạn đứng chờ cho đến khi người nhận đưa tay ra. Cả hai phải **gặp nhau cùng lúc**.

```go
package main

import (
	"fmt"
	"time"
)

func main() {
	ch := make(chan string)

	go func() {
		fmt.Println("🧑‍🍳 Đầu bếp: đang nấu...")
		time.Sleep(100 * time.Millisecond)
		ch <- "🍜 Phở bò" // Chặn ở đây đến khi main nhận
	}()

	fmt.Println("🙋 Khách: chờ món...")
	dish := <-ch // Chặn ở đây đến khi có món (khoảng 100ms)
	fmt.Println("🙋 Khách: nhận được", dish)
}

// Output:
// 🙋 Khách: chờ món...
// 🧑‍🍳 Đầu bếp: đang nấu...
// 🙋 Khách: nhận được 🍜 Phở bò
```

> ⚠️ Hai dòng đầu có thể đổi chỗ cho nhau tùy scheduler (goroutine đầu bếp có thể được chạy trước). Nhưng dòng "nhận được" **chắc chắn** in sau cùng, vì `<-ch` chặn main cho đến khi đầu bếp gửi món.

### Buffered channel - "Hộp thư có sức chứa"

`make(chan T, n)` tạo channel có **bộ đệm chứa n phần tử**:
- **Gửi** chỉ chặn khi bộ đệm **đầy**
- **Nhận** chỉ chặn khi bộ đệm **rỗng**

> 💡 **Ví von**: Giống **hộp thư** chứa được 3 lá thư. Người đưa thư bỏ thư vào mà không cần chờ bạn ở nhà - trừ khi hộp đã đầy.

```go
package main

import "fmt"

func main() {
	ch := make(chan string, 3) // Sức chứa 3

	ch <- "thư 1" // Không chặn - còn chỗ
	ch <- "thư 2"
	ch <- "thư 3"
	// ch <- "thư 4" // ❌ Sẽ chặn mãi mãi (hộp đầy, không ai nhận) → deadlock!

	fmt.Println("len:", len(ch), "cap:", cap(ch))
	fmt.Println(<-ch) // FIFO: vào trước ra trước
	fmt.Println(<-ch)
	fmt.Println("len còn lại:", len(ch))
}

// Output:
// len: 3 cap: 3
// thư 1
// thư 2
// len còn lại: 1
```

| | Unbuffered `make(chan T)` | Buffered `make(chan T, n)` |
|---|---------------------------|---------------------------|
| Gửi chặn khi | Chưa có người nhận | Bộ đệm đầy |
| Nhận chặn khi | Chưa có người gửi | Bộ đệm rỗng |
| Đảm bảo | Người nhận **đã nhận** khi gửi xong | Chỉ đảm bảo đã **vào hộp** |
| Dùng khi | Cần đồng bộ chặt chẽ | Giảm chờ đợi, giới hạn số lượng |

### Channel có hướng (Directional channel)

Khi truyền channel vào hàm, nên giới hạn hướng để code rõ ràng và an toàn hơn:

```go
func producer(out chan<- int) { // chan<- : CHỈ GỬI được
	out <- 1
	// x := <-out // ❌ Lỗi biên dịch: cannot receive from send-only channel
}

func consumer(in <-chan int) { // <-chan : CHỈ NHẬN được
	x := <-in
	// in <- 2 // ❌ Lỗi biên dịch: cannot send to receive-only channel
	_ = x
}
```

> 💡 **Mẹo nhớ**: Mũi tên `<-` chỉ hướng dữ liệu đi. `chan<-` dữ liệu đi **vào** chan. `<-chan` dữ liệu đi **ra** từ chan.

## 📖 5. Đóng channel và duyệt bằng `range`

### `close(ch)` - "Hết hàng rồi!"

Người **gửi** có thể **đóng** channel để báo hiệu "không còn dữ liệu nào nữa":

```go
package main

import "fmt"

func generateSquares(n int, out chan<- int) {
	for i := 1; i <= n; i++ {
		out <- i * i
	}
	close(out) // Báo cho người nhận: đã gửi xong
}

func main() {
	ch := make(chan int)
	go generateSquares(5, ch)

	// range tự động dừng khi channel bị đóng VÀ đã nhận hết dữ liệu
	for sq := range ch {
		fmt.Print(sq, " ")
	}
	fmt.Println()

	// Nhận từ channel đã đóng: trả về zero value ngay lập tức
	v, ok := <-ch
	fmt.Println(v, ok) // ok = false nghĩa là channel đã đóng
}

// Output:
// 1 4 9 16 25
// 0 false
```

### Quy tắc về đóng channel

- ✅ **Chỉ người GỬI** mới đóng channel (người nhận không biết còn dữ liệu hay không)
- ✅ Chỉ cần đóng khi người nhận **cần biết** là đã hết (ví dụ dùng `range`)
- ❌ **Gửi vào channel đã đóng** → `panic: send on closed channel`
- ❌ **Đóng channel 2 lần** → `panic: close of closed channel`
- ✅ **Nhận từ channel đã đóng** → OK, trả về zero value và `ok = false`

### Pipeline - Nối các giai đoạn xử lý

```go
package main

import "fmt"

// Giai đoạn 1: sinh số
func generate(nums ...int) <-chan int {
	out := make(chan int)
	go func() {
		defer close(out)
		for _, n := range nums {
			out <- n
		}
	}()
	return out
}

// Giai đoạn 2: bình phương
func square(in <-chan int) <-chan int {
	out := make(chan int)
	go func() {
		defer close(out)
		for n := range in {
			out <- n * n
		}
	}()
	return out
}

// Giai đoạn 3: lọc số chẵn
func onlyEven(in <-chan int) <-chan int {
	out := make(chan int)
	go func() {
		defer close(out)
		for n := range in {
			if n%2 == 0 {
				out <- n
			}
		}
	}()
	return out
}

func main() {
	// generate → square → onlyEven → in ra
	for v := range onlyEven(square(generate(1, 2, 3, 4, 5, 6))) {
		fmt.Println(v)
	}
}

// Output:
// 4
// 16
// 36
```

> 💡 Mỗi giai đoạn là một goroutine, dữ liệu "chảy" qua các channel như **dây chuyền sản xuất**. Các giai đoạn chạy **đồng thời**: trong khi `square` xử lý số 3, `generate` đã có thể gửi số 4.

## 📖 6. `select` - Chờ nhiều channel cùng lúc

`select` giống `switch` nhưng dành cho channel: nó **chờ** cho đến khi **một trong các case** sẵn sàng, rồi chạy case đó.

```go
package main

import (
	"fmt"
	"time"
)

func main() {
	fast := make(chan string)
	slow := make(chan string)

	go func() {
		time.Sleep(50 * time.Millisecond)
		fast <- "🐇 Thỏ về đích"
	}()
	go func() {
		time.Sleep(150 * time.Millisecond)
		slow <- "🐢 Rùa về đích"
	}()

	// Nhận 2 lần, ai xong trước in trước
	for range 2 {
		select {
		case msg := <-fast:
			fmt.Println(msg)
		case msg := <-slow:
			fmt.Println(msg)
		}
	}
}

// Output:
// 🐇 Thỏ về đích
// 🐢 Rùa về đích
```

### Timeout với `time.After`

```go
package main

import (
	"fmt"
	"time"
)

func callAPI(delay time.Duration) <-chan string {
	ch := make(chan string, 1) // Buffered để goroutine không bị kẹt nếu không ai nhận
	go func() {
		time.Sleep(delay)
		ch <- "dữ liệu từ API"
	}()
	return ch
}

func fetchWithTimeout(delay time.Duration) {
	select {
	case data := <-callAPI(delay):
		fmt.Println("✅ Nhận được:", data)
	case <-time.After(100 * time.Millisecond):
		fmt.Println("⏰ Timeout! API phản hồi quá chậm")
	}
}

func main() {
	fetchWithTimeout(20 * time.Millisecond)  // Nhanh
	fetchWithTimeout(300 * time.Millisecond) // Chậm
}

// Output:
// ✅ Nhận được: dữ liệu từ API
// ⏰ Timeout! API phản hồi quá chậm
```

> 💡 Để ý `make(chan string, 1)`: nếu dùng unbuffered, khi timeout xảy ra thì không ai nhận nữa, goroutine gửi sẽ **bị kẹt mãi mãi** → **goroutine leak**. Buffer 1 giúp nó gửi xong và kết thúc.

### `default` - Không chặn (non-blocking)

```go
package main

import "fmt"

func main() {
	messages := make(chan string, 1)

	// Thử nhận, nếu không có gì thì làm việc khác ngay
	select {
	case msg := <-messages:
		fmt.Println("Có tin:", msg)
	default:
		fmt.Println("Không có tin nhắn nào")
	}

	// Thử gửi, nếu đầy thì bỏ qua
	messages <- "tin 1"
	select {
	case messages <- "tin 2":
		fmt.Println("Đã gửi tin 2")
	default:
		fmt.Println("Hộp thư đầy, bỏ qua tin 2")
	}
}

// Output:
// Không có tin nhắn nào
// Hộp thư đầy, bỏ qua tin 2
```

> 💡 Nếu **nhiều case sẵn sàng cùng lúc**, `select` chọn **ngẫu nhiên** một case (để công bằng, tránh "bỏ đói" channel nào).

## 📖 7. Race Condition và `sync.Mutex`

### Vấn đề: Nhiều goroutine cùng ghi một biến

```go
package main

import (
	"fmt"
	"sync"
)

func main() {
	counter := 0
	var wg sync.WaitGroup

	for range 1000 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			counter++ // ⚠️ NGUY HIỂM: nhiều goroutine cùng sửa counter
		}()
	}

	wg.Wait()
	fmt.Println("Counter:", counter) // Mong đợi 1000...
}

// Output (mỗi lần chạy có thể khác):
// Counter: 947
```

**Tại sao không phải 1000?** Vì `counter++` thực chất gồm **3 bước**: (1) đọc giá trị, (2) cộng 1, (3) ghi lại. Hai goroutine có thể **cùng đọc** giá trị 5, cùng cộng thành 6, cùng ghi 6 → **mất một lần tăng**.

```text
Goroutine A          Goroutine B          counter
đọc counter (5)                             5
                     đọc counter (5)        5
tính 5+1 = 6                                5
                     tính 5+1 = 6           5
ghi 6                                       6
                     ghi 6                  6   ← Đáng lẽ phải là 7!
```

Đây gọi là **data race** (tranh chấp dữ liệu) - một trong những bug **khó tìm nhất** vì nó xảy ra ngẫu nhiên.

> 💡 Trên máy có ít nhân CPU, bạn có thể thấy kết quả "may mắn" đúng 1000. Đừng bị lừa - code vẫn **sai**! Dùng race detector (mục 8) để phát hiện.

### Giải pháp: `sync.Mutex`

**Mutex** (Mutual Exclusion - loại trừ lẫn nhau) đảm bảo **tại một thời điểm chỉ một goroutine** được vào "vùng nguy hiểm" (critical section).

> 💡 **Ví von**: Mutex giống **chìa khóa phòng thay đồ** duy nhất. Ai cầm chìa khóa (`Lock`) mới được vào. Người khác phải **xếp hàng chờ**. Dùng xong phải **trả chìa** (`Unlock`) cho người tiếp theo.

```go
package main

import (
	"fmt"
	"sync"
)

// SafeCounter an toàn khi dùng từ nhiều goroutine
type SafeCounter struct {
	mu    sync.Mutex // Zero value của Mutex dùng được ngay
	count map[string]int
}

func (c *SafeCounter) Inc(key string) { // Pointer receiver - BẮT BUỘC với Mutex
	c.mu.Lock()         // Lấy chìa khóa
	defer c.mu.Unlock() // Chắc chắn trả chìa khi ra khỏi hàm
	c.count[key]++
}

func (c *SafeCounter) Value(key string) int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.count[key]
}

func main() {
	c := SafeCounter{count: make(map[string]int)}
	var wg sync.WaitGroup

	for range 1000 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			c.Inc("visits")
		}()
	}

	wg.Wait()
	fmt.Println("Visits:", c.Value("visits"))
}

// Output:
// Visits: 1000
```

### `sync.RWMutex` - Nhiều người đọc, một người ghi

Khi dữ liệu được **đọc nhiều hơn ghi rất nhiều** (ví dụ cache), dùng `RWMutex`:
- `RLock()`/`RUnlock()`: **nhiều** goroutine có thể đọc cùng lúc
- `Lock()`/`Unlock()`: chỉ **một** goroutine ghi, chặn tất cả người đọc

```go
type Cache struct {
	mu   sync.RWMutex
	data map[string]string
}

func (c *Cache) Get(key string) (string, bool) {
	c.mu.RLock() // Khóa ĐỌC - không chặn người đọc khác
	defer c.mu.RUnlock()
	v, ok := c.data[key]
	return v, ok
}

func (c *Cache) Set(key, value string) {
	c.mu.Lock() // Khóa GHI - độc quyền
	defer c.mu.Unlock()
	c.data[key] = value
}
```

### `sync/atomic` - Cho bộ đếm đơn giản

```go
var counter atomic.Int64 // Go 1.19+

counter.Add(1)             // Tăng an toàn, không cần Mutex
fmt.Println(counter.Load()) // Đọc an toàn
```

### Channel hay Mutex?

| Dùng **channel** khi | Dùng **Mutex** khi |
|----------------------|-------------------|
| Chuyển **quyền sở hữu** dữ liệu giữa goroutine | Bảo vệ **trạng thái dùng chung** (cache, counter, map) |
| Phân phối công việc (worker pool) | Truy cập ngắn, đơn giản |
| Báo hiệu sự kiện (xong, hủy) | Code đơn giản hơn so với dùng channel |

## 📖 8. Race Detector - "Thám tử" tìm data race

Go có sẵn công cụ phát hiện data race cực mạnh. Chỉ cần thêm cờ **`-race`**:

```bash
go run -race main.go
go test -race ./...
go build -race
```

Chạy ví dụ counter lỗi ở mục 7 với `-race`:

```text
==================
WARNING: DATA RACE
Read at 0x00c000012158 by goroutine 10:
  main.main.func1()
      /path/to/main.go:15 +0x84

Previous write at 0x00c000012158 by goroutine 7:
  main.main.func1()
      /path/to/main.go:15 +0x96
...
==================
Counter: 787
Found 2 data race(s)
exit status 66
```

Race detector chỉ rõ **dòng code nào** đọc/ghi xung đột (`main.go:15` chính là dòng `counter++`).

### 💡 Tips quan trọng

- ✅ **Luôn chạy `go test -race ./...`** trong CI/CD
- ✅ Race detector chỉ phát hiện race **thực sự xảy ra** trong lần chạy đó → cần test đủ kịch bản
- ⚠️ Chương trình chạy với `-race` **chậm hơn 2-20 lần** và tốn RAM hơn → không dùng cho production
- ⚠️ Cần **cgo** (trình biên dịch C như `gcc`) trên một số hệ điều hành; trên Windows cần cài thêm MinGW/gcc

## 📖 9. Worker Pool - Mẫu thiết kế kinh điển ⭐

**Vấn đề**: Bạn có 1000 ảnh cần xử lý. Tạo 1000 goroutine cùng lúc có thể làm quá tải CPU, RAM hoặc server bên ngoài (ví dụ API giới hạn 5 request đồng thời).

**Giải pháp**: Tạo một **số lượng cố định** worker (ví dụ 3), cùng lấy việc từ một **hàng đợi chung**.

> 💡 **Ví von**: Giống **ngân hàng có 3 quầy giao dịch**. Khách (job) bốc số và xếp hàng. Quầy nào rảnh thì gọi khách tiếp theo. Dù có 100 khách, chỉ có 3 người được phục vụ cùng lúc.

```go
package main

import (
	"fmt"
	"sync"
	"time"
)

type Job struct {
	ID    int
	Input int
}

type Result struct {
	JobID    int
	Output   int
	WorkerID int
}

// worker lấy job từ jobs, xử lý, gửi kết quả vào results
func worker(id int, jobs <-chan Job, results chan<- Result, wg *sync.WaitGroup) {
	defer wg.Done()
	for job := range jobs { // Lặp đến khi jobs bị đóng và hết việc
		time.Sleep(50 * time.Millisecond) // Giả lập công việc nặng
		results <- Result{JobID: job.ID, Output: job.Input * job.Input, WorkerID: id}
	}
}

func main() {
	const numWorkers = 3
	const numJobs = 9

	jobs := make(chan Job, numJobs)
	results := make(chan Result, numJobs)

	// 1. Khởi động worker
	var wg sync.WaitGroup
	for w := 1; w <= numWorkers; w++ {
		wg.Add(1)
		go worker(w, jobs, results, &wg)
	}

	// 2. Gửi việc vào hàng đợi
	start := time.Now()
	for i := 1; i <= numJobs; i++ {
		jobs <- Job{ID: i, Input: i}
	}
	close(jobs) // Báo: hết việc rồi, worker xong việc thì về

	// 3. Đóng results khi TẤT CẢ worker đã xong (chạy trong goroutine riêng)
	go func() {
		wg.Wait()
		close(results)
	}()

	// 4. Thu thập kết quả
	sum := 0
	count := 0
	for r := range results {
		sum += r.Output
		count++
	}

	elapsed := time.Since(start).Round(50 * time.Millisecond)
	fmt.Printf("Đã xử lý %d job, tổng bình phương = %d\n", count, sum)
	fmt.Printf("Thời gian ~%v (tuần tự sẽ mất ~450ms)\n", elapsed)
}

// Output:
// Đã xử lý 9 job, tổng bình phương = 285
// Thời gian ~150ms (tuần tự sẽ mất ~450ms)
```

**Luồng hoạt động**:

```text
             ┌──────────┐
         ┌──►│ Worker 1 │──┐
┌──────┐ │   └──────────┘  │   ┌─────────┐
│ jobs │─┼──►│ Worker 2 │──┼──►│ results │──► main thu thập
└──────┘ │   └──────────┘  │   └─────────┘
         └──►│ Worker 3 │──┘
             └──────────┘
9 job / 3 worker = 3 lượt × 50ms = ~150ms
```

**Các điểm mấu chốt**:
1. `close(jobs)` sau khi gửi hết → vòng `for range jobs` trong worker kết thúc
2. Một goroutine riêng `wg.Wait()` rồi `close(results)` → vòng `for range results` trong main kết thúc
3. Nếu `wg.Wait()` đặt trực tiếp trong main **trước** khi đọc results (với channel unbuffered) → **deadlock**!

## 📖 10. `context` - Hủy và Timeout

### Vấn đề

Người dùng mở trang web, server bắt đầu truy vấn database (mất 10 giây). Sau 2 giây, người dùng **đóng tab**. Server có nên tiếp tục làm 8 giây còn lại không? **Không!** Cần cách báo cho mọi goroutine liên quan: "**Dừng lại, không cần nữa**".

Package `context` giải quyết điều này. Một `context.Context` mang theo:
- **Tín hiệu hủy** (cancellation)
- **Deadline/timeout**
- Giá trị theo request (request ID, user...) - dùng hạn chế

> 💡 **Ví von**: Context giống **bộ đàm** phát cho cả đội. Khi đội trưởng hô "Rút lui!" qua bộ đàm (`cancel()`), mọi thành viên đang làm nhiệm vụ đều nghe thấy (`<-ctx.Done()`) và dừng lại.

### `context.WithTimeout`

```go
package main

import (
	"context"
	"errors"
	"fmt"
	"time"
)

// Hàm chậm "biết lắng nghe" context
func slowQuery(ctx context.Context, duration time.Duration) (string, error) {
	select {
	case <-time.After(duration): // Giả lập công việc mất `duration`
		return "kết quả truy vấn", nil
	case <-ctx.Done(): // Bị hủy hoặc hết giờ
		return "", ctx.Err()
	}
}

func main() {
	// Timeout 100ms
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel() // LUÔN gọi cancel để giải phóng tài nguyên

	// Truy vấn nhanh (50ms) → thành công
	if res, err := slowQuery(ctx, 50*time.Millisecond); err == nil {
		fmt.Println("✅", res)
	}

	// Truy vấn chậm (500ms) → timeout
	_, err := slowQuery(ctx, 500*time.Millisecond)
	fmt.Println("❌", err)
	fmt.Println("Có phải timeout?", errors.Is(err, context.DeadlineExceeded))
}

// Output:
// ✅ kết quả truy vấn
// ❌ context deadline exceeded
// Có phải timeout? true
```

### `context.WithCancel` - Hủy thủ công

```go
package main

import (
	"context"
	"fmt"
	"sync"
	"time"
)

func worker(ctx context.Context, id int, wg *sync.WaitGroup) {
	defer wg.Done()
	for i := 1; ; i++ {
		select {
		case <-ctx.Done():
			fmt.Printf("Worker %d: nhận lệnh dừng (%v)\n", id, ctx.Err())
			return
		case <-time.After(40 * time.Millisecond):
			// Làm một phần công việc rồi quay lại kiểm tra ctx
		}
	}
}

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	var wg sync.WaitGroup

	for id := 1; id <= 2; id++ {
		wg.Add(1)
		go worker(ctx, id, &wg)
	}

	time.Sleep(100 * time.Millisecond)
	fmt.Println("Main: gửi lệnh hủy!")
	cancel() // Tất cả worker đều nhận được tín hiệu

	wg.Wait()
	fmt.Println("Main: tất cả worker đã dừng")
}

// Output (thứ tự 2 worker có thể khác):
// Main: gửi lệnh hủy!
// Worker 1: nhận lệnh dừng (context canceled)
// Worker 2: nhận lệnh dừng (context canceled)
// Main: tất cả worker đã dừng
```

### Quy ước dùng context

- ✅ `ctx context.Context` luôn là **tham số đầu tiên** của hàm: `func Fetch(ctx context.Context, url string)`
- ✅ **Luôn `defer cancel()`** ngay sau khi tạo context có cancel/timeout
- ✅ Truyền context **xuống** các hàm con; context con bị hủy khi context cha bị hủy
- ❌ **Không lưu** context trong struct
- ❌ **Không truyền `nil`** - dùng `context.Background()` (gốc) hoặc `context.TODO()` (chưa biết dùng gì)
- ✅ Thư viện chuẩn hỗ trợ context: `http.NewRequestWithContext`, `db.QueryContext`, `exec.CommandContext`...

> 💡 Trong web server ([Bài 10](./10-final-project.md)), mỗi request có sẵn context: `r.Context()`. Nó tự động bị hủy khi client ngắt kết nối.

## 📖 11. Ví dụ tổng hợp: Kiểm tra nhiều website đồng thời

```go
package main

import (
	"context"
	"fmt"
	"math/rand/v2"
	"sort"
	"sync"
	"time"
)

type CheckResult struct {
	URL     string
	Status  string
	Latency time.Duration
}

// Giả lập kiểm tra website (không cần mạng thật)
func checkSite(ctx context.Context, url string) CheckResult {
	latency := time.Duration(20+rand.IntN(200)) * time.Millisecond
	select {
	case <-time.After(latency):
		return CheckResult{URL: url, Status: "UP", Latency: latency}
	case <-ctx.Done():
		return CheckResult{URL: url, Status: "TIMEOUT"}
	}
}

func checkAll(urls []string, timeout time.Duration, maxConcurrent int) []CheckResult {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	var (
		mu      sync.Mutex
		wg      sync.WaitGroup
		results []CheckResult
		sem     = make(chan struct{}, maxConcurrent) // "Semaphore" giới hạn số goroutine đồng thời
	)

	for _, url := range urls {
		wg.Add(1)
		go func() {
			defer wg.Done()
			sem <- struct{}{}        // Lấy một "vé" (chặn nếu hết vé)
			defer func() { <-sem }() // Trả vé khi xong

			r := checkSite(ctx, url)
			mu.Lock()
			results = append(results, r)
			mu.Unlock()
		}()
	}
	wg.Wait()

	sort.Slice(results, func(i, j int) bool { return results[i].URL < results[j].URL })
	return results
}

func main() {
	urls := []string{"go.dev", "pkg.go.dev", "gobyexample.com", "github.com", "example.com"}
	results := checkAll(urls, 150*time.Millisecond, 3)

	for _, r := range results {
		if r.Status == "UP" {
			fmt.Printf("🟢 %-16s %s (%v)\n", r.URL, r.Status, r.Latency)
		} else {
			fmt.Printf("🔴 %-16s %s\n", r.URL, r.Status)
		}
	}
}

// Output (ngẫu nhiên, ví dụ một lần chạy):
// 🟢 example.com      UP (57ms)
// 🔴 github.com       TIMEOUT
// 🟢 go.dev           UP (134ms)
// 🔴 gobyexample.com  TIMEOUT
// 🟢 pkg.go.dev       UP (41ms)
```

Ví dụ này kết hợp **tất cả** những gì bạn đã học: goroutine, WaitGroup, Mutex, channel làm semaphore, context timeout, closure.

## ⚠️ Lỗi thường gặp

### Lỗi 1: Deadlock - "Tất cả goroutine đều đang ngủ"

```go
package main

func main() {
	ch := make(chan int)
	ch <- 1 // Gửi vào unbuffered channel, nhưng không có ai nhận!
}
```

```text
fatal error: all goroutines are asleep - deadlock!
```

**Các nguyên nhân phổ biến**:
- Gửi vào unbuffered channel mà không có goroutine nào nhận
- `for range ch` nhưng không bao giờ `close(ch)`
- `wg.Wait()` nhưng quên `wg.Done()` (hoặc `Add` nhiều hơn số `Done`)
- Lock mutex hai lần trong cùng goroutine (Go mutex không re-entrant)

### Lỗi 2: Goroutine leak - Goroutine bị "bỏ rơi"

```go
func leak() {
	ch := make(chan int)
	go func() {
		val := <-ch // Chờ mãi mãi vì không ai gửi
		fmt.Println(val)
	}()
	// Hàm return, goroutine vẫn kẹt trong bộ nhớ MÃI MÃI
}
```

Goroutine bị leak **không bao giờ được giải phóng**. Gọi hàm này 1 triệu lần → 1 triệu goroutine kẹt → hết RAM.

✅ **Cách phòng tránh**: Mỗi khi viết `go ...`, hãy tự hỏi: **"Goroutine này sẽ kết thúc KHI NÀO và NHƯ THẾ NÀO?"**. Dùng `context` để hủy, `close` channel để báo hiệu, buffered channel khi có thể không ai nhận.

### Lỗi 3: Biến vòng lặp trong goroutine (trước Go 1.22)

```go
// Với go.mod khai báo "go 1.21" trở xuống:
for i := 0; i < 3; i++ {
	go func() {
		fmt.Println(i) // ⚠️ Có thể in "3 3 3" vì tất cả dùng CHUNG biến i
	}()
}
```

**Từ Go 1.22** (khi `go.mod` có `go 1.22` trở lên), mỗi vòng lặp có **biến riêng** → in ra 0, 1, 2 (theo thứ tự bất kỳ). Nếu bạn làm việc với code cũ, cách sửa truyền thống là:

```go
for i := 0; i < 3; i++ {
	i := i // Tạo bản sao cho mỗi vòng (không cần từ Go 1.22)
	go func() { fmt.Println(i) }()
}
// hoặc truyền làm tham số:
for i := 0; i < 3; i++ {
	go func(n int) { fmt.Println(n) }(i)
}
```

### Lỗi 4: Gọi `wg.Add` bên trong goroutine

```go
for range 5 {
	go func() {
		wg.Add(1) // ❌ Có thể chạy SAU wg.Wait() → Wait trả về sớm
		defer wg.Done()
		// ...
	}()
}
wg.Wait()
```

✅ Luôn gọi `wg.Add(1)` **trước** câu lệnh `go`.

### Lỗi 5: Truyền WaitGroup/Mutex theo giá trị

```go
func work(wg sync.WaitGroup) { defer wg.Done() } // ❌ Done trên BẢN SAO → deadlock
func work(wg *sync.WaitGroup) { defer wg.Done() } // ✅
```

`go vet` sẽ cảnh báo: *"passes lock by value"*.

### Lỗi 6: Gửi vào channel đã đóng / đóng 2 lần

```go
ch := make(chan int)
close(ch)
ch <- 1   // 💥 panic: send on closed channel
close(ch) // 💥 panic: close of closed channel
```

✅ Chỉ **người gửi duy nhất** (hoặc người điều phối) đóng channel, và chỉ đóng **một lần**.

### Lỗi 7: Map dùng chung không có khóa

```go
m := map[int]int{}
for i := range 100 {
	go func() { m[i] = i }() // 💥 fatal error: concurrent map writes
}
```

✅ Bảo vệ bằng `sync.Mutex` (hoặc dùng `sync.Map` cho trường hợp đặc biệt).

### Lỗi 8: Quên `defer cancel()`

```go
ctx, _ := context.WithTimeout(ctx, time.Second) // ❌ go vet: the cancel function returned by context.WithTimeout should be called, not discarded, to avoid a context leak
ctx, cancel := context.WithTimeout(ctx, time.Second)
defer cancel() // ✅
```

## 🏋️ Bài tập

### Bài tập 1: Tổng song song

Cho slice 1.000.000 số nguyên (1 đến 1.000.000). Chia thành 4 phần, mỗi goroutine tính tổng một phần, gửi kết quả qua channel. Main cộng 4 kết quả lại. Kiểm tra kết quả bằng công thức `n*(n+1)/2`.

### Bài tập 2: Ping-Pong

Viết 2 goroutine "ping" và "pong" gửi qua lại một quả bóng (`int` đếm số lần chạm) qua 2 channel, mỗi lần in ra `"ping 1"`, `"pong 2"`, `"ping 3"`... Dừng sau 10 lần chạm.

### Bài tập 3: Worker pool tải file

Sửa ví dụ worker pool ở mục 9:
- 5 worker, 20 job
- Mỗi job "tải" một file giả lập với thời gian ngẫu nhiên 10-100ms
- Job có ID chia hết cho 7 thì trả về lỗi
- Thu thập kết quả, in ra số job thành công, thất bại và tổng thời gian

### Bài tập 4: Rate limiter

Dùng `time.Tick(100 * time.Millisecond)` để xử lý tối đa 10 request/giây. Có 15 request trong một channel, in ra thời điểm xử lý mỗi request (dùng `time.Since(start)`).

### Bài tập 5: Tìm kiếm nhanh nhất

Viết hàm `firstResult(ctx context.Context, servers []string) string` gửi "truy vấn" đến tất cả server cùng lúc (mỗi server có độ trễ ngẫu nhiên), trả về kết quả của server **nhanh nhất**, và **hủy** các truy vấn còn lại bằng context. Đảm bảo không có goroutine leak.

### Bài tập 6: Tìm và sửa data race

Chạy chương trình sau với `go run -race`, đọc báo cáo, rồi sửa lỗi bằng 2 cách: (a) dùng `sync.Mutex`, (b) dùng `atomic.Int64`:

```go
package main

import (
	"fmt"
	"sync"
)

func main() {
	var wg sync.WaitGroup
	total := 0
	for i := 1; i <= 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			total += i
		}()
	}
	wg.Wait()
	fmt.Println(total) // Phải luôn là 5050
}
```

## ✅ Checklist hoàn thành

- [ ] Phân biệt concurrency và parallelism
- [ ] Tạo goroutine bằng `go` và hiểu main không chờ goroutine
- [ ] Dùng `sync.WaitGroup` đúng cách (Add trước go, Done trong defer)
- [ ] Gửi/nhận qua channel, phân biệt unbuffered và buffered
- [ ] Dùng channel có hướng `chan<-` và `<-chan`
- [ ] Đóng channel đúng cách và duyệt bằng `range`
- [ ] Dùng `select` với nhiều channel, timeout và `default`
- [ ] Hiểu data race và bảo vệ dữ liệu bằng `sync.Mutex`
- [ ] Chạy `go run -race` / `go test -race` để phát hiện race
- [ ] Tự viết được worker pool
- [ ] Dùng `context.WithTimeout` và `context.WithCancel`
- [ ] Nhận biết và tránh deadlock, goroutine leak
- [ ] Hoàn thành ít nhất 4 bài tập

## 🚀 Tiếp theo

Bạn đã chinh phục phần khó nhất và cũng là "đặc sản" của Go! Giờ là lúc học cách **tổ chức code chuyên nghiệp** cho dự án thực tế:

- Package và module
- Exported vs unexported
- Cấu trúc thư mục dự án
- Viết unit test, table-driven test và benchmark

**Bài tiếp theo**: [Package, Module & Testing](./09-packages-modules-testing.md)

---

💡 **Tips ghi nhớ**:

- **`go` + hàm = goroutine** - rẻ, nhẹ, tạo thoải mái
- **Share memory by communicating** - ưu tiên channel để chuyển dữ liệu
- **Mutex cho trạng thái dùng chung**, channel cho luồng dữ liệu
- **Mỗi goroutine phải có đường về** - tránh leak
- **`go test -race`** - bật thường xuyên, bắt bug trước khi lên production
- **`ctx` là tham số đầu tiên**, luôn `defer cancel()`
