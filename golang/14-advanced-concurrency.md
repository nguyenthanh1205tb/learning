# 📚 Bài 14: Concurrency Patterns nâng cao

## 🎯 Mục tiêu bài học

- Ôn lại nhanh kiến thức concurrency của [Bài 8](./08-concurrency.md) và biết **chọn đúng công cụ** cho từng bài toán
- Hiểu **memory model** của Go ở mức cơ bản: "**happens-before**" là gì và tại sao nó quan trọng
- Viết **pipeline** có thể hủy giữa chừng mà không rò rỉ goroutine
- Áp dụng **fan-out / fan-in** để chia việc và gộp kết quả
- Giới hạn số việc chạy song song (**bounded parallelism**) bằng semaphore: buffered channel và `golang.org/x/sync/semaphore`
- Dùng **`errgroup`** (`WithContext`, `SetLimit`) - công cụ "thay thế WaitGroup" được dùng nhiều nhất trong code thực tế
- Làm chủ bộ công cụ `sync`: **`Once`/`OnceValue`**, **`RWMutex`**, **`sync/atomic`**, **`Pool`**, **`Cond`**
- **Giới hạn tốc độ** (rate limiting) với `time.Ticker` và `golang.org/x/time/rate`
- Truyền **timeout và tín hiệu hủy** xuyên qua nhiều tầng code
- **Tắt worker an toàn** (graceful shutdown) khi nhận Ctrl+C / SIGTERM
- **Phát hiện goroutine leak** bằng `runtime.NumGoroutine`, `goleak` và `pprof`
- Xây dựng 4 ứng dụng thực tế: **web crawler có giới hạn**, **xử lý hàng nghìn file**, **gọi nhiều API song song**, **cache có TTL**

## 📖 1. Ôn nhanh Bài 8 & "bản đồ" của bài này

### Những gì bạn đã biết

| Công cụ | Dùng để | Nhớ nhanh |
|---------|---------|-----------|
| `go f()` | Chạy `f` đồng thời | Rẻ (~2KB), nhưng **phải có đường về** |
| `sync.WaitGroup` | Chờ nhiều goroutine xong | `Add` **trước** `go`, `Done` trong `defer` |
| `chan T` | Chuyển dữ liệu giữa goroutine | Unbuffered = trao tay, buffered = hộp thư |
| `close(ch)` + `range ch` | Báo "hết hàng" | Chỉ **người gửi** đóng, đóng **một lần** |
| `select` | Chờ nhiều channel | Kết hợp `ctx.Done()`, `time.After`, `default` |
| `sync.Mutex` | Bảo vệ dữ liệu dùng chung | `Lock` + `defer Unlock` |
| Worker pool | Giới hạn số worker | N worker cùng đọc 1 channel `jobs` |
| `context` | Hủy / timeout | Tham số đầu tiên, luôn `defer cancel()` |
| `go test -race` | Tìm data race | Bật trong CI |

Nếu bảng trên còn lạ lẫm, hãy quay lại [Bài 8](./08-concurrency.md) trước khi đọc tiếp - bài này xây dựng **trực tiếp** trên nền đó.

### Bài này giải quyết những câu hỏi nào?

Bài 8 dạy bạn các "viên gạch". Bài này dạy cách **xây nhà** - tức là các **mẫu thiết kế (pattern)** mà code Go production dùng hằng ngày:

| Bạn muốn... | Dùng pattern / công cụ | Mục |
|-------------|------------------------|-----|
| Xử lý dữ liệu qua nhiều bước nối tiếp | Pipeline | 3 |
| Chia việc cho nhiều worker rồi gộp kết quả | Fan-out / Fan-in | 4 |
| Chạy song song nhưng **không quá N** việc cùng lúc | Semaphore, `errgroup.SetLimit` | 5, 6 |
| Chạy song song, **một lỗi thì hủy hết** | `errgroup.WithContext` | 6 |
| Khởi tạo thứ gì đó **đúng một lần** | `sync.Once`, `sync.OnceValue` | 7 |
| Đọc nhiều, ghi ít | `sync.RWMutex` | 7 |
| Bộ đếm, cờ, cấu hình "nóng" | `sync/atomic` | 7 |
| Giảm áp lực cho GC | `sync.Pool` | 7 |
| Không gọi API quá X lần/giây | `time.Ticker`, `rate.Limiter` | 8 |
| Hủy cả "cây" công việc khi request hết giờ | `context` xuyên tầng | 9 |
| Tắt chương trình mà không mất việc đang làm | Graceful shutdown | 10 |
| Biết chắc không có goroutine bị "bỏ rơi" | Phát hiện leak | 11 |

> 💡 **Ví von**: Bài 8 giống như học cách dùng **dao, thớt, bếp, nồi**. Bài 14 là học **cách vận hành cả một nhà hàng**: dây chuyền sơ chế (pipeline), chia bàn cho nhiều bồi bàn (fan-out), giới hạn số khách trong quán (semaphore), đóng cửa cuối ngày mà không đuổi khách đang ăn dở (graceful shutdown).

## 📖 2. Memory Model - "Happens-before" giải thích đơn giản

### Vấn đề: CPU và compiler "sắp xếp lại" code của bạn

Bạn nghĩ code chạy **đúng thứ tự bạn viết**? Chỉ đúng **trong một goroutine**. Để chạy nhanh, compiler và CPU được phép **đảo thứ tự** các lệnh, và mỗi nhân CPU có **bộ nhớ đệm (cache) riêng**. Kết quả: goroutine B có thể **không thấy** (hoặc thấy **sai thứ tự**) những gì goroutine A đã ghi.

```go
var data string
var ready bool

func producer() {
	data = "xin chào" // (1)
	ready = true      // (2)
}

func consumer() {
	for !ready { // ❌ Có thể lặp MÃI MÃI: compiler được phép đọc ready một lần rồi "nhớ"
	}
	fmt.Println(data) // ❌ Có thể in ra "" dù ready đã là true: (1) và (2) có thể bị đảo
}
```

Đoạn code trên **có data race** - `go run -race` sẽ báo ngay. Nó có thể "chạy đúng" trên máy bạn 1000 lần, rồi sai trên server production vào lúc 3 giờ sáng.

### "Happens-before" là gì?

> 💡 **Ví von**: Hai người ở hai thành phố cùng xem một **bảng tin**. A dán thông báo lên bảng rồi **gọi điện** cho B. Khi B nghe máy, B **chắc chắn** thấy thông báo - vì cuộc gọi xảy ra **sau** khi dán. Nhưng nếu A không gọi, B nhìn bảng lúc nào thì... **tùy may rủi**.
>
> Cuộc gọi điện chính là **điểm đồng bộ** (synchronization). Nó tạo ra quan hệ **"happens-before"**: mọi thứ A làm **trước** cuộc gọi đều **nhìn thấy được** với B **sau** cuộc gọi.

**Quy tắc vàng của Go Memory Model**:

> Nếu một biến được **nhiều goroutine** truy cập và **ít nhất một** goroutine **ghi**, thì mọi truy cập phải được **sắp thứ tự bằng đồng bộ hóa** (channel, mutex, atomic, WaitGroup...). Nếu không → **data race** → hành vi không xác định.

### Những "cuộc gọi điện" Go đảm bảo

| Sự kiện A | happens-before | Sự kiện B |
|-----------|----------------|-----------|
| Lệnh `go f()` | → | `f` bắt đầu chạy |
| **Gửi** vào channel | → | **Nhận** tương ứng hoàn tất |
| `close(ch)` | → | Lần nhận trả về zero value vì channel đã đóng |
| **Nhận** từ unbuffered channel | → | **Gửi** tương ứng hoàn tất |
| `mu.Unlock()` | → | Lần `mu.Lock()` tiếp theo trả về |
| `wg.Done()` | → | `wg.Wait()` trả về |
| Hàm trong `once.Do(f)` chạy xong | → | Mọi lời gọi `once.Do` trả về |
| `atomic.Store` / `Add` | → | `atomic.Load` thấy giá trị đó |
| `g.Go(f)` chạy xong `f` | → | `g.Wait()` (errgroup) trả về |

Sửa ví dụ trên bằng channel:

```go
var data string
done := make(chan struct{})

go func() {
	data = "xin chào" // (1) Ghi dữ liệu
	close(done)       // (2) "Gọi điện": close happens-before lần nhận bên dưới
}()

<-done            // (3) Nhận xong → CHẮC CHẮN thấy mọi thứ đã ghi trước (2)
fmt.Println(data) // ✅ Luôn in "xin chào"
```

### 💡 Tips quan trọng

- ✅ Bạn **không cần** thuộc lòng memory model. Chỉ cần nhớ: **dữ liệu dùng chung → phải có đồng bộ**, và **`go test -race`** sẽ bắt lỗi giúp bạn
- ✅ Sau `wg.Wait()` / `g.Wait()`, goroutine chính **được phép đọc** mọi thứ các goroutine con đã ghi - đó là lý do ta có thể cho mỗi goroutine ghi vào **một ô riêng** của slice mà không cần mutex (sẽ gặp ở mục 6)
- ❌ Đừng dùng `time.Sleep` để "đồng bộ" - sleep **không tạo** quan hệ happens-before
- ❌ Đừng tự viết vòng lặp chờ kiểu `for !ready {}` - dùng channel, `sync.Cond` hoặc `atomic.Bool`

## 📖 3. Pipeline nâng cao - Dây chuyền có thể dừng giữa chừng

Ở [Bài 8](./08-concurrency.md) bạn đã thấy pipeline đơn giản: mỗi giai đoạn đọc từ channel vào, ghi ra channel ra. Nhưng pipeline đó có một **lỗ hổng**: nếu người tiêu thụ cuối cùng **bỏ về giữa chừng** (ví dụ chỉ cần 5 kết quả đầu), các giai đoạn phía trước sẽ **kẹt mãi ở lệnh gửi** → goroutine leak.

> 💡 **Ví von**: Dây chuyền làm bánh có 3 công nhân: nhào bột → nướng → đóng hộp. Khách nói "đủ 5 hộp rồi, cảm ơn!" và đi về. Nếu không ai **thông báo**, công nhân nhào bột vẫn tiếp tục nhào, người nướng cầm khay bánh đứng chờ **mãi mãi** vì không ai nhận. `context` chính là **chiếc loa thông báo** "dừng dây chuyền!".

**Quy tắc cho mỗi giai đoạn**:
1. Nhận `ctx` và channel đầu vào, **trả về** channel đầu ra (`<-chan T`)
2. Tự tạo goroutine bên trong, **`defer close(out)`**
3. **Mọi lệnh gửi** đều nằm trong `select` với `case <-ctx.Done(): return`

```go
package main

import (
	"context"
	"fmt"
	"runtime"
	"time"
)

// generate - Giai đoạn 1: phát ra 1, 2, 3, ... vô hạn cho đến khi ctx bị hủy
func generate(ctx context.Context) <-chan int {
	out := make(chan int)
	go func() {
		defer close(out) // Người gửi đóng channel khi xong
		for i := 1; ; i++ {
			select {
			case out <- i: // Gửi được thì tiếp tục
			case <-ctx.Done(): // Bị hủy thì dừng ngay, không kẹt ở lệnh gửi
				return
			}
		}
	}()
	return out
}

// square - Giai đoạn 2: bình phương từng số
func square(ctx context.Context, in <-chan int) <-chan int {
	out := make(chan int)
	go func() {
		defer close(out)
		for n := range in {
			select {
			case out <- n * n:
			case <-ctx.Done():
				return
			}
		}
	}()
	return out
}

// filter - Giai đoạn 3: chỉ giữ lại số thỏa điều kiện keep
func filter(ctx context.Context, in <-chan int, keep func(int) bool) <-chan int {
	out := make(chan int)
	go func() {
		defer close(out)
		for n := range in {
			if !keep(n) {
				continue
			}
			select {
			case out <- n:
			case <-ctx.Done():
				return
			}
		}
	}()
	return out
}

func main() {
	fmt.Println("Goroutine lúc đầu:", runtime.NumGoroutine())

	ctx, cancel := context.WithCancel(context.Background())

	// Nối các giai đoạn: generate → square → filter(chẵn)
	evens := filter(ctx, square(ctx, generate(ctx)), func(n int) bool { return n%2 == 0 })

	// Chỉ lấy 5 kết quả đầu tiên rồi "bỏ về"
	for range 5 {
		fmt.Println(<-evens)
	}
	fmt.Println("Goroutine khi pipeline đang chạy:", runtime.NumGoroutine())

	cancel()                          // Báo cho MỌI giai đoạn: dừng lại!
	time.Sleep(50 * time.Millisecond) // Chỉ để demo: cho các goroutine kịp thoát
	fmt.Println("Goroutine sau khi cancel:", runtime.NumGoroutine())
}

// Output:
// Goroutine lúc đầu: 1
// 4
// 16
// 36
// 64
// 100
// Goroutine khi pipeline đang chạy: 4
// Goroutine sau khi cancel: 1
```

**Phân tích**:

- `generate` là nguồn **vô hạn** - không có `ctx`, nó sẽ chạy mãi mãi
- Khi `main` gọi `cancel()`, cả 3 goroutine đang kẹt ở `out <- ...` đều nhận được `ctx.Done()` → `return` → `defer close(out)` chạy → giai đoạn sau thấy channel đóng → cũng thoát. **Cả dây chuyền dừng gọn gàng**
- Số goroutine từ 4 (main + 3 giai đoạn) quay về 1 - **không leak**
- `time.Sleep(50ms)` ở cuối **chỉ để demo** đếm goroutine; code thật không cần

> 💡 **Tại sao hàm trả về `<-chan int` (chỉ nhận)?** Để người gọi **không thể** vô tình gửi vào hoặc đóng channel của giai đoạn - compiler bảo vệ bạn. Đây là quy ước rất phổ biến: **"ai tạo channel, người đó đóng"**.

## 📖 4. Fan-out / Fan-in - Chia việc và gộp kết quả

- **Fan-out** (xòe ra): **nhiều** goroutine cùng đọc từ **một** channel → chia việc tự động (ai rảnh thì lấy)
- **Fan-in** (gom lại): gộp **nhiều** channel kết quả thành **một** channel

> 💡 **Ví von**: Quầy thu ngân siêu thị. **Fan-out**: một hàng khách dài được chia cho 4 quầy. **Fan-in**: tiền của 4 quầy cuối ngày được gom về **một két sắt** chung.

```text
                     ┌──► worker 1 ──┐
images ──(fan-out)───┼──► worker 2 ──┼──(fan-in: merge)──► kết quả
                     ├──► worker 3 ──┤
                     └──► worker 4 ──┘
```

```go
package main

import (
	"context"
	"fmt"
	"slices"
	"sync"
	"time"
)

type Result struct {
	Image  string
	Worker int
}

// resizeWorker - một "đầu bếp" lấy ảnh từ hàng đợi chung và xử lý
func resizeWorker(ctx context.Context, id int, images <-chan string) <-chan Result {
	out := make(chan Result)
	go func() {
		defer close(out)
		for img := range images {
			time.Sleep(100 * time.Millisecond) // Giả lập resize ảnh mất 100ms
			select {
			case out <- Result{Image: img, Worker: id}:
			case <-ctx.Done():
				return
			}
		}
	}()
	return out
}

// merge (FAN-IN) gộp nhiều channel thành một channel duy nhất
func merge[T any](ctx context.Context, channels ...<-chan T) <-chan T {
	out := make(chan T)
	var wg sync.WaitGroup
	wg.Add(len(channels))
	for _, ch := range channels {
		go func() { // Mỗi channel đầu vào có một goroutine "chuyển tiếp"
			defer wg.Done()
			for v := range ch {
				select {
				case out <- v:
				case <-ctx.Done():
					return
				}
			}
		}()
	}
	// Khi TẤT CẢ channel đầu vào đã cạn → đóng out
	go func() {
		wg.Wait()
		close(out)
	}()
	return out
}

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Nguồn: 8 ảnh cần xử lý
	images := make(chan string)
	go func() {
		defer close(images)
		for i := 1; i <= 8; i++ {
			images <- fmt.Sprintf("img%02d.jpg", i)
		}
	}()

	// FAN-OUT: 4 worker cùng đọc từ MỘT channel images
	start := time.Now()
	var workers []<-chan Result
	for id := 1; id <= 4; id++ {
		workers = append(workers, resizeWorker(ctx, id, images))
	}

	// FAN-IN: gộp kết quả của 4 worker về một chỗ
	var done []string
	for r := range merge(ctx, workers...) {
		done = append(done, r.Image)
	}

	slices.Sort(done) // Thứ tự hoàn thành là ngẫu nhiên → sắp xếp để in cho đẹp
	fmt.Println("Đã xử lý:", done)
	fmt.Printf("Thời gian: ~%v (tuần tự sẽ mất 800ms)\n", time.Since(start).Round(100*time.Millisecond))
}

// Output:
// Đã xử lý: [img01.jpg img02.jpg img03.jpg img04.jpg img05.jpg img06.jpg img07.jpg img08.jpg]
// Thời gian: ~200ms (tuần tự sẽ mất 800ms)
```

**Điểm mấu chốt của hàm `merge`**:

- Mỗi channel đầu vào có **một goroutine chuyển tiếp** sang `out`
- `WaitGroup` đếm số goroutine chuyển tiếp; khi **tất cả** xong → một goroutine riêng `close(out)`. Nếu `close(out)` sớm hơn → panic "send on closed channel"
- `merge` là **generic** (`[T any]`) - dùng được cho mọi kiểu. Đây là một chỗ generics phát huy tác dụng thật sự (xem thêm [Bài 15](./15-generics-reflection-stdlib.md))

> ⚠️ **Fan-out có giới hạn tự nhiên**: số worker bạn tạo chính là số việc tối đa chạy cùng lúc. Nhưng nếu mỗi việc lại tự "đẻ" thêm goroutine (như crawler), bạn cần **semaphore** - mục tiếp theo.

## 📖 5. Bounded Parallelism - Giới hạn số việc chạy song song

### Tại sao phải giới hạn?

Goroutine rẻ, nhưng **tài nguyên phía sau thì không**:
- Mở 10.000 kết nối HTTP cùng lúc → server bên kia chặn bạn (hoặc sập)
- Mở 10.000 file cùng lúc → lỗi `too many open files`
- Resize 10.000 ảnh cùng lúc → hết RAM
- Database chỉ cho phép 100 kết nối

> 💡 **Ví von**: Bãi giữ xe có **3 chỗ**. Xe đến thì lấy vé; hết vé thì đứng chờ ngoài cổng; xe ra thì trả vé cho xe sau. **Semaphore** chính là "hộp vé" đó.

### 5.1 Semaphore bằng buffered channel

Cách "thuần Go", không cần thư viện: buffered channel có sức chứa N. Gửi vào = **lấy vé** (chặn khi đầy), nhận ra = **trả vé**.

```go
package main

import (
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

func main() {
	const maxConcurrent = 3
	sem := make(chan struct{}, maxConcurrent) // Buffered channel = "bãi giữ xe 3 chỗ"

	var (
		wg      sync.WaitGroup
		running atomic.Int64 // Số tác vụ đang chạy
		peak    atomic.Int64 // Số tác vụ chạy cùng lúc nhiều nhất
	)

	start := time.Now()
	for i := 1; i <= 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()

			sem <- struct{}{}        // Lấy 1 "vé" (chặn nếu đã đủ 3 người)
			defer func() { <-sem }() // Trả "vé" khi xong

			now := running.Add(1)
			// Cập nhật peak nếu now lớn hơn (vòng lặp CAS - xem mục atomic)
			for {
				old := peak.Load()
				if now <= old || peak.CompareAndSwap(old, now) {
					break
				}
			}
			time.Sleep(50 * time.Millisecond) // Giả lập công việc
			running.Add(-1)
		}()
	}
	wg.Wait()

	fmt.Println("Hoàn thành 10 tác vụ")
	fmt.Println("Chạy đồng thời tối đa:", peak.Load())
	fmt.Printf("Thời gian: ~%v (10 việc / 3 luồng = 4 lượt × 50ms)\n",
		time.Since(start).Round(50*time.Millisecond))
}

// Output:
// Hoàn thành 10 tác vụ
// Chạy đồng thời tối đa: 3
// Thời gian: ~200ms (10 việc / 3 luồng = 4 lượt × 50ms)
```

> 💡 **`struct{}`** là kiểu **không tốn byte nào** - hoàn hảo cho channel chỉ dùng để "đếm" hoặc "báo hiệu" mà không cần mang dữ liệu.

**So sánh với worker pool** ([Bài 8](./08-concurrency.md)):

| | Worker pool | Semaphore |
|---|------------|-----------|
| Số goroutine | Cố định N | Một goroutine / việc (nhưng chỉ N chạy thật sự) |
| Hợp với | Hàng đợi việc dài, đồng nhất | Việc "mọc ra" động (crawler, đệ quy) |
| Code | Cần channel jobs + results | Chỉ thêm 2 dòng vào code sẵn có |

### 5.2 `golang.org/x/sync/semaphore` - Semaphore có trọng số

Package `golang.org/x/sync` là thư viện **bán chính thức** do chính Go team duy trì (các package `x/...` là "phòng thí nghiệm" của thư viện chuẩn). Cài đặt:

```bash
go get golang.org/x/sync
```

> ⚠️ **Lưu ý phiên bản**: Các bản mới nhất của `golang.org/x/...` thường yêu cầu Go mới nhất. Nếu bạn dùng Go 1.24, lệnh `go get ...@latest` có thể tự tải toolchain mới hơn và sửa dòng `go` trong `go.mod` (nhờ cơ chế `GOTOOLCHAIN=auto`). Muốn giữ nguyên Go 1.24, hãy chọn phiên bản cụ thể: `go get golang.org/x/sync@v0.19.0` và `go get golang.org/x/time@v0.14.0`.

Khác với "vé" bằng channel (mỗi việc lấy 1 vé), `semaphore.Weighted` cho phép mỗi việc lấy **số vé khác nhau**. Rất hợp khi các việc có "độ nặng" khác nhau - ví dụ giới hạn **tổng RAM** dùng cùng lúc:

```go
package main

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"golang.org/x/sync/semaphore"
)

type Job struct {
	Name     string
	MemoryMB int64 // Mỗi job "ngốn" một lượng RAM khác nhau
}

func main() {
	const budgetMB = 100
	sem := semaphore.NewWeighted(budgetMB) // Tổng "trọng số" tối đa là 100

	jobs := []Job{
		{"video-4k", 70}, {"thumbnail", 10}, {"pdf-lớn", 50},
		{"avatar", 5}, {"zip", 40}, {"báo-cáo", 30},
	}

	ctx := context.Background()
	var (
		wg     sync.WaitGroup
		inUse  atomic.Int64
		peakMB atomic.Int64
	)

	for _, job := range jobs {
		// Acquire chặn cho đến khi còn đủ "chỗ" cho job này (hoặc ctx bị hủy)
		if err := sem.Acquire(ctx, job.MemoryMB); err != nil {
			fmt.Println("Không thể lấy semaphore:", err)
			break
		}
		wg.Add(1)
		go func() {
			defer wg.Done()
			defer sem.Release(job.MemoryMB) // Trả lại đúng lượng đã lấy

			now := inUse.Add(job.MemoryMB)
			for {
				old := peakMB.Load()
				if now <= old || peakMB.CompareAndSwap(old, now) {
					break
				}
			}
			time.Sleep(30 * time.Millisecond) // Giả lập xử lý
			inUse.Add(-job.MemoryMB)
		}()
	}
	wg.Wait()

	// TryAcquire: không chờ, trả về false ngay nếu không đủ chỗ
	fmt.Println("TryAcquire(101):", sem.TryAcquire(101))
	fmt.Println("TryAcquire(100):", sem.TryAcquire(100))
	sem.Release(100)

	fmt.Println("RAM dùng cùng lúc không vượt ngân sách:", peakMB.Load() <= budgetMB)
}

// Output:
// TryAcquire(101): false
// TryAcquire(100): true
// RAM dùng cùng lúc không vượt ngân sách: true
```

| Method | Ý nghĩa |
|--------|---------|
| `NewWeighted(n)` | Tạo semaphore có tổng trọng số `n` |
| `Acquire(ctx, w)` | Lấy `w` đơn vị, **chặn** đến khi đủ hoặc `ctx` bị hủy (trả về `ctx.Err()`) |
| `TryAcquire(w)` | Thử lấy, **không chặn**, trả về `bool` |
| `Release(w)` | Trả lại `w` đơn vị |

> 💡 Điểm mạnh so với channel: `Acquire` **nhận `ctx`** → khi người dùng hủy request, các việc đang xếp hàng chờ "vé" cũng được giải phóng ngay.

## 📖 6. `errgroup` - WaitGroup "có não" ⭐

### Vấn đề với `sync.WaitGroup`

Gọi 3 API song song bằng `WaitGroup`, bạn sẽ phải tự:
1. Tạo biến lưu lỗi + mutex bảo vệ nó
2. Nghĩ cách **hủy** các API còn lại khi một cái lỗi
3. Tự giới hạn số goroutine

`golang.org/x/sync/errgroup` làm **cả 3 việc** trong vài dòng:

| API | Ý nghĩa |
|-----|---------|
| `var g errgroup.Group` | Nhóm goroutine (zero value dùng được ngay) |
| `g.Go(func() error)` | Chạy hàm trong goroutine mới (tự `Add`/`Done`) |
| `g.Wait() error` | Chờ tất cả, trả về **lỗi đầu tiên** (hoặc `nil`) |
| `errgroup.WithContext(ctx)` | Trả về `g` và `ctx` con - **tự hủy `ctx`** khi có goroutine trả lỗi đầu tiên |
| `g.SetLimit(n)` | Tối đa `n` goroutine chạy cùng lúc; `g.Go` sẽ **chặn** khi đủ |
| `g.TryGo(f) bool` | Như `Go` nhưng không chặn, trả `false` nếu đã đủ giới hạn |

> 💡 **Ví von**: `WaitGroup` là người quản lý chỉ biết **đếm** nhân viên đã về chưa. `errgroup.WithContext` là người quản lý biết **lắng nghe**: khi một nhân viên báo "có sự cố!", anh ta lập tức **gọi tất cả về** và báo cáo sự cố đó lên cấp trên.

```go
package main

import (
	"context"
	"errors"
	"fmt"
	"sync/atomic"
	"time"

	"golang.org/x/sync/errgroup"
)

// fetch giả lập gọi một service mất thời gian d, có thể lỗi
func fetch(ctx context.Context, name string, d time.Duration, fail bool) (string, error) {
	select {
	case <-time.After(d):
		if fail {
			return "", fmt.Errorf("%s: lỗi 500", name)
		}
		return name + " OK", nil
	case <-ctx.Done(): // Bị hủy giữa chừng → dừng ngay, không làm tiếp
		fmt.Printf("   ⛔ %s bị hủy (lẽ ra mất %v)\n", name, d)
		return "", ctx.Err()
	}
}

func demoBasic() {
	fmt.Println("1) errgroup cơ bản - tất cả thành công")
	names := []string{"users", "orders", "products"}
	results := make([]string, len(names)) // Mỗi goroutine ghi vào MỘT ô riêng → không cần mutex

	var g errgroup.Group
	for i, name := range names {
		g.Go(func() error {
			r, err := fetch(context.Background(), name, 50*time.Millisecond, false)
			if err != nil {
				return err
			}
			results[i] = r
			return nil
		})
	}
	if err := g.Wait(); err != nil { // Wait = wg.Wait() + trả về lỗi ĐẦU TIÊN
		fmt.Println("   Lỗi:", err)
		return
	}
	fmt.Println("  ", results)
}

func demoWithContext() {
	fmt.Println("2) errgroup.WithContext - một lỗi hủy tất cả")
	g, ctx := errgroup.WithContext(context.Background())

	g.Go(func() error {
		_, err := fetch(ctx, "payment", 50*time.Millisecond, true) // Lỗi sau 50ms
		return err
	})
	g.Go(func() error {
		_, err := fetch(ctx, "report", 500*time.Millisecond, false) // Việc chậm
		return err
	})

	start := time.Now()
	err := g.Wait()
	fmt.Println("   Lỗi đầu tiên:", err)
	fmt.Println("   Là context.Canceled?", errors.Is(err, context.Canceled))
	fmt.Printf("   Kết thúc sau ~%v thay vì 500ms\n", time.Since(start).Round(50*time.Millisecond))
}

func demoSetLimit() {
	fmt.Println("3) SetLimit - tối đa 2 goroutine cùng lúc")
	var g errgroup.Group
	g.SetLimit(2) // g.Go sẽ CHẶN nếu đã có 2 goroutine đang chạy

	var running, peak atomic.Int64
	for range 6 {
		g.Go(func() error {
			now := running.Add(1)
			for {
				old := peak.Load()
				if now <= old || peak.CompareAndSwap(old, now) {
					break
				}
			}
			time.Sleep(20 * time.Millisecond)
			running.Add(-1)
			return nil
		})
	}
	_ = g.Wait()
	fmt.Println("   Đồng thời tối đa:", peak.Load())
}

func main() {
	demoBasic()
	demoWithContext()
	demoSetLimit()
}

// Output:
// 1) errgroup cơ bản - tất cả thành công
//    [users OK orders OK products OK]
// 2) errgroup.WithContext - một lỗi hủy tất cả
//    ⛔ report bị hủy (lẽ ra mất 500ms)
//    Lỗi đầu tiên: payment: lỗi 500
//    Là context.Canceled? false
//    Kết thúc sau ~50ms thay vì 500ms
// 3) SetLimit - tối đa 2 goroutine cùng lúc
//    Đồng thời tối đa: 2
```

**Phân tích từng phần**:

1. **Cơ bản**: Mỗi goroutine ghi vào `results[i]` - **ô riêng** của slice → không cần mutex. Sau `g.Wait()`, main đọc được an toàn nhờ quan hệ happens-before (mục 2)
2. **WithContext**: `payment` lỗi sau 50ms → errgroup **hủy `ctx`** → `report` đang chờ 500ms thấy `ctx.Done()` và thoát ngay. `g.Wait()` trả về **lỗi đầu tiên** (`payment: lỗi 500`), **không phải** `context.Canceled` của `report`
3. **SetLimit**: 6 việc nhưng chỉ 2 chạy cùng lúc - thay thế hoàn toàn cho semaphore tự viết

> ⚠️ **Hai cái bẫy của `WithContext`**:
> - Biến `ctx` mà `WithContext` trả về sẽ **bị hủy khi `Wait` trả về** (kể cả khi thành công). **Đừng dùng lại** nó sau `Wait`
> - Goroutine phải **thực sự tôn trọng `ctx`** (truyền vào HTTP request, DB query, `select`...). Nếu goroutine lờ `ctx` đi, errgroup không thể "giết" nó - Go **không có cách** dừng goroutine từ bên ngoài

## 📖 7. Bộ công cụ `sync` nâng cao

### 7.1 `sync.Once`, `OnceValue`, `OnceValues` - Làm đúng một lần

Bài toán: khởi tạo "lười" (lazy) một thứ tốn kém - đọc cấu hình, kết nối DB, nạp template - **chỉ khi cần** và **chỉ một lần**, dù nhiều goroutine cùng gọi.

```go
package main

import (
	"fmt"
	"sync"
)

type Config struct {
	DBURL string
	Port  int
}

var (
	cfg     *Config
	cfgOnce sync.Once
)

// GetConfig: nhiều goroutine gọi cùng lúc nhưng chỉ đọc cấu hình ĐÚNG MỘT LẦN
func GetConfig() *Config {
	cfgOnce.Do(func() {
		fmt.Println("⏳ Đang đọc cấu hình (chỉ in 1 lần)...")
		cfg = &Config{DBURL: "postgres://localhost/app", Port: 8080}
	})
	return cfg
}

// Go 1.21+: sync.OnceValue gói gọn "tính một lần, trả về giá trị" trong 1 dòng
var loadTemplates = sync.OnceValue(func() map[string]string {
	fmt.Println("⏳ Đang nạp template (chỉ in 1 lần)...")
	return map[string]string{"welcome": "Xin chào {{.Name}}"}
})

func main() {
	var wg sync.WaitGroup
	for range 10 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_ = GetConfig() // 10 goroutine cùng gọi
		}()
	}
	wg.Wait()
	fmt.Println("Port:", GetConfig().Port)

	fmt.Println(loadTemplates()["welcome"])
	fmt.Println(len(loadTemplates()), "template") // Lần 2: không nạp lại
}

// Output:
// ⏳ Đang đọc cấu hình (chỉ in 1 lần)...
// Port: 8080
// ⏳ Đang nạp template (chỉ in 1 lần)...
// Xin chào {{.Name}}
// 1 template
```

- `once.Do(f)`: `f` chạy **đúng một lần**; các goroutine khác gọi cùng lúc sẽ **chờ** `f` chạy xong rồi mới trả về (nên luôn thấy `cfg` đã khởi tạo)
- `sync.OnceValue(f)` (Go 1.21+): trả về **một hàm**; lần đầu gọi thì chạy `f`, các lần sau trả về kết quả đã nhớ - gọn hơn nhiều so với tự khai báo biến + `Once`
- `sync.OnceValues(f)`: như trên nhưng cho hàm trả về **hai giá trị**, thường là `(T, error)`: `var loadKey = sync.OnceValues(func() ([]byte, error) { return os.ReadFile("key.pem") })`

> ⚠️ Nếu `f` **panic** hoặc trả lỗi, `Once` **vẫn coi là đã chạy** - lần sau sẽ không thử lại. Nếu bạn cần "thử lại khi lỗi", đừng dùng `Once`.

### 7.2 `sync.RWMutex` - Nhiều người đọc cùng lúc

Bạn đã gặp `RWMutex` ở [Bài 8](./08-concurrency.md): `RLock` cho phép **nhiều người đọc cùng lúc**, `Lock` là **độc quyền**. Nếu 5 goroutine cùng đọc, mỗi lần giữ khóa 50ms: với `Mutex` mất ~250ms (xếp hàng), với `RWMutex` chỉ ~50ms (đọc song song). Bạn sẽ thấy `RWMutex` trong thực tế ở **Ứng dụng 4** (cache TTL).

**Khi nào `RWMutex` KHÔNG nhanh hơn?**
- Khi đoạn code trong khóa **rất ngắn** (vài nanosecond): chi phí quản lý của `RWMutex` cao hơn `Mutex` → chậm hơn
- Khi **ghi nhiều**: người ghi phải chờ **tất cả** người đọc xong
- ➡️ Mặc định dùng `Mutex`. Chỉ chuyển sang `RWMutex` khi **đọc nhiều hơn ghi rõ rệt** và **đã đo** bằng benchmark

> ⚠️ **Không "nâng cấp" khóa**: đang giữ `RLock` mà gọi `Lock` → **deadlock** (Lock chờ mọi RLock nhả, kể cả chính bạn). Phải `RUnlock` trước rồi mới `Lock`, và nhớ **kiểm tra lại** điều kiện sau khi `Lock`.

### 7.3 `sync/atomic` - Thao tác "nguyên tử"

**Nguyên tử (atomic)** = không thể bị chia cắt. `counter++` thực ra là 3 bước: **đọc** → **cộng** → **ghi**. Hai goroutine có thể xen vào giữa → mất cập nhật. Thao tác atomic làm cả 3 bước như **một bước duy nhất** ở cấp phần cứng - nhanh hơn Mutex nhiều.

Từ Go 1.19, dùng các **kiểu** atomic (an toàn hơn các hàm cũ như `atomic.AddInt64(&x, 1)` vì không thể vô tình truy cập trực tiếp):

| Kiểu | Method chính |
|------|--------------|
| `atomic.Int32`, `atomic.Int64`, `atomic.Uint64` | `Load`, `Store`, `Add`, `Swap`, `CompareAndSwap` |
| `atomic.Bool` | `Load`, `Store`, `Swap`, `CompareAndSwap` |
| `atomic.Pointer[T]` | `Load`, `Store`, `Swap`, `CompareAndSwap` |
| `atomic.Value` | Như `Pointer` nhưng cho `any` (kiểu cũ, ưu tiên `Pointer[T]`) |

```go
package main

import (
	"fmt"
	"sync"
	"sync/atomic"
)

type Config struct {
	Version  int
	MaxUsers int
}

type Stats struct {
	requests atomic.Int64 // Bộ đếm: thao tác "đọc-sửa-ghi" trong MỘT bước không thể chia cắt
	errors   atomic.Int64
	shutdown atomic.Bool            // Cờ bật/tắt
	config   atomic.Pointer[Config] // Con trỏ có thể thay cả "khối" cấu hình
}

func main() {
	var s Stats
	s.config.Store(&Config{Version: 1, MaxUsers: 100})

	var wg sync.WaitGroup
	for i := range 1000 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			s.requests.Add(1)
			if i%10 == 0 {
				s.errors.Add(1)
			}
			// Đọc cấu hình: không cần khóa, luôn thấy một Config HOÀN CHỈNH
			_ = s.config.Load().MaxUsers
		}()
	}

	// "Hot reload": thay cấu hình mới trong khi các goroutine vẫn đang đọc
	s.config.Store(&Config{Version: 2, MaxUsers: 500})
	wg.Wait()

	fmt.Println("Requests:", s.requests.Load())
	fmt.Println("Errors:", s.errors.Load())
	fmt.Println("Config version:", s.config.Load().Version)

	// CompareAndSwap: "nếu giá trị hiện tại là old thì đổi thành new"
	fmt.Println("Tắt lần 1:", s.shutdown.CompareAndSwap(false, true)) // true: mình là người tắt
	fmt.Println("Tắt lần 2:", s.shutdown.CompareAndSwap(false, true)) // false: đã có người tắt rồi

	// Swap: gán giá trị mới, trả về giá trị cũ
	old := s.requests.Swap(0)
	fmt.Println("Reset bộ đếm, giá trị cũ:", old, "- mới:", s.requests.Load())
}

// Output:
// Requests: 1000
// Errors: 100
// Config version: 2
// Tắt lần 1: true
// Tắt lần 2: false
// Reset bộ đếm, giá trị cũ: 1000 - mới: 0
```

**CompareAndSwap (CAS)** là "viên gạch" của mọi thuật toán lock-free: *"Nếu giá trị hiện tại vẫn là `old` (chưa ai đổi) thì đổi thành `new`"*. Bạn đã thấy nó ở ví dụ semaphore: vòng lặp CAS để cập nhật `peak` (giá trị lớn nhất) an toàn.

**`atomic.Pointer[Config]`** là pattern rất hay cho **cấu hình nạp lại nóng** (hot reload): tạo một `Config` **mới hoàn toàn** rồi `Store` con trỏ. Người đọc luôn thấy **hoặc bản cũ, hoặc bản mới**, không bao giờ thấy bản "nửa nọ nửa kia". Quy tắc: **không bao giờ sửa** struct sau khi đã `Store`.

> ⚠️ Atomic chỉ bảo vệ **một biến**. Nếu cần cập nhật **nhiều biến cùng lúc** một cách nhất quán (ví dụ trừ tiền tài khoản A, cộng tài khoản B), hãy dùng **Mutex**.

### 7.4 `sync.Pool` - Tái sử dụng object, giảm áp lực GC

Mỗi lần `new(bytes.Buffer)` là một lần **cấp phát bộ nhớ**, sau đó **Garbage Collector** (GC) phải dọn. Với server xử lý 100.000 request/giây, điều này tạo áp lực GC lớn. `sync.Pool` là "**kho đồ dùng chung**": dùng xong trả lại, người sau lấy ra dùng tiếp.

> 💡 **Ví von**: Quán cà phê có **kệ cốc sạch**. Khách lấy cốc, uống xong trả lại, nhân viên **rửa** (`Reset`) rồi đặt lên kệ. Không cần mua cốc mới cho mỗi khách. Nhưng thỉnh thoảng quản lý **dọn bớt** cốc thừa (GC có thể xóa đồ trong pool bất cứ lúc nào).

```go
package main

import (
	"bytes"
	"fmt"
	"sync"
)

// bufPool giữ các *bytes.Buffer đã dùng xong để TÁI SỬ DỤNG
var bufPool = sync.Pool{
	// New được gọi khi pool rỗng
	New: func() any {
		fmt.Println("  (tạo buffer mới)")
		return new(bytes.Buffer)
	},
}

// renderRow dựng một dòng CSV bằng buffer lấy từ pool
func renderRow(id int, name string) string {
	buf := bufPool.Get().(*bytes.Buffer) // Lấy ra (có thể là buffer cũ)
	defer bufPool.Put(buf)               // Trả lại khi xong
	buf.Reset()                          // ⚠️ BẮT BUỘC: xóa dữ liệu của lần dùng trước

	fmt.Fprintf(buf, "%d,%s", id, name)
	return buf.String() // String() tạo bản sao → an toàn khi buffer bị dùng lại
}

func main() {
	fmt.Println(renderRow(1, "An"))
	fmt.Println(renderRow(2, "Bình")) // Thường KHÔNG in "(tạo buffer mới)" lần nữa
	fmt.Println(renderRow(3, "Chi"))
}

// Output (thường gặp):
//   (tạo buffer mới)
// 1,An
// 2,Bình
// 3,Chi
```

Đo bằng benchmark (`main_test.go` cùng thư mục, dùng `b.Loop()` của Go 1.24):

```go
package main

import (
	"bytes"
	"fmt"
	"testing"
)

var sink string

func BenchmarkNoPool(b *testing.B) {
	b.ReportAllocs()
	for i := 0; b.Loop(); i++ {
		buf := new(bytes.Buffer) // Mỗi lần tạo buffer mới → GC phải dọn
		buf.Grow(64)
		fmt.Fprintf(buf, "%d,%s", i, "An")
		sink = buf.String()
	}
}

func BenchmarkWithPool(b *testing.B) {
	b.ReportAllocs()
	for i := 0; b.Loop(); i++ {
		buf := bufPool.Get().(*bytes.Buffer)
		buf.Reset()
		fmt.Fprintf(buf, "%d,%s", i, "An")
		sink = buf.String()
		bufPool.Put(buf)
	}
}
```

```bash
go test -bench . -benchmem
```

```text
BenchmarkNoPool-4     	 5588751	       184.5 ns/op	     135 B/op	       4 allocs/op
  (tạo buffer mới)
  (tạo buffer mới)
  (tạo buffer mới)
  (tạo buffer mới)
BenchmarkWithPool-4   	 9908762	       122.2 ns/op	      23 B/op	       2 allocs/op
PASS
```

Nhanh hơn ~1,5 lần, lượng bộ nhớ cấp phát mỗi lần giảm ~6 lần (số liệu tùy máy). Để ý dòng `(tạo buffer mới)` xuất hiện **vài lần** chứ không phải một: mỗi lần GC chạy, pool có thể bị dọn bớt, nên `New` được gọi lại - đúng như "quản lý dọn bớt cốc thừa".

**Quy tắc dùng `sync.Pool`**:
- ✅ Luôn **`Reset()`** object sau khi `Get` (hoặc trước khi `Put`) - nếu không, dữ liệu cũ "rò" sang request sau (có thể là **lỗ hổng bảo mật**!)
- ✅ Chỉ dùng cho object **tạm thời**, tạo ra **rất thường xuyên** (buffer, encoder...)
- ❌ **Không** dùng làm connection pool hay cache - GC có thể xóa sạch pool bất cứ lúc nào
- ❌ **Không** giữ tham chiếu tới object sau khi `Put`
- ❌ Đừng dùng khi chưa đo - thường chỉ đáng khi benchmark/profiling chỉ ra GC là nút thắt

### 7.5 `sync.Cond` - Chờ một điều kiện (giới thiệu ngắn)

`sync.Cond` cho phép goroutine **ngủ** cho đến khi một **điều kiện** trở thành đúng, và được **đánh thức** bởi goroutine khác (`Signal` đánh thức 1, `Broadcast` đánh thức tất cả).

```go
type Queue struct {
	mu    sync.Mutex
	cond  *sync.Cond // Tạo bằng sync.NewCond(&q.mu) - Cond gắn với một Locker
	items []string
}

func (q *Queue) Put(item string) {
	q.mu.Lock()
	q.items = append(q.items, item)
	q.mu.Unlock()
	q.cond.Signal() // Đánh thức MỘT goroutine đang Wait (Broadcast: đánh thức tất cả)
}

func (q *Queue) Get() string {
	q.mu.Lock()
	defer q.mu.Unlock()
	for len(q.items) == 0 { // ⚠️ Luôn Wait trong vòng FOR, không phải if
		q.cond.Wait() // Tự Unlock → ngủ → khi được đánh thức thì Lock lại
	}
	item := q.items[0]
	q.items = q.items[1:]
	return item
}
```

Tại sao `for` chứ không phải `if`? Khi được đánh thức, **có thể goroutine khác đã lấy mất** món hàng trước bạn - phải kiểm tra lại điều kiện.

> 💡 Trong thực tế, **channel gần như luôn là lựa chọn tốt hơn** `sync.Cond` - dễ đọc, kết hợp được với `select` và `context`. `Cond` chỉ hữu ích khi cần `Broadcast` cho **nhiều** goroutine chờ một trạng thái **thay đổi nhiều lần**. Bạn nên **biết** nó để đọc hiểu code thư viện, nhưng hiếm khi phải tự viết.

## 📖 8. Rate Limiting - Giới hạn tốc độ

**Semaphore** giới hạn **bao nhiêu việc cùng lúc**. **Rate limiter** giới hạn **bao nhiêu việc mỗi giây**. Hai khái niệm khác nhau:

| | Semaphore | Rate limiter |
|---|----------|--------------|
| Giới hạn | Số việc **đồng thời** | Số việc **trong một khoảng thời gian** |
| Ví dụ | "Tối đa 5 kết nối DB" | "Tối đa 100 request/phút tới API GitHub" |

### 8.1 `time.Ticker` - Đơn giản nhất

`time.Ticker` gửi một giá trị vào channel `C` sau mỗi khoảng thời gian cố định - như **máy đếm nhịp** (metronome).

```go
package main

import (
	"fmt"
	"time"
)

func main() {
	requests := make(chan int, 5)
	for i := 1; i <= 5; i++ {
		requests <- i
	}
	close(requests)

	// Mỗi 100ms "nhả" ra 1 lượt → tối đa 10 request/giây
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop() // ⚠️ Luôn Stop ticker khi không dùng nữa

	start := time.Now()
	for req := range requests {
		<-ticker.C // Chờ đến "nhịp" tiếp theo
		fmt.Printf("Xử lý request %d lúc %v\n", req, time.Since(start).Round(100*time.Millisecond))
	}
}

// Output:
// Xử lý request 1 lúc 100ms
// Xử lý request 2 lúc 200ms
// Xử lý request 3 lúc 300ms
// Xử lý request 4 lúc 400ms
// Xử lý request 5 lúc 500ms
```

> ⚠️ Luôn `ticker.Stop()` khi xong. Trong Go 1.23+ ticker không dùng nữa sẽ được GC thu hồi, nhưng `Stop` vẫn là thói quen tốt. Tránh dùng `time.Tick()` trong hàm được gọi nhiều lần.

Nhược điểm của ticker: **không cho phép "bùng nổ" (burst)**. Nếu 1 giây trước không ai gọi, request tiếp theo vẫn phải chờ nhịp.

### 8.2 `golang.org/x/time/rate` - Token bucket

```bash
go get golang.org/x/time/rate
```

Thuật toán **token bucket** (xô token):

> 💡 **Ví von**: Một cái **xô** chứa tối đa `b` đồng xu (burst). Cứ mỗi khoảng thời gian, một đồng xu mới được **thả vào xô** (rate `r`). Mỗi request phải **lấy một đồng xu** mới được đi. Xô đầy thì xu mới rơi ra ngoài. Nhờ vậy: lúc rảnh, xu tích lũy → cho phép một đợt **bùng nổ** ngắn; lúc bận, tốc độ bị giới hạn ở `r`.

```go
package main

import (
	"context"
	"fmt"
	"time"

	"golang.org/x/time/rate"
)

func main() {
	// Token bucket: nạp 1 token mỗi 100ms (10 req/s), xô chứa tối đa 3 token (burst)
	limiter := rate.NewLimiter(rate.Every(100*time.Millisecond), 3)
	ctx := context.Background()

	fmt.Println("== Wait: chờ đến lượt ==")
	start := time.Now()
	for i := 1; i <= 6; i++ {
		if err := limiter.Wait(ctx); err != nil { // Chặn đến khi có token (hoặc ctx hủy)
			fmt.Println("Lỗi:", err)
			return
		}
		fmt.Printf("Request %d lúc %v\n", i, time.Since(start).Round(50*time.Millisecond))
	}

	fmt.Println("== Allow: không chờ, từ chối ngay (kiểu HTTP 429) ==")
	limiter2 := rate.NewLimiter(rate.Every(time.Second), 2)
	for i := 1; i <= 4; i++ {
		if limiter2.Allow() {
			fmt.Printf("Request %d: ✅ cho qua\n", i)
		} else {
			fmt.Printf("Request %d: ❌ 429 Too Many Requests\n", i)
		}
	}
}

// Output:
// == Wait: chờ đến lượt ==
// Request 1 lúc 0s
// Request 2 lúc 0s
// Request 3 lúc 0s
// Request 4 lúc 100ms
// Request 5 lúc 200ms
// Request 6 lúc 300ms
// == Allow: không chờ, từ chối ngay (kiểu HTTP 429) ==
// Request 1: ✅ cho qua
// Request 2: ✅ cho qua
// Request 3: ❌ 429 Too Many Requests
// Request 4: ❌ 429 Too Many Requests
```

| Method | Hành vi | Dùng khi |
|--------|---------|----------|
| `Wait(ctx)` | **Chờ** đến khi có token | Client gọi API bên ngoài (tự "phanh" mình) |
| `Allow()` | Trả `true/false` **ngay lập tức** | Server từ chối request thừa (HTTP 429) |
| `Reserve()` | Đặt chỗ trước, cho biết phải chờ bao lâu | Lập lịch nâng cao |

### 8.3 Rate limit theo từng client (middleware HTTP)

Trên server, bạn thường muốn **mỗi IP / mỗi API key** có limiter riêng:

```go
type IPLimiter struct {
	mu       sync.Mutex
	limiters map[string]*rate.Limiter
}

func (l *IPLimiter) get(ip string) *rate.Limiter {
	l.mu.Lock()
	defer l.mu.Unlock()
	lim, ok := l.limiters[ip]
	if !ok {
		lim = rate.NewLimiter(5, 10) // 5 req/s, burst 10 cho MỖI IP
		l.limiters[ip] = lim
	}
	return lim
}

func (l *IPLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip, _, _ := net.SplitHostPort(r.RemoteAddr)
		if !l.get(ip).Allow() {
			http.Error(w, "quá nhiều request, thử lại sau", http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}
```

> ⚠️ Map `limiters` sẽ **lớn dần mãi** nếu không dọn. Code production cần xóa các IP lâu không hoạt động (giống cách cache TTL ở phần Ứng dụng thực tế dọn key hết hạn), và nếu chạy **nhiều instance** server thì cần limiter dùng chung (Redis...).

## 📖 9. Timeout & truyền tín hiệu hủy qua nhiều tầng

### Context là một cái cây

Mỗi lần gọi `context.WithTimeout/WithCancel(parent)`, bạn tạo một **nhánh con**. Khi **cha bị hủy, mọi con cháu bị hủy theo**; nhưng con bị hủy **không ảnh hưởng** cha.

```text
Background
 └── request ctx (timeout 150ms, do handler đặt)
      ├── service: buildReport(ctx)
      │    ├── repo: queryDB("SELECT users")   ← dùng chung deadline
      │    └── repo: queryDB("SELECT orders")  ← hết giờ giữa chừng → hủy
      └── WithoutCancel → ghi audit log        ← KHÔNG bị hủy theo request
```

> 💡 **Ví von**: Deadline của context giống **giờ đóng cửa của siêu thị**. Dù bạn đang ở quầy nào, tầng nào, khi đến giờ, **tất cả** đều phải dừng. Mỗi tầng code **không tự đặt deadline mới dài hơn** - nó chỉ có thể **rút ngắn** thêm.

### Quy tắc truyền context

1. **Tầng ngoài cùng** (HTTP handler, CLI command, job) **tạo** deadline
2. Mỗi hàm có thể chờ (I/O, gọi mạng, DB, `select`) **nhận `ctx context.Context` làm tham số đầu tiên** và **truyền tiếp** xuống
3. Tầng thấp nhất **thực sự lắng nghe** `ctx.Done()` (hoặc truyền `ctx` cho thư viện: `http.NewRequestWithContext`, `db.QueryContext`...)
4. Lỗi được **bọc** (`%w`) khi đi lên để giữ được `context.DeadlineExceeded` cho `errors.Is`

```go
package main

import (
	"context"
	"errors"
	"fmt"
	"time"
)

var ErrSlowRequest = errors.New("request vượt quá 150ms")

// ===== Tầng Repository: nói chuyện với "database" =====
func queryDB(ctx context.Context, sql string, cost time.Duration) error {
	select {
	case <-time.After(cost): // Giả lập câu truy vấn mất thời gian cost
		fmt.Printf("    ✅ DB xong: %s\n", sql)
		return nil
	case <-ctx.Done(): // Bị hủy từ tầng trên → dừng ngay
		return fmt.Errorf("queryDB(%q): %w", sql, ctx.Err())
	}
}

// ===== Tầng Service: gọi nhiều truy vấn tuần tự =====
func buildReport(ctx context.Context) error {
	// Kiểm tra sớm: nếu ctx đã hủy thì khỏi bắt đầu
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := queryDB(ctx, "SELECT users", 100*time.Millisecond); err != nil {
		return fmt.Errorf("buildReport: %w", err)
	}
	// Truy vấn thứ 2 chỉ còn ~50ms "ngân sách" → sẽ bị hủy
	if err := queryDB(ctx, "SELECT orders", 100*time.Millisecond); err != nil {
		return fmt.Errorf("buildReport: %w", err)
	}
	return nil
}

// ===== Tầng Handler: đặt deadline cho TOÀN BỘ request =====
func handleRequest(parent context.Context) {
	// WithTimeoutCause (Go 1.21+): gắn thêm "lý do" khi hết giờ
	ctx, cancel := context.WithTimeoutCause(parent, 150*time.Millisecond, ErrSlowRequest)
	defer cancel()

	start := time.Now()
	err := buildReport(ctx)
	fmt.Printf("  Kết thúc sau ~%v\n", time.Since(start).Round(50*time.Millisecond))
	if err != nil {
		fmt.Println("  Lỗi:", err)
		fmt.Println("  errors.Is DeadlineExceeded?", errors.Is(err, context.DeadlineExceeded))
		fmt.Println("  Nguyên nhân (context.Cause):", context.Cause(ctx))
	}

	// Việc "chạy nền" KHÔNG được hủy theo request (ví dụ ghi audit log)
	bg := context.WithoutCancel(ctx) // Go 1.21+: giữ values, bỏ deadline/cancel
	fmt.Println("  ctx.Err():", ctx.Err(), "| bg.Err():", bg.Err())
}

func main() {
	fmt.Println("== Request 1 ==")
	handleRequest(context.Background())

	fmt.Println("== Request 2: client đã hủy từ trước ==")
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Giả lập người dùng đóng tab
	fmt.Println("  Lỗi:", buildReport(ctx))
}

// Output:
// == Request 1 ==
//     ✅ DB xong: SELECT users
//   Kết thúc sau ~150ms
//   Lỗi: buildReport: queryDB("SELECT orders"): context deadline exceeded
//   errors.Is DeadlineExceeded? true
//   Nguyên nhân (context.Cause): request vượt quá 150ms
//   ctx.Err(): context deadline exceeded | bg.Err(): <nil>
// == Request 2: client đã hủy từ trước ==
//   Lỗi: context canceled
```

**Các công cụ context mới (Go 1.20-1.21)** đáng biết:

| Hàm | Công dụng |
|-----|-----------|
| `context.WithTimeoutCause(ctx, d, cause)` | Như `WithTimeout` nhưng gắn **lý do** hết giờ |
| `context.WithCancelCause(ctx)` | Hàm cancel nhận `error` làm lý do: `cancel(errors.New("user logout"))` |
| `context.Cause(ctx)` | Lấy lý do hủy (nếu không có thì trả về `ctx.Err()`) |
| `context.WithoutCancel(ctx)` | Context con **giữ values** nhưng **không bị hủy** theo cha - cho việc nền (audit log, gửi email) |
| `context.AfterFunc(ctx, f)` | Chạy `f` trong goroutine mới **khi `ctx` bị hủy** - để dọn dẹp |

> ⚠️ `ctx.Err()` vẫn luôn là `context.DeadlineExceeded` hoặc `context.Canceled` - `Cause` là thông tin **bổ sung**, giúp log dễ debug hơn ("hết giờ vì sao?").

## 📖 10. Graceful Shutdown cho worker

Khi bạn deploy phiên bản mới, Docker/Kubernetes gửi **SIGTERM** cho chương trình cũ, chờ một lúc (mặc định 10s trong Docker, 30s trong Kubernetes), rồi mới **SIGKILL** (giết thẳng). Nếu chương trình thoát ngay khi nhận SIGTERM → **các job đang làm dở bị mất**.

> 💡 **Ví von**: Nhà hàng đến giờ đóng cửa. Cách tệ: **tắt đèn đuổi khách** đang ăn. Cách tốt (graceful): **treo biển "Đã đóng cửa"** (ngừng nhận khách mới), phục vụ nốt những bàn đang ăn, dọn dẹp, rồi mới khóa cửa. Nhưng nếu một bàn ngồi mãi không về - sau 30 phút **vẫn phải khóa cửa** (timeout).

**Công thức 4 bước**:
1. `signal.NotifyContext` biến Ctrl+C / SIGTERM thành `ctx.Done()`
2. **Producer** thấy `ctx.Done()` → ngừng nhận việc mới → `close(jobs)`
3. **Worker** chạy `for job := range jobs` → làm nốt việc còn trong hàng đợi → tự thoát
4. Main chờ `wg.Wait()` **có giới hạn thời gian**

```go
package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

type Job struct{ ID int }

// producer: liên tục nhận job mới (giả lập đọc từ message queue) cho đến khi ctx bị hủy
func producer(ctx context.Context, jobs chan<- Job, received *atomic.Int64) {
	defer close(jobs) // Hết nguồn → đóng channel → worker biết mà dừng
	ticker := time.NewTicker(20 * time.Millisecond)
	defer ticker.Stop()
	for id := 1; ; id++ {
		select {
		case <-ctx.Done():
			fmt.Println("📭 Producer: ngừng nhận job mới")
			return
		case <-ticker.C:
			select {
			case jobs <- Job{ID: id}: // Gửi cũng phải "nhìn" ctx, phòng khi hàng đợi đầy
				received.Add(1)
			case <-ctx.Done():
				fmt.Println("📭 Producer: ngừng nhận job mới")
				return
			}
		}
	}
}

// worker: KHÔNG nhìn ctx - nó xử lý hết mọi job còn trong channel rồi mới về
func worker(id int, jobs <-chan Job, processed *atomic.Int64, wg *sync.WaitGroup) {
	defer wg.Done()
	for job := range jobs {
		time.Sleep(50 * time.Millisecond) // Giả lập xử lý
		_ = job
		processed.Add(1)
	}
	fmt.Printf("👷 Worker %d: xong việc, về nhà\n", id)
}

func main() {
	// Ctrl+C (SIGINT) hoặc SIGTERM (Docker/Kubernetes gửi khi dừng container) → ctx bị hủy
	base, simulateCtrlC := context.WithCancel(context.Background())
	ctx, stop := signal.NotifyContext(base, os.Interrupt, syscall.SIGTERM)
	defer stop()

	time.AfterFunc(300*time.Millisecond, simulateCtrlC) // Chỉ để demo: tự "bấm Ctrl+C" sau 300ms

	var received, processed atomic.Int64
	jobs := make(chan Job, 10) // Hàng đợi có đệm

	var wg sync.WaitGroup
	for i := 1; i <= 3; i++ {
		wg.Add(1)
		go worker(i, jobs, &processed, &wg)
	}
	go producer(ctx, jobs, &received)

	<-ctx.Done()
	fmt.Println("🛑 Nhận tín hiệu dừng, đang chờ worker xử lý nốt...")

	// Chờ worker xong, nhưng không chờ mãi: tối đa 2 giây
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()
	select {
	case <-done:
		fmt.Println("✅ Tắt an toàn. Không mất job nào:", received.Load() == processed.Load())
	case <-time.After(2 * time.Second):
		fmt.Println("⚠️ Hết thời gian chờ, buộc phải thoát")
	}
}

// Output (thứ tự các dòng Producer/Worker có thể khác):
// 🛑 Nhận tín hiệu dừng, đang chờ worker xử lý nốt...
// 📭 Producer: ngừng nhận job mới
// 👷 Worker 3: xong việc, về nhà
// 👷 Worker 1: xong việc, về nhà
// 👷 Worker 2: xong việc, về nhà
// ✅ Tắt an toàn. Không mất job nào: true
```

**Tại sao worker KHÔNG kiểm tra `ctx`?** Đây là quyết định thiết kế:
- **Drain (xả hết hàng đợi)** như ví dụ trên: không mất job nào - hợp khi job đã được "nhận" (ví dụ đã lấy khỏi message queue)
- **Dừng ngay** (worker cũng `select` trên `ctx.Done()`): job còn trong hàng đợi bị bỏ lại - hợp khi job có thể làm lại (ví dụ message queue sẽ giao lại message chưa được xác nhận)

> 💡 `signal.NotifyContext` có sẵn từ Go 1.16. Sau khi nhận tín hiệu lần đầu, nếu bạn gọi `stop()`, lần Ctrl+C thứ hai sẽ giết chương trình ngay theo mặc định - hữu ích khi graceful shutdown bị treo. Bạn sẽ gặp lại pattern này với HTTP server ở [Bài 16](./16-production-ready.md).

## 📖 11. Phát hiện Goroutine Leak

Goroutine leak là loại bug **âm thầm** nhất: không crash, không báo lỗi, chỉ có RAM tăng dần... cho đến khi server bị OOM kill sau 3 ngày.

### Kỹ thuật 1: Đếm bằng `runtime.NumGoroutine()`

Ví dụ kinh điển: gửi request tới 3 bản sao (replica), lấy kết quả **nhanh nhất**.

```go
package main

import (
	"fmt"
	"runtime"
	"time"
)

// queryLeaky gửi truy vấn tới 3 bản sao (replica), lấy kết quả NHANH NHẤT
func queryLeaky() string {
	ch := make(chan string) // ❌ Unbuffered
	for i := 1; i <= 3; i++ {
		go func() {
			time.Sleep(time.Duration(i) * 10 * time.Millisecond)
			ch <- fmt.Sprintf("replica-%d", i) // 2 goroutine chậm kẹt ở đây MÃI MÃI
		}()
	}
	return <-ch // Chỉ nhận 1 lần rồi return
}

// queryFixed: buffered channel đủ chỗ cho TẤT CẢ người gửi → không ai bị kẹt
func queryFixed() string {
	ch := make(chan string, 3) // ✅ Buffer = số goroutine gửi
	for i := 1; i <= 3; i++ {
		go func() {
			time.Sleep(time.Duration(i) * 10 * time.Millisecond)
			ch <- fmt.Sprintf("replica-%d", i) // Luôn gửi được, rồi goroutine kết thúc
		}()
	}
	return <-ch
}

func countAfter(f func() string) int {
	time.Sleep(100 * time.Millisecond) // Chờ các goroutine của lần đo trước kết thúc hẳn
	before := runtime.NumGoroutine()
	for range 10 {
		f()
	}
	time.Sleep(100 * time.Millisecond) // Chờ mọi replica chậm chạy xong
	return runtime.NumGoroutine() - before
}

func main() {
	fmt.Println("Nhanh nhất:", queryFixed())
	fmt.Println("❌ queryLeaky: goroutine bị kẹt =", countAfter(queryLeaky))
	fmt.Println("✅ queryFixed: goroutine bị kẹt =", countAfter(queryFixed))
}

// Output:
// Nhanh nhất: replica-1
// ❌ queryLeaky: goroutine bị kẹt = 20
// ✅ queryFixed: goroutine bị kẹt = 0
```

`queryLeaky` dùng unbuffered channel: chỉ goroutine nhanh nhất gửi được, **2 goroutine còn lại kẹt mãi** ở lệnh gửi. Gọi 10 lần → 20 goroutine rò rỉ. Sửa bằng cách cho channel **đủ chỗ cho mọi người gửi**, hoặc dùng `select` với `ctx.Done()`.

### Kỹ thuật 2: `go.uber.org/goleak` trong test

Thư viện `goleak` (của Uber) kiểm tra **cuối mỗi test** xem còn goroutine "lạ" nào không:

```bash
go get go.uber.org/goleak
```

```go
package main

import (
	"testing"

	"go.uber.org/goleak"
)

func TestQueryFixed_NoLeak(t *testing.T) {
	defer goleak.VerifyNone(t) // Cuối test: báo lỗi nếu còn goroutine "lạ" chưa kết thúc
	if got := queryFixed(); got != "replica-1" {
		t.Fatalf("got %q", got)
	}
}

func TestQueryLeaky_Leak(t *testing.T) {
	defer goleak.VerifyNone(t)
	queryLeaky()
}
```

```text
--- FAIL: TestQueryLeaky_Leak (0.46s)
    leak_test.go:19: found unexpected goroutines:
        [Goroutine 7 in state chan send, with example.queryLeaky.func1 on top of the stack:
        example.queryLeaky.func1()
        	.../main.go:15 +0x8d
        ...
FAIL
```

Báo cáo chỉ rõ goroutine đang kẹt **ở trạng thái nào** (`chan send`) và **dòng nào** (`main.go:15`). Để kiểm tra cho **toàn bộ package**, dùng:

```go
func TestMain(m *testing.M) {
	goleak.VerifyTestMain(m)
}
```

### Kỹ thuật 3: `pprof` trên server đang chạy

Với server production, bật endpoint pprof (chi tiết ở [Bài 16](./16-production-ready.md)) rồi xem **tất cả** goroutine đang tồn tại và chúng đang kẹt ở đâu:

```bash
curl "http://localhost:6060/debug/pprof/goroutine?debug=1" | head -30
```

```text
goroutine profile: total 2014
2000 @ 0x43e7ae 0x40a1c5 0x40a0f7 0x6b3a45 0x471e21
#	0x6b3a44	main.queryLeaky.func1+0x84	/app/main.go:15
...
```

Nếu thấy **hàng nghìn** goroutine cùng kẹt ở **một dòng** → đó chính là chỗ leak.

### 💡 Tips quan trọng

- ✅ Với **mỗi** lệnh `go`, tự hỏi: **"Goroutine này kết thúc khi nào? Ai báo cho nó dừng?"**
- ✅ Mọi lệnh **gửi/nhận có thể chặn** nên nằm trong `select` với `ctx.Done()`
- ✅ Kiểu có goroutine chạy nền (cache, pool...) phải có method **`Close()`/`Stop()`** và **chờ** goroutine đó thoát
- ✅ Theo dõi metric `go_goroutines` (Prometheus) trên production - đường đồ thị **chỉ đi lên** là dấu hiệu leak
- ❌ `time.After` trong vòng lặp `for { select {...} }` chạy liên tục tạo timer mới mỗi vòng - dùng `time.NewTimer` + `Reset` hoặc `time.Ticker`

## 🌍 Ứng dụng thực tế

### Ứng dụng 1: Web crawler đồng thời có giới hạn

**Bài toán**: Thu thập (crawl) tất cả các trang của một website, đi theo link đến độ sâu tối đa 3, **không bao giờ gửi quá 3 request cùng lúc** (lịch sự với server, tránh bị chặn), không thăm trang nào 2 lần.

**Kỹ thuật dùng**: `httptest.NewServer` (tạo website giả chạy ngay trong chương trình → **không cần internet**), semaphore bằng channel, `sync.Mutex` cho map `visited`, `WaitGroup` cho số goroutine "mọc ra" động, `context` timeout, `atomic` để kiểm chứng giới hạn.

```go
package main

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"regexp"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// ======================= PHẦN 1: Website giả lập =======================
// Dùng httptest để có một website chạy ngay trong chương trình → không cần internet

var site = map[string][]string{ // trang → các link trong trang
	"/":             {"/about", "/blog", "/contact"},
	"/about":        {"/", "/team"},
	"/team":         {"/about"},
	"/contact":      {"/", "/broken"}, // /broken không tồn tại → 404
	"/blog":         {"/blog/go-1", "/blog/go-2", "/blog/go-3", "/blog/go-4"},
	"/blog/go-1":    {"/blog", "/blog/go-2"},
	"/blog/go-2":    {"/blog", "/blog/go-3"},
	"/blog/go-3":    {"/blog", "/blog/go-4"},
	"/blog/go-4":    {"/blog", "/blog/archive"},
	"/blog/archive": {"/blog/archive/2020"}, // Quá sâu, crawler sẽ không tới
}

func newFakeSite(inFlight, peak *atomic.Int64) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Đếm số request đang được phục vụ cùng lúc để kiểm chứng giới hạn
		now := inFlight.Add(1)
		defer inFlight.Add(-1)
		for {
			old := peak.Load()
			if now <= old || peak.CompareAndSwap(old, now) {
				break
			}
		}
		time.Sleep(30 * time.Millisecond) // Giả lập mạng chậm

		links, ok := site[r.URL.Path]
		if !ok {
			http.NotFound(w, r)
			return
		}
		fmt.Fprintf(w, "<html><head><title>Trang %s</title></head><body>", r.URL.Path)
		for _, l := range links {
			fmt.Fprintf(w, `<a href="%s">%s</a> `, l, l)
		}
		fmt.Fprint(w, "</body></html>")
	}))
}

// ======================= PHẦN 2: Crawler =======================

type Page struct {
	URL    string
	Title  string
	Status int
	Depth  int
}

type Crawler struct {
	baseURL  string
	client   *http.Client
	maxDepth int
	sem      chan struct{} // Giới hạn số request đồng thời

	mu      sync.Mutex
	visited map[string]bool
	pages   []Page
	wg      sync.WaitGroup
}

var (
	linkRe  = regexp.MustCompile(`href="(/[^"]*)"`)
	titleRe = regexp.MustCompile(`<title>(.*?)</title>`)
)

func NewCrawler(baseURL string, maxDepth, maxConcurrent int) *Crawler {
	return &Crawler{
		baseURL:  baseURL,
		client:   &http.Client{Timeout: 2 * time.Second},
		maxDepth: maxDepth,
		sem:      make(chan struct{}, maxConcurrent),
		visited:  make(map[string]bool),
	}
}

// markVisited trả về true nếu path CHƯA được thăm (và đánh dấu luôn) - kiểm tra + ghi trong 1 lần khóa
func (c *Crawler) markVisited(path string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.visited[path] {
		return false
	}
	c.visited[path] = true
	return true
}

func (c *Crawler) Crawl(ctx context.Context, path string, depth int) {
	if depth > c.maxDepth || !c.markVisited(path) {
		return
	}
	c.wg.Add(1)
	go func() {
		defer c.wg.Done()

		// Lấy "vé" - nhưng cũng bỏ cuộc nếu ctx bị hủy trong lúc chờ
		select {
		case c.sem <- struct{}{}:
		case <-ctx.Done():
			return
		}
		page, links := c.fetch(ctx, path, depth)
		<-c.sem // Trả vé NGAY sau khi tải xong, trước khi crawl tiếp

		c.mu.Lock()
		c.pages = append(c.pages, page)
		c.mu.Unlock()

		for _, link := range links {
			c.Crawl(ctx, link, depth+1) // Mỗi link mới → một goroutine mới (bị giới hạn bởi sem)
		}
	}()
}

func (c *Crawler) fetch(ctx context.Context, path string, depth int) (Page, []string) {
	page := Page{URL: path, Depth: depth}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return page, nil
	}
	resp, err := c.client.Do(req)
	if err != nil {
		page.Title = "LỖI: " + err.Error()
		return page, nil
	}
	defer resp.Body.Close()
	page.Status = resp.StatusCode
	if resp.StatusCode != http.StatusOK {
		return page, nil
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20)) // Đọc tối đa 1MB - phòng trang "khổng lồ"
	if err != nil {
		return page, nil
	}
	if m := titleRe.FindSubmatch(body); m != nil {
		page.Title = string(m[1])
	}
	var links []string
	for _, m := range linkRe.FindAllSubmatch(body, -1) {
		links = append(links, string(m[1]))
	}
	return page, links
}

// Wait chờ tất cả goroutine crawl xong rồi trả về kết quả đã sắp xếp
func (c *Crawler) Wait() []Page {
	c.wg.Wait()
	slices.SortFunc(c.pages, func(a, b Page) int { return strings.Compare(a.URL, b.URL) })
	return c.pages
}

func main() {
	var inFlight, peak atomic.Int64
	srv := newFakeSite(&inFlight, &peak)
	defer srv.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	start := time.Now()
	c := NewCrawler(srv.URL, 3, 3) // Độ sâu tối đa 3, tối đa 3 request cùng lúc
	c.Crawl(ctx, "/", 0)
	pages := c.Wait()

	for _, p := range pages {
		fmt.Printf("[%d] depth=%d %-14s %s\n", p.Status, p.Depth, p.URL, p.Title)
	}
	fmt.Printf("Tổng: %d trang, server thấy tối đa %d request đồng thời\n", len(pages), peak.Load())
	fmt.Printf("Thời gian: ~%v (tuần tự: %d trang × 30ms = %v)\n",
		time.Since(start).Round(50*time.Millisecond), len(pages), time.Duration(len(pages))*30*time.Millisecond)
}

// Output:
// [200] depth=0 /              Trang /
// [200] depth=1 /about         Trang /about
// [200] depth=1 /blog          Trang /blog
// [200] depth=3 /blog/archive  Trang /blog/archive
// [200] depth=2 /blog/go-1     Trang /blog/go-1
// [200] depth=2 /blog/go-2     Trang /blog/go-2
// [200] depth=2 /blog/go-3     Trang /blog/go-3
// [200] depth=2 /blog/go-4     Trang /blog/go-4
// [404] depth=2 /broken
// [200] depth=1 /contact       Trang /contact
// [200] depth=2 /team          Trang /team
// Tổng: 11 trang, server thấy tối đa 3 request đồng thời
// Thời gian: ~150ms (tuần tự: 11 trang × 30ms = 330ms)
```

**Điểm thiết kế đáng chú ý**:

- **`markVisited` kiểm tra và ghi trong CÙNG một lần khóa**. Nếu tách làm 2 bước ("kiểm tra" rồi mới "ghi"), hai goroutine có thể cùng thấy "chưa thăm" và cùng tải một trang - lỗi kinh điển **check-then-act**
- `c.wg.Add(1)` được gọi **trước** `go` - kể cả khi gọi đệ quy từ bên trong goroutine khác. Điều này hợp lệ vì goroutine cha **chưa `Done`** khi gọi `Add` cho con, nên bộ đếm không bao giờ về 0 quá sớm
- **Trả "vé" ngay sau khi tải xong**, trước khi crawl link con. Nếu giữ vé trong lúc chờ con → các goroutine cha giữ hết vé, con không lấy được → **deadlock**!
- `io.LimitReader(resp.Body, 1<<20)`: không bao giờ tin dữ liệu từ mạng - giới hạn 1MB để một trang "khổng lồ" không làm nổ RAM
- Server giả đếm `peak` và xác nhận: **tối đa 3** request đồng thời

### Ứng dụng 2: Xử lý hàng nghìn file với worker pool + tiến độ

**Bài toán**: Có 2.000 file ảnh cần "xử lý" (ở đây là kiểm tra hỏng + tính checksum SHA-256 - trong thực tế có thể là resize, nén, upload S3...). Muốn tận dụng mọi nhân CPU, hiển thị **tiến độ theo thời gian thực**, thống kê file lỗi, và **hủy được** nếu chạy quá lâu.

**Kỹ thuật dùng**: Worker pool (`runtime.NumCPU()` worker), `atomic.Int64` đếm tiến độ, `time.Ticker` in tiến độ, `context.WithTimeout`, sentinel error + `errors.Is`, `os.MkdirTemp` để tự tạo dữ liệu thử.

```go
package main

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"math/rand/v2"
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

const totalFiles = 2000

var ErrCorrupt = errors.New("file bị hỏng")

// Result là kết quả xử lý MỘT file
type Result struct {
	Path     string
	Size     int64
	Checksum string
	Err      error
}

// prepareFiles tạo sẵn 2000 file "ảnh" giả trong thư mục tạm (seed cố định → kết quả lặp lại được)
func prepareFiles(dir string) ([]string, error) {
	rng := rand.New(rand.NewPCG(2024, 9))
	paths := make([]string, 0, totalFiles)
	for i := range totalFiles {
		p := filepath.Join(dir, fmt.Sprintf("photo_%04d.jpg", i))
		content := strings.Repeat("x", 1000+rng.IntN(9000)) // 1-10KB
		if i%200 == 7 {
			content = "CORRUPT" + content // Cứ 200 file có 1 file hỏng
		}
		if err := os.WriteFile(p, []byte(content), 0o644); err != nil {
			return nil, err
		}
		paths = append(paths, p)
	}
	return paths, nil
}

// processFile: đọc file, kiểm tra hỏng, tính SHA-256 (giả lập "xử lý ảnh")
func processFile(ctx context.Context, path string) Result {
	res := Result{Path: path}
	if err := ctx.Err(); err != nil { // Đã bị hủy thì không làm nữa
		res.Err = err
		return res
	}
	f, err := os.Open(path)
	if err != nil {
		res.Err = err
		return res
	}
	defer f.Close()

	header := make([]byte, 7)
	if _, err := io.ReadFull(f, header); err == nil && string(header) == "CORRUPT" {
		res.Err = fmt.Errorf("%s: %w", filepath.Base(path), ErrCorrupt)
		return res
	}
	if _, err := f.Seek(0, io.SeekStart); err != nil {
		res.Err = err
		return res
	}
	h := sha256.New()
	n, err := io.Copy(h, f) // Stream nội dung → không đọc cả file vào RAM
	if err != nil {
		res.Err = err
		return res
	}
	res.Size = n
	res.Checksum = fmt.Sprintf("%x", h.Sum(nil))[:12]
	return res
}

// runPool: worker pool + báo cáo tiến độ
func runPool(ctx context.Context, paths []string, workers int) []Result {
	jobs := make(chan string)
	results := make(chan Result, workers)
	var done atomic.Int64

	// 1. Worker
	var wg sync.WaitGroup
	for range workers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for p := range jobs {
				results <- processFile(ctx, p)
				done.Add(1)
			}
		}()
	}

	// 2. Producer: đẩy việc, dừng sớm nếu ctx bị hủy
	go func() {
		defer close(jobs)
		for _, p := range paths {
			select {
			case jobs <- p:
			case <-ctx.Done():
				return
			}
		}
	}()

	// 3. Đóng results khi mọi worker xong
	go func() {
		wg.Wait()
		close(results)
	}()

	// 4. Báo cáo tiến độ định kỳ (goroutine riêng, dừng khi xong)
	stopProgress := make(chan struct{})
	progressDone := make(chan struct{})
	go func() {
		defer close(progressDone)
		ticker := time.NewTicker(20 * time.Millisecond)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				n := done.Load()
				fmt.Printf("\r⏳ Tiến độ: %3d%% (%d/%d)", n*100/int64(len(paths)), n, len(paths))
			case <-stopProgress:
				fmt.Printf("\r✅ Tiến độ: 100%% (%d/%d)\n", len(paths), len(paths))
				return
			}
		}
	}()

	// 5. Thu thập
	all := make([]Result, 0, len(paths))
	for r := range results {
		all = append(all, r)
	}
	close(stopProgress)
	<-progressDone
	return all
}

func main() {
	dir, err := os.MkdirTemp("", "photos-*")
	if err != nil {
		fmt.Println("Lỗi:", err)
		return
	}
	defer os.RemoveAll(dir) // Dọn dẹp thư mục tạm khi xong

	paths, err := prepareFiles(dir)
	if err != nil {
		fmt.Println("Lỗi:", err)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	start := time.Now()
	results := runPool(ctx, paths, runtime.NumCPU())
	elapsed := time.Since(start)

	var ok, failed int
	var totalBytes int64
	var failedNames []string
	for _, r := range results {
		if r.Err != nil {
			failed++
			if errors.Is(r.Err, ErrCorrupt) {
				failedNames = append(failedNames, filepath.Base(r.Path))
			}
			continue
		}
		ok++
		totalBytes += r.Size
	}
	slices.Sort(failedNames)

	fmt.Printf("Thành công: %d | Lỗi: %d | Tổng dung lượng: %d KB\n", ok, failed, totalBytes/1024)
	fmt.Println("File hỏng đầu tiên:", failedNames[:3])
	fmt.Printf("Thời gian: %v với %d worker\n", elapsed.Round(time.Millisecond), runtime.NumCPU())
}

// Output (dòng tiến độ tự cập nhật tại chỗ nhờ ký tự \r; thời gian tùy máy):
// ✅ Tiến độ: 100% (2000/2000)
// Thành công: 1990 | Lỗi: 10 | Tổng dung lượng: 10768 KB
// File hỏng đầu tiên: [photo_0007.jpg photo_0207.jpg photo_0407.jpg]
// Thời gian: 50ms với 4 worker
```

**Tại sao thiết kế như vậy?**

- **Số worker = số nhân CPU**: việc tính SHA-256 là **CPU-bound** (tốn CPU). Thêm worker nhiều hơn số nhân không nhanh hơn. Nếu việc là **I/O-bound** (upload mạng), có thể dùng nhiều worker hơn hẳn (20-100)
- **Lỗi của từng file KHÔNG dừng cả lô**: mỗi `Result` mang theo `Err` riêng. Đây là khác biệt quan trọng với `errgroup` (một lỗi hủy tất cả). Chọn pattern theo yêu cầu nghiệp vụ: *"1 ảnh hỏng thì bỏ qua"* ≠ *"1 giao dịch lỗi thì hủy cả lô"*
- **Goroutine tiến độ đọc `atomic`**, không cần khóa. Nó có kênh `stopProgress` riêng và main **chờ nó thoát** (`<-progressDone`) → không leak, không in lộn xộn sau dòng kết quả
- `io.Copy(h, f)` **stream** file qua hàm băm → xử lý được cả file vài GB mà không tốn RAM
- `\r` (carriage return) đưa con trỏ về đầu dòng → dòng tiến độ tự cập nhật tại chỗ trong terminal

### Ứng dụng 3: Gọi nhiều API song song và gộp kết quả với `errgroup`

**Bài toán**: Trang "Dashboard" của người dùng cần dữ liệu từ 3 microservice: **users** (bắt buộc), **orders** (bắt buộc), **recommendations** (có thì tốt, nhưng rất chậm). Yêu cầu:
- Gọi **song song** → thời gian ≈ API chậm nhất, không phải tổng
- API **bắt buộc** lỗi → trả lỗi ngay, **hủy** các API khác (không phí tài nguyên)
- API **tùy chọn** chậm/lỗi → dùng giá trị mặc định, **không** làm hỏng cả trang

```go
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"time"

	"golang.org/x/sync/errgroup"
)

// ======================= Các "microservice" giả lập =======================

type User struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type Order struct {
	ID    int `json:"id"`
	Total int `json:"total"`
}

func newFakeServices(ordersBroken bool) *httptest.Server {
	mux := http.NewServeMux()
	reply := func(w http.ResponseWriter, delay time.Duration, v any) {
		time.Sleep(delay)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(v)
	}
	mux.HandleFunc("GET /users/{id}", func(w http.ResponseWriter, r *http.Request) {
		reply(w, 100*time.Millisecond, User{ID: 42, Name: "Lan"})
	})
	mux.HandleFunc("GET /users/{id}/orders", func(w http.ResponseWriter, r *http.Request) {
		if ordersBroken {
			time.Sleep(30 * time.Millisecond)
			http.Error(w, "database down", http.StatusInternalServerError)
			return
		}
		reply(w, 120*time.Millisecond, []Order{{1, 250000}, {2, 90000}})
	})
	mux.HandleFunc("GET /users/{id}/recommendations", func(w http.ResponseWriter, r *http.Request) {
		// Service gợi ý RẤT chậm - nhưng nó chỉ là "có thì tốt"
		select {
		case <-time.After(2 * time.Second):
			reply(w, 0, []string{"Sách Go", "Bàn phím cơ"})
		case <-r.Context().Done(): // Client bỏ đi → server cũng dừng
		}
	})
	return httptest.NewServer(mux)
}

// ======================= Client gộp kết quả =======================

// getJSON gọi GET url và decode JSON vào out, tôn trọng ctx
func getJSON(ctx context.Context, client *http.Client, url string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("GET %s: status %d", req.URL.Path, resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

type Dashboard struct {
	User            User
	Orders          []Order
	Recommendations []string
}

func loadDashboard(ctx context.Context, baseURL string, userID int) (*Dashboard, error) {
	client := &http.Client{}
	var d Dashboard

	g, ctx := errgroup.WithContext(ctx)

	// BẮT BUỘC: lỗi ở đây → hủy toàn bộ
	g.Go(func() error {
		return getJSON(ctx, client, fmt.Sprintf("%s/users/%d", baseURL, userID), &d.User)
	})
	g.Go(func() error {
		return getJSON(ctx, client, fmt.Sprintf("%s/users/%d/orders", baseURL, userID), &d.Orders)
	})

	// TÙY CHỌN: có timeout riêng, lỗi thì dùng giá trị mặc định, KHÔNG trả error cho group
	g.Go(func() error {
		rctx, cancel := context.WithTimeout(ctx, 150*time.Millisecond)
		defer cancel()
		if err := getJSON(rctx, client, fmt.Sprintf("%s/users/%d/recommendations", baseURL, userID), &d.Recommendations); err != nil {
			d.Recommendations = []string{"(gợi ý mặc định)"}
		}
		return nil
	})

	// Mỗi goroutine ghi vào MỘT field riêng của d → không cần mutex.
	// g.Wait() đảm bảo "happens-before": sau Wait, main thấy đầy đủ dữ liệu.
	if err := g.Wait(); err != nil {
		return nil, fmt.Errorf("loadDashboard(user=%d): %w", userID, err)
	}
	return &d, nil
}

func main() {
	for _, broken := range []bool{false, true} {
		srv := newFakeServices(broken)
		start := time.Now()
		d, err := loadDashboard(context.Background(), srv.URL, 42)
		took := time.Since(start).Round(50 * time.Millisecond)
		srv.Close()

		if err != nil {
			fmt.Println("❌ Lỗi:", err)
			fmt.Println("   Là context.Canceled?", errors.Is(err, context.Canceled))
			fmt.Printf("   Thất bại nhanh sau ~%v\n", took)
			continue
		}
		fmt.Printf("✅ %s có %d đơn hàng, gợi ý: %v\n", d.User.Name, len(d.Orders), d.Recommendations)
		fmt.Printf("   Mất ~%v (tuần tự: 100+120+150 = 370ms)\n", took)
	}
}

// Output:
// ✅ Lan có 2 đơn hàng, gợi ý: [(gợi ý mặc định)]
//    Mất ~150ms (tuần tự: 100+120+150 = 370ms)
// ❌ Lỗi: loadDashboard(user=42): GET /users/42/orders: status 500
//    Là context.Canceled? false
//    Thất bại nhanh sau ~50ms
```

**Điểm then chốt**:

- **Phân loại lỗi**: goroutine bắt buộc `return err` → errgroup hủy tất cả. Goroutine tùy chọn **nuốt lỗi** và `return nil` → không ảnh hưởng người khác. Đây là kỹ thuật **graceful degradation** (xuống cấp nhẹ nhàng) - Netflix, Shopee... đều làm vậy: dịch vụ gợi ý sập thì trang chủ vẫn hiện, chỉ thiếu phần gợi ý
- **Timeout lồng nhau**: `rctx` (150ms) là con của `ctx` (errgroup) → nó hết hạn theo **cái nào đến trước**
- Server giả **lắng nghe `r.Context().Done()`**: khi client hủy request, server cũng ngừng làm việc - context hoạt động **xuyên qua cả mạng HTTP**
- Kịch bản lỗi: orders trả 500 sau 30ms → users (đang chờ 100ms) bị hủy → cả hàm thất bại sau ~50ms thay vì chờ đủ

### Ứng dụng 4: In-memory cache thread-safe có TTL

**Bài toán**: Truy vấn thông tin sản phẩm từ DB mất 50ms và được gọi hàng nghìn lần mỗi giây. Cần một cache trong bộ nhớ:
- An toàn khi nhiều goroutine dùng cùng lúc
- Mỗi mục **hết hạn** sau TTL; có goroutine nền **dọn dẹp** định kỳ
- Khi 100 request cùng hỏi một key **chưa có trong cache**, DB chỉ bị gọi **một lần** (chống "**cache stampede**" / thundering herd)
- Có `Close()` để dừng goroutine nền - **không leak**

**Kỹ thuật dùng**: Generics `Cache[K, V]`, `sync.RWMutex`, `time.Ticker`, `sync.Once`, và `golang.org/x/sync/singleflight` - package gộp các lời gọi trùng nhau thành một.

📄 **`cache.go`**

```go
package main

import (
	"context"
	"fmt"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"
)

// entry là một ô trong cache: giá trị + thời điểm hết hạn
type entry[V any] struct {
	value     V
	expiresAt time.Time
}

// Cache là bộ nhớ đệm an toàn đồng thời, mỗi key có thời gian sống (TTL)
type Cache[K comparable, V any] struct {
	mu    sync.RWMutex
	items map[K]entry[V]
	ttl   time.Duration

	group singleflight.Group // Gộp các lần load trùng key thành MỘT
	stop  chan struct{}      // Tín hiệu dừng goroutine dọn dẹp
	done  chan struct{}      // Goroutine dọn dẹp báo "đã dừng"
	once  sync.Once          // Close an toàn khi gọi nhiều lần
}

// New tạo cache và khởi động goroutine dọn key hết hạn mỗi cleanupEvery
func New[K comparable, V any](ttl, cleanupEvery time.Duration) *Cache[K, V] {
	c := &Cache[K, V]{
		items: make(map[K]entry[V]),
		ttl:   ttl,
		stop:  make(chan struct{}),
		done:  make(chan struct{}),
	}
	go c.janitor(cleanupEvery)
	return c
}

func (c *Cache[K, V]) Set(key K, value V) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.items[key] = entry[V]{value: value, expiresAt: time.Now().Add(c.ttl)}
}

// Get trả về (giá trị, true) nếu key tồn tại và CHƯA hết hạn
func (c *Cache[K, V]) Get(key K) (V, bool) {
	c.mu.RLock() // Chỉ đọc → RLock, nhiều goroutine Get cùng lúc được
	defer c.mu.RUnlock()
	e, ok := c.items[key]
	if !ok || time.Now().After(e.expiresAt) {
		var zero V
		return zero, false
	}
	return e.value, true
}

func (c *Cache[K, V]) Delete(key K) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.items, key)
}

func (c *Cache[K, V]) Len() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.items)
}

// GetOrLoad: có trong cache thì trả luôn; không thì gọi load (chỉ MỘT lần cho mỗi key,
// dù 1000 goroutine cùng hỏi) rồi lưu vào cache.
func (c *Cache[K, V]) GetOrLoad(ctx context.Context, key K, load func(context.Context) (V, error)) (V, error) {
	if v, ok := c.Get(key); ok {
		return v, nil
	}
	// singleflight cần key kiểu string → chuyển K thành chuỗi
	v, err, _ := c.group.Do(fmt.Sprint(key), func() (any, error) {
		if v, ok := c.Get(key); ok { // Kiểm tra lại: có thể ai đó vừa load xong
			return v, nil
		}
		v, err := load(ctx)
		if err != nil {
			return v, err // Lỗi thì KHÔNG cache
		}
		c.Set(key, v)
		return v, nil
	})
	if err != nil {
		var zero V
		return zero, err
	}
	return v.(V), nil
}

// janitor định kỳ xóa các key đã hết hạn để giải phóng bộ nhớ
func (c *Cache[K, V]) janitor(every time.Duration) {
	defer close(c.done)
	ticker := time.NewTicker(every)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			c.deleteExpired()
		case <-c.stop:
			return
		}
	}
}

func (c *Cache[K, V]) deleteExpired() {
	now := time.Now()
	c.mu.Lock()
	defer c.mu.Unlock()
	for k, e := range c.items {
		if now.After(e.expiresAt) {
			delete(c.items, k) // Xóa trong lúc range map là AN TOÀN trong Go
		}
	}
}

// Close dừng goroutine dọn dẹp và CHỜ nó thoát hẳn → không leak
func (c *Cache[K, V]) Close() {
	c.once.Do(func() { close(c.stop) })
	<-c.done
}
```

📄 **`main.go`**

```go
package main

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

type Product struct {
	ID    int
	Name  string
	Price int
}

func main() {
	cache := New[int, Product](100*time.Millisecond, 20*time.Millisecond)
	defer cache.Close()

	// 1. Set / Get cơ bản
	cache.Set(1, Product{1, "Bàn phím", 890000})
	p, ok := cache.Get(1)
	fmt.Println("Get(1):", p.Name, ok)

	time.Sleep(150 * time.Millisecond) // Chờ quá TTL
	_, ok = cache.Get(1)
	fmt.Println("Get(1) sau 150ms:", ok, "| số key còn lại:", cache.Len())

	// 2. GetOrLoad: 100 goroutine cùng hỏi sản phẩm 7 - DB chỉ bị gọi 1 lần
	var dbCalls atomic.Int64
	loadFromDB := func(ctx context.Context) (Product, error) {
		dbCalls.Add(1)
		time.Sleep(50 * time.Millisecond) // Giả lập query chậm
		return Product{7, "Chuột không dây", 350000}, nil
	}

	var wg sync.WaitGroup
	for range 100 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, _ = cache.GetOrLoad(context.Background(), 7, loadFromDB)
		}()
	}
	wg.Wait()
	p, _ = cache.Get(7)
	fmt.Println("Sản phẩm 7:", p.Name, "| số lần gọi DB:", dbCalls.Load())
}

// Output:
// Get(1): Bàn phím true
// Get(1) sau 150ms: false | số key còn lại: 0
// Sản phẩm 7: Chuột không dây | số lần gọi DB: 1
```

📄 **`cache_test.go`**

```go
package main

import (
	"sync"
	"testing"
	"time"
)

func TestCache_SetGetExpire(t *testing.T) {
	c := New[string, int](50*time.Millisecond, time.Hour)
	defer c.Close()

	c.Set("a", 1)
	if v, ok := c.Get("a"); !ok || v != 1 {
		t.Fatalf("Get(a) = %v, %v; muốn 1, true", v, ok)
	}
	time.Sleep(80 * time.Millisecond)
	if _, ok := c.Get("a"); ok {
		t.Fatal("key a lẽ ra đã hết hạn")
	}
}

// Test này có ý nghĩa nhất khi chạy với -race
func TestCache_Concurrent(t *testing.T) {
	c := New[int, int](time.Second, 5*time.Millisecond)
	defer c.Close()

	var wg sync.WaitGroup
	for i := range 50 {
		wg.Add(2)
		go func() { defer wg.Done(); c.Set(i%10, i) }()
		go func() { defer wg.Done(); c.Get(i % 10); c.Len() }()
	}
	wg.Wait()
	if c.Len() != 10 {
		t.Fatalf("Len = %d; muốn 10", c.Len())
	}
}
```

```bash
go test -race -v .
```

```text
=== RUN   TestCache_SetGetExpire
--- PASS: TestCache_SetGetExpire (0.08s)
=== RUN   TestCache_Concurrent
--- PASS: TestCache_Concurrent (0.00s)
PASS
ok  	example	1.063s
```

**Giải thích các quyết định**:

- **`RWMutex`**: cache là ví dụ điển hình "đọc nhiều, ghi ít"
- **Hai cơ chế hết hạn**: `Get` **tự kiểm tra** `expiresAt` (nên không bao giờ trả dữ liệu cũ, kể cả khi janitor chưa chạy), còn `janitor` chỉ để **giải phóng bộ nhớ**
- **`singleflight.Group.Do(key, fn)`**: nếu đang có một lời gọi `fn` cho `key`, các lời gọi khác **chờ và dùng chung kết quả**. 100 goroutine → 1 query DB
- **Kiểm tra lại (double-check)** bên trong `Do`: có thể một goroutine khác vừa load xong ngay trước khi ta vào
- **Không cache lỗi**: nếu DB lỗi tạm thời, lần sau sẽ thử lại
- **`Close` dùng `sync.Once`** để gọi 2 lần không panic ("close of closed channel"), và **chờ `<-c.done`** để chắc chắn goroutine janitor đã thoát hẳn

> 💡 Trong production, bạn có thể dùng thư viện có sẵn như `github.com/dgraph-io/ristretto` hoặc `github.com/jellydator/ttlcache`. Nhưng tự viết một lần giúp bạn hiểu **chính xác** chúng làm gì bên trong. Ở [Bài 15](./15-generics-reflection-stdlib.md) bạn sẽ viết thêm một **LRU cache** generic.

## ⚠️ Lỗi thường gặp

### Lỗi 1: Giai đoạn pipeline gửi mà không `select` với `ctx.Done()`

```go
for n := range in {
	out <- n * n // ❌ Người nhận bỏ về → kẹt mãi mãi → leak
}
```

```go
for n := range in {
	select {
	case out <- n * n: // ✅
	case <-ctx.Done():
		return
	}
}
```

### Lỗi 2: Giữ "vé" semaphore trong lúc chờ việc con

```go
sem <- struct{}{}
defer func() { <-sem }() // ❌ Giữ vé đến cuối hàm...
page := fetch(url)
for _, link := range page.Links {
	crawlAndWait(link) // ...trong khi chờ con - con cũng cần vé → DEADLOCK khi hết vé
}
```

✅ Trả vé **ngay sau** phần việc cần giới hạn (như crawler ở trên).

### Lỗi 3: Dùng lại `ctx` của `errgroup.WithContext` sau `Wait`

```go
g, ctx := errgroup.WithContext(parent)
// ... g.Go(...)
_ = g.Wait()
db.QueryContext(ctx, "...") // ❌ ctx đã bị hủy khi Wait trả về → luôn lỗi "context canceled"
```

✅ Sau `Wait`, dùng `parent`. Đặt tên biến khác (`gctx`) để tránh nhầm.

### Lỗi 4: Quên `Reset()` object lấy từ `sync.Pool`

```go
buf := pool.Get().(*bytes.Buffer)
buf.WriteString(userData) // ❌ Buffer còn dữ liệu của REQUEST TRƯỚC (có thể của người dùng khác!)
```

✅ Luôn `buf.Reset()` ngay sau `Get`.

### Lỗi 5: Copy struct chứa `sync.Mutex` / `atomic` / `sync.Once`

```go
type Counter struct {
	mu sync.Mutex
	n  int
}

func (c Counter) Inc() { c.mu.Lock(); c.n++; c.mu.Unlock() } // ❌ Value receiver → khóa BẢN SAO
```

✅ Dùng **pointer receiver** `func (c *Counter) Inc()`. `go vet` báo: *"Inc passes lock by value"*. Tương tự với `atomic.Int64`, `sync.WaitGroup`, `sync.Once`.

### Lỗi 6: Kiểm tra rồi mới hành động (check-then-act) không nguyên tử

```go
if _, ok := cache.Get(key); !ok { // Goroutine A và B cùng thấy "chưa có"
	cache.Set(key, loadFromDB(key)) // ❌ Cả hai cùng gọi DB
}
```

✅ Gộp kiểm tra + ghi trong **một** lần khóa (như `markVisited`), hoặc dùng `singleflight`.

### Lỗi 7: Nghĩ rằng `cancel()` sẽ "giết" goroutine

```go
go func() {
	heavyComputation() // ❌ Không hề nhìn ctx → cancel() không có tác dụng gì
}()
cancel()
```

✅ Go **không có cách** dừng goroutine từ bên ngoài. Goroutine phải **tự kiểm tra** `ctx.Err()` / `ctx.Done()` định kỳ (ví dụ mỗi vòng lặp).

### Lỗi 8: `time.After` trong vòng lặp nóng

```go
for {
	select {
	case msg := <-msgs:
		handle(msg)
	case <-time.After(time.Minute): // ❌ Mỗi vòng tạo 1 timer mới
		return
	}
}
```

Từ Go 1.23, timer không còn tham chiếu sẽ được GC thu hồi nên đây **không còn là memory leak** nghiêm trọng, nhưng vẫn tạo rác mỗi vòng lặp. ✅ Với vòng lặp chạy rất nhiều lần, dùng `time.NewTimer` và `timer.Reset(d)`.

### Lỗi 9: Dùng atomic cho nhiều biến cần nhất quán

```go
balanceA.Add(-100) // ❌ Giữa 2 dòng này, goroutine khác có thể thấy
balanceB.Add(100)  //    tổng tiền "biến mất" 100
```

✅ Khi nhiều biến phải thay đổi **cùng nhau**, dùng `sync.Mutex`.

## 🏋️ Bài tập

### Bài tập 1: Pipeline đếm từ (⭐ Dễ)

Viết pipeline 3 giai đoạn có `ctx`: `readLines(ctx, text)` → `splitWords(ctx, lines)` → `toLower(ctx, words)`. Main đếm tần suất từ bằng map và in 5 từ xuất hiện nhiều nhất. Kiểm tra bằng `runtime.NumGoroutine()` rằng sau khi `cancel()` không còn goroutine nào của pipeline.

### Bài tập 2: `ParallelMap` generic có giới hạn (⭐ Dễ)

Viết hàm:

```go
func ParallelMap[T, R any](ctx context.Context, items []T, limit int, f func(context.Context, T) (R, error)) ([]R, error)
```

dùng `errgroup` + `SetLimit`. Kết quả phải **giữ đúng thứ tự** của `items`. Viết test chứng minh: (a) thứ tự đúng, (b) không bao giờ quá `limit` goroutine cùng lúc, (c) một lỗi thì hàm trả lỗi đó.

### Bài tập 3: Rate limiter cho client API (⭐⭐ Trung bình)

Dùng `httptest.NewServer` tạo một API giả **trả 429** nếu nhận quá 5 request trong 1 giây (server tự đếm). Viết client gọi API 30 lần với `rate.Limiter` phù hợp để **không bao giờ** bị 429. Sau đó bỏ limiter đi và quan sát số lần bị 429.

### Bài tập 4: Crawler nâng cấp (⭐⭐ Trung bình)

Nâng cấp crawler ở Ứng dụng 1:
- Thay semaphore + WaitGroup bằng `errgroup` với `SetLimit(3)` (gợi ý: cẩn thận với `g.Go` gọi từ bên trong goroutine của group - nó có thể chặn!)
- Thêm giới hạn **tổng số trang** (ví dụ 50) - khi đạt giới hạn thì `cancel()` mọi thứ
- Thêm `rate.Limiter` để không quá 10 request/giây
- Đo và in thời gian với các mức giới hạn khác nhau (1, 3, 10)

### Bài tập 5: Worker pool có graceful shutdown + retry (⭐⭐⭐ Khó)

Mở rộng Ứng dụng 2:
- Job lỗi tạm thời (giả lập ngẫu nhiên 10%) được **thử lại tối đa 3 lần** với thời gian chờ tăng dần (100ms, 200ms, 400ms - exponential backoff), thời gian chờ phải **tôn trọng `ctx`**
- Bấm Ctrl+C → ngừng nhận file mới, làm nốt file đang xử lý, in báo cáo: bao nhiêu file xong, bao nhiêu chưa làm
- Bấm Ctrl+C lần 2 → thoát ngay
- Chạy với `-race` không có cảnh báo

### Bài tập 6: Cache nâng cấp (⭐⭐⭐ Khó)

Mở rộng Ứng dụng 4:
- Thêm **giới hạn số mục** (`maxItems`): khi đầy, xóa mục **sắp hết hạn nhất**
- Thêm thống kê `Stats() (hits, misses int64)` dùng `atomic`
- Thêm `GetOrLoad` với **"stale-while-revalidate"**: nếu mục vừa hết hạn (< 10 giây), trả về giá trị cũ **ngay lập tức** và load lại **ở nền**
- Viết test bằng `goleak` đảm bảo `Close()` không để lại goroutine nào

## ✅ Checklist hoàn thành

- [ ] Giải thích được "happens-before" bằng ví dụ của riêng mình
- [ ] Viết pipeline có `ctx`, dừng gọn gàng khi `cancel()`
- [ ] Viết được hàm `merge` (fan-in) generic
- [ ] Giới hạn song song bằng buffered channel và `semaphore.Weighted`
- [ ] Dùng `errgroup` với `WithContext` và `SetLimit`
- [ ] Biết khi nào dùng `Once`/`OnceValue`, `RWMutex`, `atomic`, `Pool`, `Cond`
- [ ] Phân biệt semaphore (đồng thời) và rate limiter (theo thời gian), dùng được `rate.Limiter`
- [ ] Truyền `ctx` xuyên các tầng, dùng `context.Cause` / `WithoutCancel`
- [ ] Viết worker pool có graceful shutdown với `signal.NotifyContext`
- [ ] Phát hiện goroutine leak bằng `NumGoroutine`, `goleak`, pprof
- [ ] Chạy thành công cả 4 ứng dụng thực tế, `go test -race` sạch
- [ ] Hoàn thành ít nhất 4 bài tập

## 🚀 Tiếp theo

Bạn đã nắm được những pattern concurrency mà các dự án Go lớn (Kubernetes, Docker, CockroachDB...) sử dụng hằng ngày. Bài tiếp theo sẽ mở rộng "hộp đồ nghề" của bạn:

- **Generics nâng cao**: constraint, `~`, kiểu generic `Set[T]`, `Cache[K, V]`, LRU cache
- **Iterators** (Go 1.23): `range` trên hàm, `iter.Seq`
- **Reflection**: đọc struct tag, tự viết validator
- **Thư viện chuẩn hữu ích**: `time`, `log/slog`, `embed`, `text/template`, `html/template`, `slices`, `maps`

**Bài tiếp theo**: [Generics nâng cao, Reflection & Thư viện chuẩn hữu ích](./15-generics-reflection-stdlib.md)

---

💡 **Tips ghi nhớ**:

- **Mỗi goroutine phải có đường về** - `ctx.Done()` trong mọi `select`
- **`errgroup` thay cho `WaitGroup`** khi goroutine có thể lỗi
- **Giới hạn mọi thứ**: số goroutine (semaphore), tốc độ (rate), thời gian (timeout), dung lượng đọc (`LimitReader`)
- **Mutex mặc định**, `RWMutex`/`atomic`/`Pool` chỉ khi đã **đo**
- **Graceful shutdown**: ngừng nhận → làm nốt → có hạn chót
- **`go test -race` + `goleak`** - hai "người gác cổng" cho code concurrent
