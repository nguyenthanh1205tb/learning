# 📚 Bài 14: Concurrency & Parallelism

## 🎯 Mục tiêu bài học

- Phân biệt **concurrency** (đồng thời) và **parallelism** (song song), **I/O-bound** và **CPU-bound**
- Hiểu sâu **GIL**: nó là gì, tại sao tồn tại, khi nào được "nhả" và ảnh hưởng thế nào đến thread
- Dùng **`threading`**: `Thread`, `join`, daemon thread, **race condition**, `Lock`, `queue.Queue`
- Dùng **`concurrent.futures`**: `ThreadPoolExecutor`, `ProcessPoolExecutor`, `submit`, `map`, `as_completed`
- Dùng **`multiprocessing`**: `Process`, `Pool`, chia sẻ dữ liệu giữa tiến trình, hiểu vì sao **bắt buộc** `if __name__ == "__main__"`
- Làm chủ **asyncio** ở mức chuyên sâu: event loop, `Task`, `gather` vs **`TaskGroup`** (3.11), **`asyncio.timeout`**, `Semaphore`, `asyncio.Queue`, hủy task, `async with`/`async for`, `asyncio.to_thread`
- Gọi HTTP bất đồng bộ với **`httpx.AsyncClient`** (và test offline bằng `MockTransport`)
- **Đo hiệu năng** thật sự và biết **chọn đúng công cụ** cho từng bài toán

> 💡 Bài này nối tiếp phần asyncio ở [Bài 9](./09-advanced-python.md). Nếu bạn chưa nhớ `async`/`await`, `asyncio.run`, `asyncio.gather` là gì, hãy xem lại mục 7 của Bài 9 trước. Mọi ví dụ trong bài đều **chạy offline** - không cần internet.

### Cài đặt thư viện cho bài này

Hầu hết bài dùng thư viện chuẩn. Riêng phần HTTP bất đồng bộ cần `httpx`:

```bash
# Tạo và kích hoạt venv (xem lại Bài 1)
python -m venv .venv
# Windows:  .venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install httpx
python -c "import httpx; print(httpx.__version__)"
# Output (ví dụ): 0.28.1
```

## 📖 1. Concurrency vs Parallelism

### Hai khái niệm hay bị nhầm lẫn

- **Concurrency (đồng thời)**: **xử lý** nhiều việc trong cùng một khoảng thời gian bằng cách **xen kẽ** - làm việc A một chút, chuyển sang B, quay lại A... Tại **một thời điểm** có thể chỉ có **một** việc thực sự đang chạy
- **Parallelism (song song)**: **thực thi** nhiều việc **cùng một lúc thật sự** - cần nhiều lõi CPU (core), mỗi lõi chạy một việc

> 🧠 **Ví dụ dễ hiểu - Quán phở**:
>
> - **Concurrency** = **một đầu bếp** 👨‍🍳 nấu 3 nồi: bắc nồi nước dùng lên bếp, **trong lúc chờ sôi** thì thái thịt, rồi trụng bánh... Chỉ có một người, nhưng nhờ **không đứng chờ** nên xong nhanh hơn nhiều so với làm xong nồi này mới bắt đầu nồi kia
> - **Parallelism** = **ba đầu bếp** 👨‍🍳👩‍🍳🧑‍🍳 mỗi người một nồi, làm cùng lúc
> - Concurrency giúp khi **phải chờ** (chờ nước sôi = chờ mạng, chờ ổ đĩa). Parallelism giúp khi **việc nặng tay** (băm 10kg thịt = tính toán nặng) - một người có nhanh tay đến đâu cũng không bằng ba người

### I/O-bound vs CPU-bound

Câu hỏi quan trọng nhất trước khi tối ưu: **chương trình của bạn đang chậm vì cái gì?**

| | **I/O-bound** (chờ vào/ra) | **CPU-bound** (tính toán nặng) |
| --- | --- | --- |
| Thời gian chủ yếu dùng để | **Chờ** mạng, ổ đĩa, database, API | **Tính toán** trên CPU |
| CPU lúc đang chạy | Gần như rảnh (vài %) | Một lõi chạy 100% |
| Ví dụ | Tải 500 trang web, gọi API, đọc/ghi nhiều file, truy vấn DB | Xử lý ảnh/video, nén file, mã hóa, mô phỏng, tính số nguyên tố |
| Công cụ phù hợp | `asyncio`, `threading`, `ThreadPoolExecutor` | `multiprocessing`, `ProcessPoolExecutor` (hoặc NumPy/thư viện C) |

Cách nhận biết nhanh: mở **Task Manager** (Windows) / **Activity Monitor** (macOS) / `htop` (Linux) khi chương trình chạy. CPU gần 0% mà chương trình vẫn chậm → **I/O-bound**. Một lõi CPU lên 100% → **CPU-bound**.

Bạn cũng có thể đo bằng code: so sánh **thời gian thực** (`perf_counter`) với **thời gian CPU** (`process_time`):

```python
import time


def io_task():
    time.sleep(0.3)             # Giả lập chờ mạng: CPU không làm gì


def cpu_task():
    total = 0
    for i in range(3_000_000):  # Tính toán thuần: CPU chạy liên tục
        total += i * i
    return total


for task in (io_task, cpu_task):
    wall_start, cpu_start = time.perf_counter(), time.process_time()
    task()
    wall = time.perf_counter() - wall_start      # Thời gian đồng hồ treo tường
    cpu = time.process_time() - cpu_start        # Thời gian CPU thực sự làm việc
    kind = "I/O-bound" if cpu < wall / 2 else "CPU-bound"
    print(f"{task.__name__}: wall={wall:.2f}s, cpu={cpu:.2f}s → {kind}")
# Output (ví dụ):
# io_task: wall=0.30s, cpu=0.00s → I/O-bound
# cpu_task: wall=0.10s, cpu=0.10s → CPU-bound
```

### Ba "vũ khí" của Python

| Công cụ | Cơ chế | Song song thật? | Chi phí tạo | Phù hợp |
| --- | --- | --- | --- | --- |
| `threading` | Nhiều **luồng** trong **một** tiến trình, dùng chung bộ nhớ | ❌ (bị GIL) - chỉ xen kẽ | Nhẹ (~vài chục KB) | I/O-bound, thư viện đồng bộ |
| `multiprocessing` | Nhiều **tiến trình**, mỗi cái một bộ nhớ + một GIL riêng | ✅ Có | Nặng (~vài chục MB, khởi động chậm) | CPU-bound |
| `asyncio` | **Một luồng**, event loop xen kẽ các coroutine tại `await` | ❌ - chỉ xen kẽ | Rất nhẹ (vài KB/task) | I/O-bound, hàng nghìn kết nối |

### 💡 Tips quan trọng

- **Đo trước, tối ưu sau** - đừng đoán. Nhiều khi chương trình chậm vì một truy vấn DB thiếu index chứ không phải vì thiếu thread ✅
- I/O-bound → nghĩ đến **asyncio/thread**. CPU-bound → nghĩ đến **process** ✅
- Concurrency làm code **phức tạp hơn** và khó debug hơn. Nếu script chạy 2 giây và chỉ chạy 1 lần/ngày, **đừng** tối ưu ❌

## 📖 2. GIL - Nhắc lại và đi sâu

### Nhắc lại từ Bài 9

**GIL (Global Interpreter Lock)** là một "khóa" trong CPython (bản Python chuẩn bạn tải từ python.org) đảm bảo **tại một thời điểm chỉ có một luồng được chạy bytecode Python**. Dù máy bạn có 16 lõi, 16 thread Python tính toán thuần vẫn chỉ chạy như... 1 lõi.

> 🧠 **Ví dụ dễ hiểu**: GIL giống **chiếc micro duy nhất** 🎤 trong phòng karaoke. Có 10 người (thread) muốn hát nhưng chỉ ai **cầm micro** mới được hát. Mọi người thay phiên chuyền micro rất nhanh nên trông như "cùng hát", nhưng thực ra chỉ một người hát tại một thời điểm. Tuy nhiên, khi một người **đi lấy nước** (chờ I/O), họ **đưa micro** cho người khác - nên nếu ai cũng hay đi lấy nước thì phòng vẫn hoạt động hiệu quả!

### Tại sao Python lại có GIL?

CPython quản lý bộ nhớ bằng **reference counting** (đếm tham chiếu): mỗi object có một bộ đếm "bao nhiêu biến đang trỏ tới tôi". Khi bộ đếm về 0, object bị xóa.

```python
import sys

data = []
print(sys.getrefcount(data))    # +1 vì chính lời gọi getrefcount cũng tạm giữ tham chiếu
# Output: 2
alias = data
print(sys.getrefcount(data))
# Output: 3
```

Nếu hai thread cùng tăng/giảm bộ đếm này **cùng lúc** mà không có khóa, bộ đếm sẽ sai → object bị xóa khi vẫn còn dùng (crash) hoặc không bao giờ bị xóa (rò rỉ bộ nhớ). Thay vì đặt khóa trên **từng** object (chậm và dễ deadlock), CPython chọn **một khóa lớn cho toàn bộ trình thông dịch**. Kết quả:

- ✅ Code đơn luồng rất nhanh, viết thư viện C đơn giản
- ❌ Thread không tăng tốc được code Python tính toán thuần

### Khi nào GIL được "nhả"?

1. **Khi chờ I/O**: `time.sleep`, đọc/ghi file, socket, gọi HTTP... → thread khác được chạy. Đây là lý do thread **vẫn rất hữu ích** cho I/O-bound
2. **Định kỳ**: cứ khoảng **5ms**, thread đang giữ GIL bị yêu cầu nhả để thread khác có cơ hội chạy
3. **Trong một số thư viện C**: NumPy, `hashlib` (với dữ liệu lớn), `zlib`... nhả GIL khi tính toán bên trong C → thread có thể chạy song song thật

```python
import sys

print(sys.getswitchinterval())  # Khoảng thời gian (giây) trước khi buộc chuyền GIL
# Output: 0.005
```

### Chứng minh: thread KHÔNG tăng tốc CPU-bound

```python
import threading
import time


def count_down(n: int) -> None:
    while n > 0:
        n -= 1


N = 20_000_000

# Cách 1: tuần tự - chạy 2 lần liên tiếp
start = time.perf_counter()
count_down(N)
count_down(N)
print(f"Tuần tự:   {time.perf_counter() - start:.2f}s")

# Cách 2: 2 thread chạy "cùng lúc"
start = time.perf_counter()
t1 = threading.Thread(target=count_down, args=(N,))
t2 = threading.Thread(target=count_down, args=(N,))
t1.start()
t2.start()
t1.join()
t2.join()
print(f"2 thread:  {time.perf_counter() - start:.2f}s")
# Output (ví dụ):
# Tuần tự:   1.02s
# 2 thread:  1.01s
```

2 thread **không nhanh hơn chút nào** - tổng thời gian gần như bằng chạy tuần tự (có lần còn chậm hơn vì tốn công chuyền GIL qua lại). Hai thread chỉ thay nhau cầm "micro", không bao giờ cùng chạy. Ở mục 4 bạn sẽ thấy `ProcessPoolExecutor` giải quyết đúng bài toán này.

### Tương lai của GIL

- **Python 3.13** (10/2024) có bản build thử nghiệm **"free-threaded"** (PEP 703) **không có GIL** (`python3.13t`). Từ **3.14** bản này được hỗ trợ chính thức nhưng vẫn là tùy chọn, và nhiều thư viện đang dần tương thích
- Với Python 3.11 (khóa học này) và phần lớn môi trường production hiện nay, bạn vẫn nên **giả định có GIL**

> ⚠️ **GIL không bảo vệ code của BẠN khỏi race condition!** GIL chỉ bảo vệ **bên trong** trình thông dịch. Một phép `counter += 1` gồm nhiều bước bytecode (đọc - cộng - ghi), và thread có thể bị ngắt **giữa các bước**. Xem mục 3.

## 📖 3. threading - Làm việc với luồng

### Tạo và chạy thread

```python
import threading
import time


def download(filename: str, seconds: float) -> None:
    print(f"⬇️  Bắt đầu tải {filename}")
    time.sleep(seconds)                         # Giả lập chờ mạng → GIL được nhả
    print(f"✅ Xong {filename}")


start = time.perf_counter()
threads = [
    threading.Thread(target=download, args=("anh1.jpg", 0.3)),
    threading.Thread(target=download, args=("anh2.jpg", 0.1)),
    threading.Thread(target=download, args=("anh3.jpg", 0.2)),
]
for t in threads:
    t.start()           # Bắt đầu chạy (KHÔNG chờ)
for t in threads:
    t.join()            # Chờ thread kết thúc
print(f"Tổng thời gian: {time.perf_counter() - start:.1f}s (tuần tự sẽ mất 0.6s)")
# Output (ví dụ):
# ⬇️  Bắt đầu tải anh1.jpg
# ⬇️  Bắt đầu tải anh2.jpg
# ⬇️  Bắt đầu tải anh3.jpg
# ✅ Xong anh2.jpg
# ✅ Xong anh3.jpg
# ✅ Xong anh1.jpg
# Tổng thời gian: 0.3s (tuần tự sẽ mất 0.6s)
```

> 💡 Thứ tự các dòng "Bắt đầu" có thể xáo trộn, thậm chí hai dòng `print` từ hai thread có thể **dính vào nhau** trên cùng một dòng - vì `print` ghi nội dung và ký tự xuống dòng thành các bước riêng. Đây là dấu hiệu đầu tiên của việc "nhiều thread dùng chung một tài nguyên" (ở đây là màn hình).

Ghi nhớ:

- `start()` **khởi động** thread rồi trả về ngay. Đừng gọi `run()` trực tiếp - nó sẽ chạy hàm trong **thread hiện tại** (không đồng thời gì cả!)
- `join()` = "đứng chờ thread này làm xong". Quên `join()` → chương trình chính có thể đi tiếp khi dữ liệu chưa sẵn sàng
- Thread **không trả về giá trị** trực tiếp. Muốn lấy kết quả, hãy ghi vào list/dict/Queue dùng chung, hoặc dùng `ThreadPoolExecutor` (mục 4) - cách hiện đại và tiện hơn nhiều

### Daemon thread - "Luồng nền"

Mặc định, chương trình Python **chờ tất cả thread thường kết thúc** rồi mới thoát. **Daemon thread** thì khác: khi luồng chính kết thúc, daemon thread **bị dừng ngay lập tức**.

```python
import threading
import time


def heartbeat():
    while True:                                 # Vòng lặp vô hạn!
        print("💓 still alive")
        time.sleep(0.1)


# daemon=True: không giữ chương trình lại khi main kết thúc
t = threading.Thread(target=heartbeat, daemon=True)
t.start()
time.sleep(0.25)
print("Main kết thúc → daemon thread bị dừng theo")
# Output (ví dụ):
# 💓 still alive
# 💓 still alive
# 💓 still alive
# Main kết thúc → daemon thread bị dừng theo
```

Nếu bỏ `daemon=True`, chương trình trên sẽ **chạy mãi không dừng**. Dùng daemon cho các việc "phụ" như gửi heartbeat, tự động lưu định kỳ...

> ⚠️ Daemon thread bị "cắt ngang" đột ngột - **không được dọn dẹp** (`finally` có thể không chạy). Đừng dùng daemon cho việc ghi file/DB quan trọng. Với việc cần dừng êm, hãy dùng `threading.Event` làm "cờ báo dừng" (xem Bài tập 2).

### Race condition - Khi các thread "giẫm chân" nhau

**Race condition** (tranh chấp dữ liệu) xảy ra khi nhiều thread cùng **đọc - sửa - ghi** một dữ liệu chung và kết quả phụ thuộc vào **thứ tự may rủi** các thread được chạy.

> 🧠 **Ví dụ dễ hiểu - Tài khoản chung**: Vợ và chồng có chung tài khoản 100 nghìn. Cùng lúc, vợ rút 80k ở ATM A, chồng rút 80k ở ATM B. Cả hai máy **cùng kiểm tra** "số dư 100k ≥ 80k? OK!", rồi **cùng trừ tiền** → tài khoản còn **-60k**. Ngân hàng lỗ vì hai máy không "xếp hàng" khi thao tác với cùng một tài khoản.

```python
import threading
import time


class BankAccount:
    def __init__(self, balance: int):
        self.balance = balance

    def withdraw(self, amount: int) -> None:
        if self.balance >= amount:          # Bước 1: kiểm tra
            time.sleep(0.001)               # Bước 2: xử lý chậm (gọi DB...) → thread khác chen vào!
            self.balance -= amount          # Bước 3: trừ tiền


account = BankAccount(100)
threads = [threading.Thread(target=account.withdraw, args=(80,)) for _ in range(5)]
for t in threads:
    t.start()
for t in threads:
    t.join()
print(f"Số dư: {account.balance}")
# Output (ví dụ):
# Số dư: -300
```

5 thread đều thấy "100 ≥ 80" **trước khi** bất kỳ ai kịp trừ tiền → cả 5 lần rút đều thành công. Lỗi kiểu này rất nguy hiểm vì **lúc có lúc không** - chạy thử 10 lần có thể đúng cả 10, lên production mới sai.

> 💡 Ngay cả `counter += 1` cũng **không an toàn** giữa các thread: nó được dịch thành nhiều lệnh bytecode (`LOAD` → `ADD` → `STORE`), và thread có thể bị chuyển **giữa** các lệnh đó.

### Lock - Khóa để "xếp hàng"

`threading.Lock` đảm bảo **chỉ một thread** được vào đoạn code "nhạy cảm" (**critical section**) tại một thời điểm. Thread khác phải **đứng chờ** tới lượt.

```python
import threading
import time


class SafeBankAccount:
    def __init__(self, balance: int):
        self.balance = balance
        self._lock = threading.Lock()

    def withdraw(self, amount: int) -> bool:
        with self._lock:                    # Chỉ 1 thread được vào khối này tại 1 thời điểm
            if self.balance >= amount:
                time.sleep(0.001)
                self.balance -= amount
                return True
            return False


account = SafeBankAccount(100)
results = []
threads = [
    threading.Thread(target=lambda: results.append(account.withdraw(80)))
    for _ in range(5)
]
for t in threads:
    t.start()
for t in threads:
    t.join()
print(f"Số dư: {account.balance}")
print(f"Thành công: {results.count(True)}, thất bại: {results.count(False)}")
# Output:
# Số dư: 20
# Thành công: 1, thất bại: 4
```

Quy tắc dùng Lock:

- **Luôn dùng `with lock:`** thay vì `lock.acquire()` / `lock.release()` - nếu có exception, `with` vẫn nhả khóa (nhớ lại context manager ở Bài 9)
- Giữ khóa **càng ngắn càng tốt** - đừng làm việc chậm (gọi mạng) trong lúc giữ khóa nếu không cần
- **Deadlock** (khóa chết): thread A giữ khóa 1 chờ khóa 2, thread B giữ khóa 2 chờ khóa 1 → cả hai chờ nhau mãi mãi. Phòng tránh: luôn lấy các khóa **theo cùng một thứ tự**
- `threading.RLock` (reentrant lock): cho phép **cùng một thread** lấy khóa nhiều lần (khi hàm có khóa gọi hàm khác cũng lấy khóa đó)

### queue.Queue - Cách an toàn nhất để các thread trao đổi dữ liệu

Thay vì chia sẻ biến rồi khóa lung tung, cách "sạch" hơn là để các thread **gửi dữ liệu cho nhau qua hàng đợi**. `queue.Queue` đã được khóa sẵn bên trong - an toàn tuyệt đối giữa các thread.

> 🧠 **Ví dụ dễ hiểu - Băng chuyền sushi** 🍣: đầu bếp (**producer**) đặt đĩa lên băng chuyền, khách (**consumer**) lấy đĩa xuống ăn. Đầu bếp không cần biết ai ăn, khách không cần biết ai nấu. Băng chuyền (**Queue**) lo phần phối hợp.

```python
import queue
import threading
import time

STOP = None                                     # "Viên thuốc độc" (sentinel) báo worker dừng


def producer(q: queue.Queue, orders: list[str]) -> None:
    for order in orders:
        q.put(order)                            # Đặt việc lên băng chuyền


def worker(name: str, q: queue.Queue, done: list[str]) -> None:
    while True:
        order = q.get()                         # Chờ (block) cho tới khi có việc
        if order is STOP:
            q.task_done()
            break
        time.sleep(0.05)                        # Giả lập xử lý đơn hàng
        done.append(f"{order} ({name})")
        q.task_done()                           # Báo "việc này xong rồi"


q: queue.Queue = queue.Queue(maxsize=10)        # maxsize: băng chuyền đầy thì producer phải chờ
done: list[str] = []
workers = [threading.Thread(target=worker, args=(f"W{i}", q, done)) for i in range(3)]
for w in workers:
    w.start()

start = time.perf_counter()
producer(q, [f"Đơn #{i}" for i in range(1, 10)])
q.join()                                        # Chờ tới khi MỌI việc đều được task_done()
for _ in workers:
    q.put(STOP)                                 # Mỗi worker nhận 1 viên "thuốc độc"
for w in workers:
    w.join()

print(f"Đã xử lý {len(done)} đơn trong {time.perf_counter() - start:.2f}s")
print(sorted(done, key=lambda s: int(s.split("#")[1].split()[0]))[:3])
# Output (ví dụ):
# Đã xử lý 9 đơn trong 0.15s
# ['Đơn #1 (W0)', 'Đơn #2 (W1)', 'Đơn #3 (W2)']
```

9 đơn × 0.05s = 0.45s nếu làm tuần tự, nhưng 3 worker chia nhau chỉ mất ~0.15s.

> 💡 `list.append` trong CPython là thao tác "nguyên tử" (atomic) nên ví dụ trên an toàn khi ghi vào `done`. Nhưng đừng dựa vào điều này cho các thao tác phức tạp hơn - dùng `Queue` hoặc `Lock`.

## 📖 4. concurrent.futures - Cách hiện đại để chạy song song

Tự tạo `Thread`, tự `join`, tự thu kết quả... khá mệt. Module `concurrent.futures` cung cấp **"bể" (pool) worker** với API cực kỳ gọn, và **cùng một API** cho cả thread lẫn process.

> 🧠 **Ví dụ dễ hiểu - Công ty dịch vụ**: Thay vì mỗi lần có việc lại đi **tuyển** nhân viên mới (tạo thread - tốn kém), bạn thuê sẵn một **đội 5 người** (pool). Có việc thì **giao** (`submit`), nhận lại **phiếu hẹn** (`Future`). Khi cần kết quả, đưa phiếu hẹn ra để lấy (`future.result()`).

### ThreadPoolExecutor: submit và Future

```python
import time
from concurrent.futures import ThreadPoolExecutor


def download(url: str, seconds: float) -> str:
    time.sleep(seconds)
    return f"<html của {url}>"


with ThreadPoolExecutor(max_workers=3) as executor:     # Thoát with → tự chờ mọi việc xong
    future = executor.submit(download, "a.com", 0.1)    # Giao việc, nhận "phiếu hẹn"
    print(type(future).__name__, "- xong chưa?", future.done())
    print(future.result())                              # Chờ và lấy kết quả
    print("Xong chưa?", future.done())
# Output:
# Future - xong chưa? False
# <html của a.com>
# Xong chưa? True
```

### as_completed - Xử lý kết quả ngay khi có

`as_completed` trả về các future **theo thứ tự hoàn thành** (việc nào xong trước trả về trước) - rất hợp để hiển thị tiến độ.

```python
import time
from concurrent.futures import ThreadPoolExecutor, as_completed


def download(name: str, seconds: float) -> str:
    time.sleep(seconds)
    if name == "hỏng.jpg":
        raise ConnectionError("mất kết nối")
    return f"{name} ({seconds}s)"


jobs = {"a.jpg": 0.3, "b.jpg": 0.1, "hỏng.jpg": 0.15, "c.jpg": 0.2}

with ThreadPoolExecutor(max_workers=4) as executor:
    # Map future → tên file để biết future nào ứng với việc nào
    futures = {executor.submit(download, name, sec): name for name, sec in jobs.items()}
    for future in as_completed(futures):
        name = futures[future]
        try:
            print("✅", future.result())       # Exception trong thread được "ném lại" ở đây
        except ConnectionError as e:
            print(f"❌ {name}: {e}")
# Output:
# ✅ b.jpg (0.1s)
# ❌ hỏng.jpg: mất kết nối
# ✅ c.jpg (0.2s)
# ✅ a.jpg (0.3s)
```

> ⚠️ Exception xảy ra trong worker **không tự hiện ra**! Nó được cất trong `Future` và chỉ bị ném ra khi bạn gọi `future.result()`. Nếu bạn `submit` mà không bao giờ gọi `result()`, lỗi sẽ **biến mất lặng lẽ**.

### executor.map - Giống map() nhưng chạy song song

`executor.map(func, iterable)` trả kết quả **đúng theo thứ tự đầu vào** (khác `as_completed`):

```python
import time
from concurrent.futures import ThreadPoolExecutor


def fetch_price(product: str) -> tuple[str, int]:
    time.sleep(0.1)                                     # Giả lập gọi API
    prices = {"iPhone": 25_000_000, "Galaxy": 20_000_000, "Pixel": 18_000_000}
    return product, prices[product]


start = time.perf_counter()
with ThreadPoolExecutor(max_workers=3) as executor:
    for product, price in executor.map(fetch_price, ["iPhone", "Galaxy", "Pixel"]):
        print(f"{product:<8} {price:>12,}đ")
print(f"Thời gian: {time.perf_counter() - start:.1f}s")
# Output:
# iPhone     25,000,000đ
# Galaxy     20,000,000đ
# Pixel      18,000,000đ
# Thời gian: 0.1s
```

### ProcessPoolExecutor - Song song thật cho CPU-bound

Chỉ cần **đổi tên class** là chuyển từ thread sang process:

```python
import time
from concurrent.futures import ProcessPoolExecutor


def count_primes(limit: int) -> int:
    """Đếm số nguyên tố < limit bằng cách thử chia - cố ý viết chậm để tốn CPU."""
    count = 0
    for n in range(2, limit):
        if all(n % d for d in range(2, int(n**0.5) + 1)):
            count += 1
    return count


if __name__ == "__main__":                  # ⚠️ BẮT BUỘC với process (giải thích ở mục 5)
    limits = [150_000] * 4

    start = time.perf_counter()
    sequential = [count_primes(x) for x in limits]
    print(f"Tuần tự:        {time.perf_counter() - start:.2f}s → {sequential}")

    start = time.perf_counter()
    with ProcessPoolExecutor() as executor:   # Mặc định: số worker = số lõi CPU
        parallel = list(executor.map(count_primes, limits))
    print(f"ProcessPool:    {time.perf_counter() - start:.2f}s → {parallel}")
# Output (ví dụ):
# Tuần tự:        0.68s → [13848, 13848, 13848, 13848]
# ProcessPool:    0.25s → [13848, 13848, 13848, 13848]
```

Trên máy 4 lõi, tốc độ tăng khoảng **3-4 lần**. Không đạt đúng 4 lần vì tốn chi phí khởi động tiến trình và truyền dữ liệu.

**Điều kiện** để dùng `ProcessPoolExecutor`:

- Hàm và tham số phải **pickle được** (tuần tự hóa để gửi sang tiến trình khác) → hàm phải định nghĩa ở **cấp module** (không dùng `lambda`, không dùng hàm lồng trong hàm)
- Dữ liệu truyền qua lại **càng nhỏ càng tốt** - gửi 1GB dữ liệu sang process khác có thể tốn thời gian hơn chính việc tính toán
- Với rất nhiều việc nhỏ, dùng `executor.map(func, items, chunksize=100)` để gửi theo lô, giảm chi phí giao tiếp

### 💡 Tips quan trọng

- **`ThreadPoolExecutor` cho I/O, `ProcessPoolExecutor` cho CPU** - API giống hệt nhau ✅
- Luôn dùng **`with`** để pool tự đóng và chờ các việc còn lại ✅
- Muốn **thứ tự đầu vào** → `map`. Muốn **xong trước xử lý trước** → `submit` + `as_completed` ✅
- Đừng quên gọi `.result()` - nếu không, lỗi bị nuốt mất ❌
- `max_workers` cho thread I/O thường 5-50 (tùy server đích chịu được bao nhiêu); cho process thường = số lõi CPU ✅

## 📖 5. multiprocessing - Nhiều tiến trình

`concurrent.futures.ProcessPoolExecutor` thực ra được xây trên module `multiprocessing`. Dùng trực tiếp `multiprocessing` khi bạn cần kiểm soát chi tiết hơn: tiến trình chạy lâu, chia sẻ dữ liệu, `imap_unordered`...

> 🧠 **Ví dụ dễ hiểu**: Thread giống **nhiều nhân viên ngồi chung một văn phòng** - dùng chung bàn, chung tủ hồ sơ (bộ nhớ), trao đổi dễ nhưng hay tranh nhau đồ. Process giống **nhiều chi nhánh ở các tòa nhà khác nhau** - mỗi nơi có tủ hồ sơ riêng, không ai giẫm chân ai, nhưng muốn trao đổi phải **gửi bưu điện** (pickle dữ liệu qua pipe).

### Process - Tạo tiến trình thủ công

```python
import multiprocessing as mp
import os


def work(name: str) -> None:
    # Mỗi tiến trình có PID (mã số tiến trình) riêng
    print(f"{name}: PID con khác PID cha? {os.getpid() != os.getppid()}")


if __name__ == "__main__":
    processes = [mp.Process(target=work, args=(f"Tiến trình {i}",)) for i in range(3)]
    for p in processes:
        p.start()
    for p in processes:
        p.join()
    print("Số lõi CPU:", mp.cpu_count() > 0)
# Output (ví dụ):
# Tiến trình 0: PID con khác PID cha? True
# Tiến trình 1: PID con khác PID cha? True
# Tiến trình 2: PID con khác PID cha? True
# Số lõi CPU: True
```

### Tại sao BẮT BUỘC `if __name__ == "__main__"`?

Trên **Windows** và **macOS** (mặc định từ Python 3.8), tiến trình con được tạo theo kiểu **"spawn"**: khởi động một trình thông dịch Python **mới tinh**, rồi **import lại file .py của bạn** để tìm hàm cần chạy.

Nếu code tạo process nằm ở cấp module (không có guard), thì khi tiến trình con import lại file → nó lại **tạo tiến trình con mới** → tiến trình cháu lại import → ... **vòng lặp vô tận**. Python phát hiện và báo lỗi:

```text
RuntimeError:
        An attempt has been made to start a new process before the
        current process has finished its bootstrapping phase.
        ...
        if __name__ == '__main__':
            freeze_support()
```

Với guard, khi tiến trình con import file, `__name__` của nó là `"__mp_main__"` (không phải `"__main__"`) → khối code tạo process **không chạy lại**. Trên Linux, mặc định là kiểu **"fork"** (sao chép tiến trình cha) nên code không guard *có thể* vẫn chạy - nhưng **luôn viết guard** để code chạy được trên mọi hệ điều hành.

> ⚠️ Cũng vì "spawn" import lại file, nên mọi code ở cấp module (đọc file, `print`, kết nối DB...) sẽ chạy lại **trong mỗi tiến trình con**. Hãy đưa hết vào hàm `main()` và gọi trong guard.

### Pool - Bể tiến trình

```python
import multiprocessing as mp


def square(x: int) -> int:
    return x * x


def power(base: int, exp: int) -> int:
    return base**exp


if __name__ == "__main__":
    with mp.Pool(processes=4) as pool:
        print(pool.map(square, range(10)))                  # Giữ thứ tự
        print(pool.starmap(power, [(2, 3), (3, 2), (10, 3)]))  # Nhiều tham số: truyền tuple
        # imap_unordered: trả về dần dần, xong trước trả trước → tiết kiệm RAM với dữ liệu lớn
        print(sorted(pool.imap_unordered(square, range(5), chunksize=2)))
# Output:
# [0, 1, 4, 9, 16, 25, 36, 49, 64, 81]
# [8, 9, 1000]
# [0, 1, 4, 9, 16]
```

### Chia sẻ dữ liệu giữa các tiến trình

Mỗi tiến trình có **bộ nhớ riêng**. Sửa biến toàn cục trong tiến trình con **không ảnh hưởng** tiến trình cha:

```python
import multiprocessing as mp

counter = 0


def increment() -> None:
    global counter
    counter += 100                    # Chỉ sửa BẢN SAO trong tiến trình con


if __name__ == "__main__":
    p = mp.Process(target=increment)
    p.start()
    p.join()
    print("counter ở tiến trình cha:", counter)
# Output: counter ở tiến trình cha: 0
```

Có 3 cách chia sẻ, xếp theo mức độ nên dùng:

1. ✅ **Trả kết quả về** (qua `Pool.map`, `Future.result()`) - đơn giản và an toàn nhất. Hãy thiết kế để mỗi tiến trình làm việc **độc lập** rồi gộp kết quả ở cuối
2. ✅ **`mp.Queue`** - gửi message giữa các tiến trình (giống `queue.Queue` nhưng xuyên tiến trình)
3. ⚠️ **Bộ nhớ chia sẻ**: `mp.Value`, `mp.Array` (kiểu đơn giản, nhanh) hoặc `mp.Manager()` (dict/list, chậm hơn nhưng linh hoạt). Nhớ **khóa** khi sửa!

```python
import multiprocessing as mp


def add_sales(total, lock, amounts: list[int]) -> None:
    for amount in amounts:
        with lock:                               # Value cũng bị race condition → cần khóa
            total.value += amount


def record(shared: dict, region: str, amount: int) -> None:
    shared[region] = amount                      # Manager dict: ghi được từ tiến trình con


if __name__ == "__main__":
    # Cách 3a: Value - một số dùng chung ('q' = long long, số nguyên 64-bit)
    total = mp.Value("q", 0)
    lock = mp.Lock()
    workers = [mp.Process(target=add_sales, args=(total, lock, [100] * 1000)) for _ in range(4)]
    for w in workers:
        w.start()
    for w in workers:
        w.join()
    print("Tổng doanh số:", total.value)

    # Cách 3b: Manager - dict dùng chung
    with mp.Manager() as manager:
        shared = manager.dict()
        jobs = [mp.Process(target=record, args=(shared, r, a))
                for r, a in [("Bắc", 120), ("Trung", 80), ("Nam", 150)]]
        for j in jobs:
            j.start()
        for j in jobs:
            j.join()
        print("Theo khu vực:", dict(sorted(shared.items())))
# Output:
# Tổng doanh số: 400000
# Theo khu vực: {'Bắc': 120, 'Nam': 150, 'Trung': 80}
```

### 💡 Tips quan trọng

- **Luôn** có `if __name__ == "__main__":` khi dùng process ✅
- Ưu tiên `ProcessPoolExecutor` / `Pool` - hiếm khi cần tự tạo `Process` ✅
- Thiết kế để các tiến trình **không cần chia sẻ** - trả kết quả về rồi gộp lại ✅
- Tạo process tốn ~50-100ms và vài chục MB RAM - **đừng** dùng process cho việc chỉ mất vài mili-giây ❌
- Trong Jupyter Notebook, `ProcessPoolExecutor` với hàm định nghĩa trong notebook có thể lỗi trên Windows/macOS → đưa hàm ra file `.py` riêng rồi import ✅

## 📖 6. asyncio chuyên sâu

### Nhắc lại: event loop hoạt động thế nào?

> 🧠 **Ví dụ dễ hiểu - Người phục vụ nhà hàng** 🧑‍🍳: Một người phục vụ (**event loop**, chạy trên **một** luồng) phục vụ 20 bàn. Nhận order bàn 1 → đưa xuống bếp → **không đứng chờ** món chín mà đi nhận order bàn 2, bàn 3... Khi bếp báo "món bàn 1 xong" thì quay lại bưng ra. Mỗi `await` chính là lúc người phục vụ nói: *"Tôi phải chờ, tôi đi làm việc khác đây"*.

Hệ quả quan trọng:

- Coroutine chỉ **nhường quyền** tại `await`. Code giữa hai `await` chạy **liền một mạch** → không bị race condition kiểu thread ở những đoạn đó
- Nếu một coroutine **không bao giờ await** (tính toán nặng, `time.sleep`) → cả nhà hàng **đứng hình**

### Coroutine vs Task

- **Coroutine**: gọi `fetch()` chỉ tạo ra object coroutine - **chưa chạy gì cả** (như tờ công thức nấu ăn)
- **Task**: `asyncio.create_task(fetch())` đưa coroutine vào **lịch của event loop** - nó sẽ chạy **ngay khi** loop rảnh (như đưa công thức cho bếp nấu)

```python
import asyncio
import time


async def job(name: str, seconds: float) -> str:
    await asyncio.sleep(seconds)
    return name


async def main():
    # ❌ await lần lượt từng coroutine → TUẦN TỰ
    start = time.perf_counter()
    await job("A", 0.2)
    await job("B", 0.2)
    print(f"Await tuần tự: {time.perf_counter() - start:.1f}s")

    # ✅ Tạo task trước → cả hai được lên lịch và chạy ĐỒNG THỜI
    start = time.perf_counter()
    task_a = asyncio.create_task(job("A", 0.2))
    task_b = asyncio.create_task(job("B", 0.2))
    print("Task đang chạy nền, main làm việc khác...")
    results = [await task_a, await task_b]
    print(f"Tạo task: {time.perf_counter() - start:.1f}s → {results}")


asyncio.run(main())
# Output:
# Await tuần tự: 0.4s
# Task đang chạy nền, main làm việc khác...
# Tạo task: 0.2s → ['A', 'B']
```

> ⚠️ **Giữ tham chiếu tới task!** Event loop chỉ giữ tham chiếu "yếu" (weak reference) tới task. Nếu bạn viết `asyncio.create_task(job())` mà không gán vào biến nào, task có thể bị **garbage collector dọn mất giữa chừng**. Hãy lưu vào biến/list/set, hoặc dùng `TaskGroup` (bên dưới).

### gather vs TaskGroup (Python 3.11+)

Bài 9 đã giới thiệu `asyncio.gather`. Python 3.11 thêm **`asyncio.TaskGroup`** - cách được khuyến nghị cho code mới vì xử lý lỗi **an toàn hơn** (gọi là *structured concurrency*).

Khác biệt quan trọng nhất nằm ở **khi có một task bị lỗi**:

```python
import asyncio


async def job(name: str, seconds: float, fail: bool = False) -> str:
    try:
        await asyncio.sleep(seconds)
        if fail:
            raise ValueError(f"{name} hỏng")
        print(f"  ✅ {name} xong")
        return name
    except asyncio.CancelledError:
        print(f"  🛑 {name} bị hủy")
        raise                                   # Luôn raise lại CancelledError!


async def demo_gather():
    print("gather:")
    try:
        await asyncio.gather(job("A", 0.1, fail=True), job("B", 0.2))
    except ValueError as e:
        print(f"  Bắt được: {e}")
    await asyncio.sleep(0.2)                    # Chờ thêm để thấy B vẫn chạy "mồ côi"


async def demo_taskgroup():
    print("TaskGroup:")
    try:
        async with asyncio.TaskGroup() as tg:
            tg.create_task(job("A", 0.1, fail=True))
            tg.create_task(job("B", 0.2))
    except* ValueError as eg:                   # except* bắt ExceptionGroup (3.11+)
        for e in eg.exceptions:
            print(f"  Bắt được: {e}")


asyncio.run(demo_gather())
asyncio.run(demo_taskgroup())
# Output:
# gather:
#   Bắt được: A hỏng
#   ✅ B xong
# TaskGroup:
#   🛑 B bị hủy
#   Bắt được: A hỏng
```

- **`gather`**: A lỗi → exception ném ra ngay cho bạn, nhưng **B vẫn tiếp tục chạy ngầm** ("mồ côi") - không ai chờ nó, lỗi của nó (nếu có) có thể bị mất
- **`TaskGroup`**: A lỗi → **tự động hủy** mọi task còn lại (B), chờ chúng dọn dẹp xong, rồi ném **`ExceptionGroup`** chứa **tất cả** lỗi. Khi ra khỏi khối `async with`, bạn **chắc chắn** không còn task nào chạy ngầm

| | `asyncio.gather` | `asyncio.TaskGroup` |
| --- | --- | --- |
| Có từ | Python 3.4 | Python 3.11 |
| Khi 1 task lỗi | Ném lỗi đầu tiên, task khác **vẫn chạy** | **Hủy** task khác, ném `ExceptionGroup` |
| Thu kết quả | Trả về list theo thứ tự | Gọi `task.result()` sau khối `async with` |
| "Chấp nhận lỗi, lấy hết kết quả" | ✅ `return_exceptions=True` | ❌ Tự bọc `try/except` trong từng coroutine |
| Khuyến nghị | Khi cần `return_exceptions=True` | **Mặc định cho code mới** |

Lấy kết quả từ TaskGroup:

```python
import asyncio


async def get_user(user_id: int) -> dict:
    await asyncio.sleep(0.1)
    return {"id": user_id, "name": f"User{user_id}"}


async def main():
    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(get_user(i)) for i in range(1, 4)]
    # Ra khỏi khối with = mọi task đã xong
    print([t.result()["name"] for t in tasks])


asyncio.run(main())
# Output: ['User1', 'User2', 'User3']
```

### Timeout với asyncio.timeout (Python 3.11+)

Không bao giờ nên chờ mạng **vô thời hạn**. Python 3.11 có `asyncio.timeout()` - một **async context manager** áp giới hạn thời gian cho **cả một khối code** (có thể gồm nhiều `await`):

```python
import asyncio


async def slow_api() -> str:
    await asyncio.sleep(1)
    return "dữ liệu"


async def main():
    try:
        async with asyncio.timeout(0.2):            # Cả khối phải xong trong 0.2s
            data = await slow_api()
            print("Nhận:", data)
    except TimeoutError:                            # 3.11+: chính là built-in TimeoutError
        print("⏰ Quá 0.2s, bỏ qua!")

    # Cách cũ (vẫn dùng được): wait_for cho MỘT coroutine
    try:
        await asyncio.wait_for(slow_api(), timeout=0.1)
    except TimeoutError:
        print("⏰ wait_for cũng hết giờ")


asyncio.run(main())
# Output:
# ⏰ Quá 0.2s, bỏ qua!
# ⏰ wait_for cũng hết giờ
```

### Semaphore - Giới hạn số việc chạy cùng lúc

Tạo 10.000 task gọi API cùng lúc = tự "tấn công DDoS" server người ta (và bị chặn), hoặc hết file descriptor trên máy bạn. **`asyncio.Semaphore(n)`** cho phép tối đa **n** coroutine vào một khối code cùng lúc.

> 🧠 **Ví dụ dễ hiểu**: Semaphore giống **bãi giữ xe có 3 chỗ** 🅿️ và một bảo vệ phát thẻ. Còn thẻ → vào. Hết thẻ → đứng chờ tới khi có xe ra trả thẻ. `Lock` chính là bãi xe chỉ có **1** chỗ.

```python
import asyncio

running = 0
max_seen = 0


async def download(i: int, sem: asyncio.Semaphore) -> int:
    global running, max_seen
    async with sem:                     # Lấy 1 "thẻ"; hết thẻ thì chờ
        running += 1
        max_seen = max(max_seen, running)
        await asyncio.sleep(0.05)
        running -= 1
        return i


async def main():
    sem = asyncio.Semaphore(3)          # Tối đa 3 việc cùng lúc
    results = await asyncio.gather(*(download(i, sem) for i in range(10)))
    print(f"Tải {len(results)} file, tối đa đồng thời: {max_seen}")


asyncio.run(main())
# Output: Tải 10 file, tối đa đồng thời: 3
```

> 💡 Ở đây ta sửa biến toàn cục `running` mà không cần Lock - vì asyncio chạy trên **một luồng** và không có `await` nào giữa `running += 1` và `max_seen = ...`, nên không coroutine nào chen vào được.

### asyncio.Queue - Producer-Consumer bất đồng bộ

Giống `queue.Queue` của thread, nhưng dùng `await queue.get()` / `await queue.put()`. Đây là mô hình chuẩn cho crawler, pipeline xử lý dữ liệu... (xem ứng dụng thực tế số 3).

```python
import asyncio


async def producer(queue: asyncio.Queue, n: int) -> None:
    for i in range(1, n + 1):
        await queue.put(f"job-{i}")            # Queue đầy (maxsize) → chờ
    print(f"📦 Producer đã đưa {n} việc vào hàng đợi")


async def consumer(name: str, queue: asyncio.Queue, done: list[str]) -> None:
    while True:
        job = await queue.get()                # Queue rỗng → chờ
        try:
            await asyncio.sleep(0.05)          # Xử lý việc
            done.append(job)
        finally:
            queue.task_done()                  # Luôn báo xong, kể cả khi lỗi


async def main():
    queue: asyncio.Queue[str] = asyncio.Queue(maxsize=5)
    done: list[str] = []
    consumers = [asyncio.create_task(consumer(f"C{i}", queue, done)) for i in range(3)]

    await producer(queue, 12)
    await queue.join()                         # Chờ mọi việc được task_done()

    for c in consumers:                        # Consumer chạy vòng vô hạn → hủy chúng
        c.cancel()
    await asyncio.gather(*consumers, return_exceptions=True)
    print(f"✅ Đã xử lý {len(done)} việc")


asyncio.run(main())
# Output:
# 📦 Producer đã đưa 12 việc vào hàng đợi
# ✅ Đã xử lý 12 việc
```

### Hủy task (cancellation)

`task.cancel()` yêu cầu hủy: lần `await` tiếp theo bên trong task sẽ ném ra **`asyncio.CancelledError`**. Task có cơ hội dọn dẹp trong `finally`.

```python
import asyncio


async def long_job() -> None:
    try:
        print("🔄 Bắt đầu việc dài")
        await asyncio.sleep(10)
        print("Không bao giờ in dòng này")
    except asyncio.CancelledError:
        print("🧹 Bị hủy → dọn dẹp (đóng file, rollback...)")
        raise                                  # ⚠️ PHẢI raise lại
    finally:
        print("🔚 finally luôn chạy")


async def main():
    task = asyncio.create_task(long_job())
    await asyncio.sleep(0.1)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        print("Main xác nhận: task đã bị hủy =", task.cancelled())


asyncio.run(main())
# Output:
# 🔄 Bắt đầu việc dài
# 🧹 Bị hủy → dọn dẹp (đóng file, rollback...)
# 🔚 finally luôn chạy
# Main xác nhận: task đã bị hủy = True
```

> ⚠️ **Đừng "nuốt" `CancelledError`** (bắt rồi không raise lại). Nếu nuốt, `TaskGroup`, `asyncio.timeout()` và việc tắt chương trình sẽ hoạt động sai - chúng dựa vào exception này để biết task đã dừng. Cũng vì vậy, tránh `except BaseException:` trong code async.

### async with và async for

Nhiều tài nguyên bất đồng bộ (kết nối HTTP, DB) cần `await` khi mở/đóng → dùng **`async with`**. Dữ liệu đến dần dần qua mạng (stream, phân trang) → dùng **`async for`**.

```python
import asyncio
from contextlib import asynccontextmanager


class FakeConnection:
    """Async context manager tự viết: __aenter__ / __aexit__."""

    async def __aenter__(self):
        await asyncio.sleep(0.01)              # Giả lập bắt tay kết nối
        print("🔌 Mở kết nối")
        return self

    async def __aexit__(self, exc_type, exc, tb):
        await asyncio.sleep(0.01)
        print("🔌 Đóng kết nối")
        return False                           # Không nuốt exception

    async def query(self, sql: str) -> str:
        await asyncio.sleep(0.01)
        return f"kết quả của '{sql}'"


@asynccontextmanager                           # Cách ngắn gọn (giống @contextmanager ở Bài 9)
async def timer(label: str):
    loop = asyncio.get_running_loop()
    start = loop.time()
    try:
        yield
    finally:
        print(f"⏱️ {label}: {loop.time() - start >= 0}")


async def fetch_pages(total_pages: int):
    """Async generator: vừa await vừa yield → dùng với async for."""
    for page in range(1, total_pages + 1):
        await asyncio.sleep(0.01)              # Giả lập gọi API trang tiếp theo
        yield [f"item-{page}-{i}" for i in range(2)]


async def main():
    async with timer("Toàn bộ"):
        async with FakeConnection() as conn:
            print(await conn.query("SELECT 1"))
        async for items in fetch_pages(3):
            print("Nhận:", items)
        # Async comprehension
        all_items = [item async for page in fetch_pages(2) for item in page]
        print("Tổng:", len(all_items))


asyncio.run(main())
# Output:
# 🔌 Mở kết nối
# kết quả của 'SELECT 1'
# 🔌 Đóng kết nối
# Nhận: ['item-1-0', 'item-1-1']
# Nhận: ['item-2-0', 'item-2-1']
# Nhận: ['item-3-0', 'item-3-1']
# Tổng: 4
# ⏱️ Toàn bộ: True
```

### asyncio.to_thread - Chạy code "chặn" mà không đóng băng event loop

Thực tế bạn sẽ gặp thư viện **chỉ có bản đồng bộ** (ví dụ `requests`, driver DB cũ, đọc file lớn, thư viện xử lý ảnh). Gọi trực tiếp trong `async def` sẽ chặn cả event loop. Giải pháp: **`await asyncio.to_thread(func, *args)`** - chạy hàm trong một thread riêng, event loop vẫn tự do phục vụ việc khác.

```python
import asyncio
import time


def blocking_report(name: str) -> str:
    time.sleep(0.2)                            # Hàm đồng bộ, chặn (giả lập thư viện cũ)
    return f"báo cáo {name}"


async def main():
    start = time.perf_counter()
    # ❌ Gọi trực tiếp: 3 × 0.2s = 0.6s, và event loop bị đóng băng suốt thời gian đó
    for n in ("A", "B", "C"):
        blocking_report(n)
    print(f"Gọi trực tiếp: {time.perf_counter() - start:.1f}s")

    start = time.perf_counter()
    # ✅ to_thread: mỗi lời gọi chạy trong thread riêng → đồng thời
    results = await asyncio.gather(*(asyncio.to_thread(blocking_report, n) for n in "ABC"))
    print(f"to_thread: {time.perf_counter() - start:.1f}s → {results}")


asyncio.run(main())
# Output:
# Gọi trực tiếp: 0.6s
# to_thread: 0.2s → ['báo cáo A', 'báo cáo B', 'báo cáo C']
```

> 💡 Với việc **CPU-bound** trong code async, `to_thread` không giúp nhanh hơn (vẫn bị GIL). Dùng `loop.run_in_executor(process_pool, func, arg)` với một `ProcessPoolExecutor` thay thế.

### 💡 Tips quan trọng

- Code mới dùng **`TaskGroup`** thay cho `gather` (trừ khi cần `return_exceptions=True`) ✅
- Mọi thao tác mạng nên có **timeout** (`asyncio.timeout`) ✅
- Luôn **giới hạn** số kết nối đồng thời bằng `Semaphore` ✅
- **Không** gọi hàm chặn trong `async def` - dùng bản async hoặc `asyncio.to_thread` ❌
- Bắt `CancelledError` để dọn dẹp thì **phải raise lại** ❌

## 📖 7. HTTP bất đồng bộ với httpx.AsyncClient

`requests` (thư viện HTTP phổ biến nhất) chỉ có bản đồng bộ. **`httpx`** có API gần giống `requests` nhưng hỗ trợ **cả sync lẫn async**. [Bài 12](./12-http-web-apis.md) đã giới thiệu `httpx` và `MockTransport`; ở đây ta tập trung vào `httpx.AsyncClient` để chạy **hàng trăm** request đồng thời.

Cách dùng với internet thật:

```text
import asyncio
import httpx

async def main():
    # Một client cho TẤT CẢ request: tái sử dụng kết nối (connection pooling) → nhanh hơn nhiều
    async with httpx.AsyncClient(timeout=10.0) as client:
        responses = await asyncio.gather(
            client.get("https://httpbin.org/get"),
            client.get("https://api.github.com"),
        )
        for r in responses:
            print(r.status_code, r.url)

asyncio.run(main())
```

### Test offline với MockTransport

Để ví dụ chạy được không cần mạng (và để **viết test** không phụ thuộc server thật), `httpx` cho phép thay tầng "truyền tải" bằng **`httpx.MockTransport`**: bạn tự viết một hàm nhận `Request` và trả `Response`. Code gọi `client.get(...)` **không cần sửa gì**.

```python
import asyncio

import httpx

FAKE_DB = {1: "Laptop", 2: "Chuột", 3: "Bàn phím"}


async def fake_api(request: httpx.Request) -> httpx.Response:
    """Giả lập server: GET /products/{id}."""
    await asyncio.sleep(0.1)                               # Giả lập độ trễ mạng
    product_id = int(request.url.path.split("/")[-1])
    if product_id not in FAKE_DB:
        return httpx.Response(404, json={"error": "not found"})
    return httpx.Response(200, json={"id": product_id, "name": FAKE_DB[product_id]})


async def get_product(client: httpx.AsyncClient, product_id: int) -> str:
    response = await client.get(f"/products/{product_id}")
    if response.status_code == 404:
        return f"#{product_id}: không tồn tại"
    response.raise_for_status()                            # Lỗi 4xx/5xx khác → exception
    return f"#{product_id}: {response.json()['name']}"


async def main():
    transport = httpx.MockTransport(fake_api)
    async with httpx.AsyncClient(transport=transport, base_url="https://shop.example") as client:
        async with asyncio.TaskGroup() as tg:
            tasks = [tg.create_task(get_product(client, i)) for i in (1, 2, 3, 99)]
    for t in tasks:
        print(t.result())


asyncio.run(main())
# Output:
# #1: Laptop
# #2: Chuột
# #3: Bàn phím
# #99: không tồn tại
```

4 request mỗi cái 0.1s nhưng tổng chỉ ~0.1s. Muốn chạy với server thật, chỉ cần bỏ tham số `transport=...`.

> 💡 Một cách offline khác là chạy **server thật trên máy bạn**: `python -m http.server 8000` (phục vụ file tĩnh trong thư mục hiện tại) rồi gọi `http://127.0.0.1:8000/...`. Hoặc chạy app FastAPI từ Bài 12 bằng `uvicorn`.

## 📖 8. So sánh hiệu năng có số liệu

Hãy tự đo! Script dưới đây chạy **cùng một khối lượng việc** bằng 4 cách, cho cả I/O-bound và CPU-bound:

```python
import asyncio
import time
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor

N_IO = 20          # 20 "request", mỗi cái chờ 0.1s
N_CPU = 4          # 4 việc tính toán nặng


def io_job(_: int) -> None:
    time.sleep(0.1)


async def io_job_async() -> None:
    await asyncio.sleep(0.1)


def cpu_job(_: int) -> int:
    return sum(i * i for i in range(2_000_000))


def bench(label: str, func) -> None:
    start = time.perf_counter()
    func()
    print(f"  {label:<12} {time.perf_counter() - start:6.2f}s")


async def run_async_io() -> None:
    await asyncio.gather(*(io_job_async() for _ in range(N_IO)))


def with_threads(func, n: int, workers: int) -> None:
    with ThreadPoolExecutor(max_workers=workers) as ex:
        list(ex.map(func, range(n)))


def with_processes(func, n: int, workers: int) -> None:
    with ProcessPoolExecutor(max_workers=workers) as ex:
        list(ex.map(func, range(n)))


if __name__ == "__main__":
    print(f"I/O-bound ({N_IO} việc × 0.1s):")
    bench("Tuần tự", lambda: [io_job(i) for i in range(N_IO)])
    bench("Thread", lambda: with_threads(io_job, N_IO, workers=N_IO))
    bench("Process", lambda: with_processes(io_job, N_IO, workers=4))
    bench("asyncio", lambda: asyncio.run(run_async_io()))

    print(f"CPU-bound ({N_CPU} việc tính toán):")
    bench("Tuần tự", lambda: [cpu_job(i) for i in range(N_CPU)])
    bench("Thread", lambda: with_threads(cpu_job, N_CPU, workers=4))
    bench("Process", lambda: with_processes(cpu_job, N_CPU, workers=4))
# Output (ví dụ):
# I/O-bound (20 việc × 0.1s):
#   Tuần tự        2.00s
#   Thread         0.11s
#   Process        0.51s
#   asyncio        0.10s
# CPU-bound (4 việc tính toán):
#   Tuần tự        0.33s
#   Thread         0.31s
#   Process        0.10s
```

Kết quả trên máy 4 lõi. Nhận xét:

- **I/O-bound**: thread và asyncio nhanh gấp **~20 lần** tuần tự. Process cũng nhanh hơn nhưng chỉ có 4 worker (20 việc / 4 = 5 lượt × 0.1s) cộng thêm chi phí khởi động process
- **CPU-bound**: thread **không nhanh hơn** tuần tự (GIL!). Chỉ process mới tăng tốc **~3-4 lần** (≈ số lõi)
- Ở I/O-bound, nếu tăng lên **10.000** việc: thread cần 10.000 luồng (tốn RAM, hệ điều hành có thể từ chối), còn asyncio vẫn nhẹ nhàng - đó là lý do web server hiện đại (FastAPI) dùng asyncio

## 📖 9. Cách chọn công cụ

```text
Chương trình chậm?
│
├─ Đã ĐO chưa? ── Chưa → Đo trước (time.perf_counter, cProfile - Bài 16)
│
├─ Chậm vì CHỜ (mạng, DB, file)? → I/O-bound
│    ├─ Thư viện có bản async (httpx, asyncpg, aiofiles)?  → asyncio (+ Semaphore)
│    ├─ Chỉ có thư viện đồng bộ (requests, boto3...)?       → ThreadPoolExecutor
│    └─ Đang trong code async mà phải gọi hàm đồng bộ?       → asyncio.to_thread
│
└─ Chậm vì TÍNH TOÁN? → CPU-bound
     ├─ Dùng được NumPy/pandas (vector hóa)?                → Làm thế trước! (nhanh 10-100x)
     ├─ Chia được thành nhiều phần độc lập?                 → ProcessPoolExecutor
     └─ Không chia được?                                    → Tối ưu thuật toán (Bài 16: profiling)
```

| Tình huống thực tế | Lựa chọn |
| --- | --- |
| Kiểm tra 1.000 URL còn sống không | `asyncio` + `httpx.AsyncClient` + `Semaphore` |
| Tải 50 file bằng `requests` có sẵn trong project | `ThreadPoolExecutor(max_workers=10)` |
| Resize 5.000 ảnh | `ProcessPoolExecutor` |
| Web API nhận hàng nghìn request/giây | FastAPI (asyncio) |
| Xử lý file CSV 5GB | Generator (Bài 9) + pandas theo chunk (Bài 15), có thể thêm ProcessPool |
| GUI (Tkinter) cần làm việc nền mà không "đơ" giao diện | `threading.Thread` + `queue.Queue` |

## 🌍 Ứng dụng thực tế

Bốn chương trình hoàn chỉnh dưới đây đều **chạy offline** được. Hãy lưu từng cái thành file `.py` và chạy thử.

### Ứng dụng 1: Kiểm tra "sức khỏe" hàng trăm URL đồng thời

Bài toán: công ty có 300 website/endpoint cần kiểm tra mỗi 5 phút xem còn sống không. Tuần tự mỗi URL ~0.07s → 21 giây, chưa kể URL bị treo. Với asyncio + Semaphore + timeout, chỉ mất khoảng 1 giây mà vẫn không "dội bom" hệ thống.

```python
"""health_check.py - Kiểm tra hàng trăm URL đồng thời, có giới hạn và timeout."""
import asyncio
import time
from collections import Counter
from dataclasses import dataclass

import httpx

MAX_CONCURRENT = 20          # Tối đa 20 request cùng lúc
TIMEOUT_SECONDS = 0.5        # URL nào quá 0.5s coi như "treo"


# ---------- "Internet giả" để chạy offline ----------
# Muốn kiểm tra URL thật: bỏ tham số transport=... khi tạo AsyncClient
async def fake_internet(request: httpx.Request) -> httpx.Response:
    site_id = int(request.url.host.split("-")[1].split(".")[0])   # site-17.example → 17
    if site_id % 50 == 0:
        await asyncio.sleep(2)                                     # Server treo
    await asyncio.sleep(0.05 + (site_id % 5) * 0.01)               # Độ trễ mạng
    if site_id % 17 == 0:
        return httpx.Response(500, text="Internal Server Error")
    if site_id % 23 == 0:
        return httpx.Response(404, text="Not Found")
    if site_id % 29 == 0:
        raise httpx.ConnectError("DNS lookup failed", request=request)
    return httpx.Response(200, text="OK")


@dataclass
class CheckResult:
    url: str
    status: str               # "UP", "HTTP 500", "TIMEOUT", "ERROR (...)"
    elapsed_ms: float


async def check_url(client: httpx.AsyncClient, url: str, sem: asyncio.Semaphore) -> CheckResult:
    async with sem:                                        # Giới hạn số request đồng thời
        start = time.perf_counter()
        try:
            async with asyncio.timeout(TIMEOUT_SECONDS):
                response = await client.get(url)
            status = "UP" if response.status_code < 400 else f"HTTP {response.status_code}"
        except TimeoutError:
            status = "TIMEOUT"
        except httpx.HTTPError as e:                       # Lỗi kết nối, DNS...
            status = f"ERROR ({type(e).__name__})"
        return CheckResult(url, status, (time.perf_counter() - start) * 1000)


async def main() -> None:
    urls = [f"https://site-{i}.example/health" for i in range(1, 301)]
    sem = asyncio.Semaphore(MAX_CONCURRENT)
    transport = httpx.MockTransport(fake_internet)

    start = time.perf_counter()
    async with httpx.AsyncClient(transport=transport) as client:
        async with asyncio.TaskGroup() as tg:
            tasks = [tg.create_task(check_url(client, url, sem)) for url in urls]
    elapsed = time.perf_counter() - start
    results = [t.result() for t in tasks]

    summary = Counter(r.status for r in results)
    print(f"Đã kiểm tra {len(results)} URL trong {elapsed:.2f}s")
    for status, count in summary.most_common():
        icon = "✅" if status == "UP" else "❌"
        print(f"  {icon} {status:<22} {count:>4}")

    problems = [r for r in results if r.status != "UP"]
    print("Một vài URL có vấn đề:")
    for r in problems[:4]:
        print(f"  - {r.url} → {r.status} ({r.elapsed_ms:.0f}ms)")


if __name__ == "__main__":
    asyncio.run(main())
# Output (ví dụ):
# Đã kiểm tra 300 URL trong 1.25s
#   ✅ UP                      254
#   ❌ HTTP 500                 17
#   ❌ HTTP 404                 13
#   ❌ ERROR (ConnectError)     10
#   ❌ TIMEOUT                   6
# Một vài URL có vấn đề:
#   - https://site-17.example/health → HTTP 500 (71ms)
#   - https://site-23.example/health → HTTP 404 (81ms)
#   - https://site-29.example/health → ERROR (ConnectError) (91ms)
#   - https://site-34.example/health → HTTP 500 (91ms)
```

Điểm đáng học:

- **Một `AsyncClient` dùng chung** cho mọi request → tái sử dụng kết nối
- **Semaphore** giữ tối đa 20 request cùng lúc, **timeout** cắt URL treo, lỗi được **chuyển thành dữ liệu** (`CheckResult`) thay vì làm sập cả chương trình
- Muốn chạy định kỳ mỗi 5 phút: xem phần lên lịch ở [Bài 15](./15-data-processing.md)

### Ứng dụng 2: Xử lý ảnh song song bằng ProcessPool

Bài toán: làm mờ (blur) hàng loạt ảnh - việc **CPU-bound** điển hình. Để ví dụ không cần thư viện ảnh, ta biểu diễn ảnh xám là **list 2 chiều** các số 0-255 và tự viết bộ lọc **box blur 3×3** (mỗi điểm ảnh = trung bình 9 điểm xung quanh).

```python
"""batch_blur.py - Làm mờ nhiều ảnh song song trên mọi lõi CPU."""
import os
import random
import time
from concurrent.futures import ProcessPoolExecutor, as_completed

SIZE = 400                   # Ảnh 400 × 400 điểm ảnh
Image = list[list[int]]


def load_image(seed: int) -> Image:
    """Giả lập đọc ảnh từ đĩa (thực tế: Image.open(path) của thư viện Pillow)."""
    rng = random.Random(seed)
    return [[rng.randint(0, 255) for _ in range(SIZE)] for _ in range(SIZE)]


def box_blur(img: Image) -> Image:
    """Mỗi điểm ảnh bên trong = trung bình 3×3 điểm xung quanh. Viền giữ nguyên."""
    out = [row[:] for row in img]
    for y in range(1, SIZE - 1):
        for x in range(1, SIZE - 1):
            total = 0
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    total += img[y + dy][x + dx]
            out[y][x] = total // 9
    return out


def contrast(img: Image) -> float:
    """Độ tương phản: độ lệch trung bình so với màu trung bình (blur → giảm)."""
    pixels = [p for row in img for p in row]
    mean = sum(pixels) / len(pixels)
    return sum(abs(p - mean) for p in pixels) / len(pixels)


def process_one(seed: int) -> tuple[int, float, float]:
    # ✅ Chỉ truyền seed (thực tế: đường dẫn file) sang tiến trình con.
    # Tiến trình con tự đọc ảnh → tránh pickle cả bức ảnh qua lại giữa các process.
    img = load_image(seed)
    blurred = box_blur(img)
    return seed, contrast(img), contrast(blurred)


def main() -> None:
    seeds = list(range(8))                               # 8 "ảnh"

    start = time.perf_counter()
    sequential = [process_one(s) for s in seeds]
    t_seq = time.perf_counter() - start

    start = time.perf_counter()
    parallel = []
    with ProcessPoolExecutor(max_workers=os.cpu_count()) as pool:
        futures = [pool.submit(process_one, s) for s in seeds]
        for done_count, future in enumerate(as_completed(futures), start=1):
            parallel.append(future.result())
            print(f"\r  Tiến độ: {done_count}/{len(seeds)}", end="")
    print()
    t_par = time.perf_counter() - start

    parallel.sort()                                      # as_completed không giữ thứ tự
    assert parallel == sequential                        # Kết quả phải giống hệt
    for seed, before, after in parallel[:3]:
        print(f"  Ảnh {seed}: độ tương phản {before:.1f} → {after:.1f}")
    print(f"Tuần tự: {t_seq:.2f}s | {os.cpu_count()} process: {t_par:.2f}s "
          f"| nhanh hơn {t_seq / t_par:.1f} lần")


if __name__ == "__main__":
    main()
# Output (ví dụ):
#   Tiến độ: 8/8
#   Ảnh 0: độ tương phản 63.9 → 20.1
#   Ảnh 1: độ tương phản 64.1 → 20.2
#   Ảnh 2: độ tương phản 64.0 → 20.3
# Tuần tự: 1.12s | 4 process: 0.34s | nhanh hơn 3.3 lần
```

Với ảnh thật, bạn dùng thư viện **Pillow** (`pip install pillow`) và hàm worker trông như sau - phần `ProcessPoolExecutor` giữ nguyên:

```text
from pathlib import Path
from PIL import Image, ImageFilter

def process_one(path: str) -> str:
    out = Path("output") / Path(path).name
    with Image.open(path) as img:
        img.filter(ImageFilter.BoxBlur(2)).thumbnail((800, 800))
        img.save(out, quality=85)
    return str(out)
```

> 💡 Pillow và NumPy thực hiện phần lớn tính toán trong C và nhả GIL ở nhiều thao tác, nên đôi khi `ThreadPoolExecutor` cũng tăng tốc được. Cách chắc chắn nhất: **đo cả hai**.

### Ứng dụng 3: Web crawler bất đồng bộ (producer–consumer)

Bài toán: duyệt toàn bộ một website nội bộ để tìm **link hỏng** (404). Mỗi trang tải về vừa là **kết quả** vừa **sinh thêm việc mới** (các link bên trong) → mô hình **hàng đợi + nhiều worker** là hoàn hảo.

```python
"""crawler.py - Crawler async tìm link hỏng, dùng asyncio.Queue + nhiều worker."""
import asyncio
import re
from urllib.parse import urljoin, urlparse

import httpx

# ---------- Website giả: trang → danh sách link trong trang ----------
SITE = {
    "/": ["/products", "/blog", "/about"],
    "/products": ["/products/1", "/products/2", "/"],
    "/products/1": ["/products", "/cart"],
    "/products/2": ["/products", "/products/3"],          # /products/3 không tồn tại!
    "/blog": ["/blog/python", "/blog/asyncio"],
    "/blog/python": ["/blog", "/blog/asyncio", "https://python.org/"],  # Link ngoài
    "/blog/asyncio": ["/blog", "/blog/old-post"],          # /blog/old-post đã bị xóa!
    "/about": ["/", "/contact"],
    "/contact": [],
    "/cart": [],
}


async def fake_server(request: httpx.Request) -> httpx.Response:
    await asyncio.sleep(0.05)
    links = SITE.get(request.url.path)
    if links is None:
        return httpx.Response(404, text="<h1>Not Found</h1>")
    html = "".join(f'<a href="{link}">{link}</a>' for link in links)
    return httpx.Response(200, text=f"<html><body>{html}</body></html>")


class Crawler:
    def __init__(self, client: httpx.AsyncClient, start_url: str,
                 workers: int = 3, max_pages: int = 100):
        self.client = client
        self.start_url = start_url
        self.domain = urlparse(start_url).netloc
        self.workers = workers
        self.max_pages = max_pages
        self.queue: asyncio.Queue[tuple[str, str]] = asyncio.Queue()   # (url, trang chứa link)
        self.seen: set[str] = set()
        self.ok_pages: list[str] = []
        self.broken: list[tuple[str, str]] = []

    def enqueue(self, url: str, found_on: str) -> None:
        url = url.split("#")[0]                              # Bỏ phần #anchor
        if urlparse(url).netloc != self.domain:              # Chỉ crawl trong cùng domain
            return
        if url in self.seen or len(self.seen) >= self.max_pages:
            return
        self.seen.add(url)                                   # Đánh dấu NGAY khi đưa vào queue
        self.queue.put_nowait((url, found_on))

    async def worker(self) -> None:
        while True:
            url, found_on = await self.queue.get()
            try:
                response = await self.client.get(url)
                if response.status_code == 404:
                    self.broken.append((url, found_on))
                else:
                    self.ok_pages.append(url)
                    for href in re.findall(r'href="([^"]+)"', response.text):
                        self.enqueue(urljoin(url, href), found_on=url)   # Link tương đối → tuyệt đối
            except httpx.HTTPError as e:
                self.broken.append((url, f"lỗi {type(e).__name__}"))
            finally:
                self.queue.task_done()

    async def run(self) -> None:
        self.enqueue(self.start_url, found_on="(start)")
        tasks = [asyncio.create_task(self.worker()) for _ in range(self.workers)]
        await self.queue.join()                              # Chờ hàng đợi rỗng VÀ mọi việc xong
        for t in tasks:
            t.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)


async def main() -> None:
    transport = httpx.MockTransport(fake_server)
    async with httpx.AsyncClient(transport=transport, timeout=5.0) as client:
        crawler = Crawler(client, "https://shop.example/", workers=3)
        await crawler.run()

    print(f"✅ {len(crawler.ok_pages)} trang hoạt động:")
    for page in sorted(crawler.ok_pages):
        print("   ", urlparse(page).path)
    print(f"❌ {len(crawler.broken)} link hỏng:")
    for url, found_on in sorted(crawler.broken):
        print(f"    {urlparse(url).path}  (trên trang {urlparse(found_on).path})")


if __name__ == "__main__":
    asyncio.run(main())
# Output:
# ✅ 10 trang hoạt động:
#     /
#     /about
#     /blog
#     /blog/asyncio
#     /blog/python
#     /cart
#     /contact
#     /products
#     /products/1
#     /products/2
# ❌ 2 link hỏng:
#     /blog/old-post  (trên trang /blog/asyncio)
#     /products/3  (trên trang /products/2)
```

Điểm đáng học:

- Điều kiện dừng: **`queue.join()`** chỉ trả về khi mọi item đã được `task_done()` - kể cả những item được thêm vào **trong lúc** đang crawl
- `seen` được cập nhật **ngay khi đưa vào queue**, không phải khi tải xong → tránh hai worker cùng tải một trang
- Worker là vòng lặp vô hạn → phải **`cancel()`** rồi `gather(..., return_exceptions=True)` để chờ chúng dừng hẳn
- Thực tế nên parse HTML bằng **BeautifulSoup** (Bài 15) thay vì regex, tôn trọng `robots.txt` và thêm rate limiter (ứng dụng 4)

### Ứng dụng 4: Rate limiter - Không gọi API quá nhanh

Nhiều API giới hạn "tối đa 5 request/giây". Gọi nhanh hơn → bị trả `429 Too Many Requests` hoặc bị khóa key. Semaphore chỉ giới hạn **số request cùng lúc**, không giới hạn **số request mỗi giây** - cần một **rate limiter**.

Thuật toán phổ biến nhất: **Token Bucket** (xô token).

> 🧠 **Ví dụ dễ hiểu**: Một cái xô chứa tối đa 3 **vé** 🎟️. Mỗi request phải lấy 1 vé mới được đi. Cứ 0.2 giây lại có 1 vé mới rơi vào xô (5 vé/giây). Lúc đầu xô đầy → 3 request đầu đi ngay (**burst**). Sau đó, request phải chờ vé mới → tốc độ ổn định 5 request/giây.

```python
"""rate_limiter.py - Token bucket bất đồng bộ, dùng với async with."""
import asyncio
import time


class AsyncRateLimiter:
    def __init__(self, rate: float, capacity: int):
        self.rate = rate                    # Số token nạp thêm mỗi giây
        self.capacity = capacity            # Sức chứa tối đa của xô (burst)
        self.tokens = float(capacity)       # Ban đầu xô đầy
        self.updated_at = time.monotonic()
        self._lock = asyncio.Lock()         # Để các coroutine lấy token lần lượt, công bằng

    def _refill(self) -> None:
        now = time.monotonic()
        self.tokens = min(self.capacity, self.tokens + (now - self.updated_at) * self.rate)
        self.updated_at = now

    async def acquire(self) -> None:
        async with self._lock:
            self._refill()
            while self.tokens < 1:
                await asyncio.sleep((1 - self.tokens) / self.rate)   # Chờ đủ 1 token
                self._refill()
            self.tokens -= 1

    async def __aenter__(self):             # Cho phép viết: async with limiter:
        await self.acquire()
        return self

    async def __aexit__(self, *exc) -> None:
        return None


async def call_api(i: int, limiter: AsyncRateLimiter, t0: float) -> None:
    async with limiter:
        print(f"  t={time.monotonic() - t0:.1f}s → gọi API #{i}")
        await asyncio.sleep(0.01)           # Giả lập request


async def main() -> None:
    limiter = AsyncRateLimiter(rate=5, capacity=3)     # 5 request/giây, burst 3
    t0 = time.monotonic()
    async with asyncio.TaskGroup() as tg:
        for i in range(1, 9):
            tg.create_task(call_api(i, limiter, t0))    # 8 request "cùng lúc"
    print(f"8 request trong {time.monotonic() - t0:.1f}s (~5 request/giây sau burst)")


if __name__ == "__main__":
    asyncio.run(main())
# Output (ví dụ):
#   t=0.0s → gọi API #1
#   t=0.0s → gọi API #2
#   t=0.0s → gọi API #3
#   t=0.2s → gọi API #4
#   t=0.4s → gọi API #5
#   t=0.6s → gọi API #6
#   t=0.8s → gọi API #7
#   t=1.0s → gọi API #8
# 8 request trong 1.0s (~5 request/giây sau burst)
```

> 💡 Trong thực tế, kết hợp **cả hai**: `Semaphore` (tối đa N kết nối cùng lúc) + `RateLimiter` (tối đa M request/giây) + xử lý `429` bằng cách đọc header `Retry-After` và thử lại (retry sẽ học ở [Bài 16](./16-production-ready.md)).

## ⚠️ Lỗi thường gặp

### 1. Quên `if __name__ == "__main__"` khi dùng process

```text
# ❌ Trên Windows/macOS: RuntimeError "An attempt has been made to start a new process
#    before the current process has finished its bootstrapping phase"
from concurrent.futures import ProcessPoolExecutor
with ProcessPoolExecutor() as ex:
    print(list(ex.map(abs, [-1, -2])))

# ✅ Luôn bọc trong guard
if __name__ == "__main__":
    with ProcessPoolExecutor() as ex:
        print(list(ex.map(abs, [-1, -2])))
```

### 2. Dùng thread cho việc tính toán nặng

Code chạy không nhanh hơn (thậm chí chậm hơn) vì GIL. **CPU-bound → process**. Luôn đo trước và sau khi "tối ưu".

### 3. Truyền lambda / hàm lồng vào ProcessPool

```text
with ProcessPoolExecutor() as ex:
    ex.map(lambda x: x * 2, data)
# ❌ PicklingError: Can't pickle <function <lambda> ...>
# ✅ Định nghĩa hàm ở cấp module: def double(x): return x * 2
```

### 4. Quên Lock khi nhiều thread sửa chung dữ liệu

Race condition không báo lỗi - chỉ cho **kết quả sai**, lúc có lúc không. Mọi thao tác "đọc - sửa - ghi" dữ liệu chung giữa các thread đều cần `Lock`, hoặc tốt hơn: dùng `Queue` / trả kết quả về thay vì chia sẻ.

### 5. Gọi hàm chặn trong `async def`

```text
async def handler():
    data = requests.get(url)       # ❌ Đóng băng TOÀN BỘ event loop (mọi request khác đều chờ)
    time.sleep(1)                  # ❌ Tương tự

async def handler():
    async with httpx.AsyncClient() as client:
        data = await client.get(url)                 # ✅ Bản async
    await asyncio.sleep(1)                           # ✅
    result = await asyncio.to_thread(legacy_func)    # ✅ Bắt buộc dùng hàm đồng bộ
```

### 6. `create_task` mà không giữ tham chiếu / không await

Task có thể bị dọn mất giữa chừng, và exception trong task bị "nuốt" - bạn chỉ thấy cảnh báo `Task exception was never retrieved` lúc chương trình kết thúc. Dùng **`TaskGroup`** để khỏi lo cả hai vấn đề.

### 7. Nuốt `CancelledError`

```text
try:
    await asyncio.sleep(10)
except asyncio.CancelledError:
    print("bị hủy")         # ❌ Không raise lại → TaskGroup / timeout hoạt động sai
    raise                   # ✅ Dọn dẹp xong thì raise lại
```

### 8. Tạo quá nhiều việc đồng thời không giới hạn

`asyncio.gather(*(fetch(u) for u in 100_000_urls))` → hết file descriptor (`OSError: Too many open files`), server đích chặn IP của bạn. Luôn dùng **`Semaphore`** hoặc worker pool với `Queue`.

### 9. Tạo `AsyncClient` mới cho mỗi request

```text
async def fetch(url):
    async with httpx.AsyncClient() as client:   # ❌ Mỗi lần gọi lại mở kết nối mới → chậm
        return await client.get(url)
```

Hãy tạo **một** client trong `main()` và truyền vào các hàm (như các ứng dụng ở trên).

## 🏋️ Bài tập

### Bài tập 1 (Dễ): Tải file bằng ThreadPoolExecutor

Viết hàm `fake_download(name: str) -> int` ngủ ngẫu nhiên 0.1-0.5s và trả về "kích thước file" ngẫu nhiên. Dùng `ThreadPoolExecutor` tải 20 file với `max_workers=5`, in tiến độ `[3/20] b.zip xong` theo thứ tự hoàn thành (`as_completed`). So sánh thời gian với chạy tuần tự.

### Bài tập 2 (Dễ): Dừng thread êm ái với Event

Viết một thread "tự động lưu" cứ 0.2 giây in `💾 Đã lưu`. Dùng `threading.Event` (`stop_event.wait(0.2)` thay cho `time.sleep`) để luồng chính yêu cầu dừng sau 1 giây, và thread in `👋 Dừng tự động lưu` trước khi kết thúc. Tại sao cách này tốt hơn daemon thread?

### Bài tập 3 (Trung bình): Sửa race condition

Viết class `Inventory` (kho hàng) có method `sell(product, qty)`: kiểm tra còn đủ hàng rồi trừ (thêm `time.sleep(0.001)` giữa kiểm tra và trừ). Cho 10 thread cùng mua 1 sản phẩm chỉ còn 5 cái → chứng minh bán âm kho. Sửa bằng `Lock`. Bonus: mỗi sản phẩm một Lock riêng để hàng khác nhau không phải chờ nhau.

### Bài tập 4 (Trung bình): Đếm từ song song

Tạo 8 file văn bản lớn (mỗi file ~200.000 từ ngẫu nhiên). Viết hàm đếm tần suất từ của một file (`collections.Counter`), chạy song song bằng `ProcessPoolExecutor`, rồi **gộp** các `Counter` lại (`sum(counters, Counter())`). In 10 từ phổ biến nhất và so sánh thời gian với tuần tự.

### Bài tập 5 (Khó): Downloader có retry

Mở rộng Ứng dụng 1: với lỗi `HTTP 5xx` hoặc `TIMEOUT`, **thử lại tối đa 3 lần**, chờ 0.1s, 0.2s, 0.4s giữa các lần (exponential backoff). Dùng `MockTransport` giả lập server "lúc được lúc không" (ví dụ lỗi ở 2 lần đầu, thành công lần 3). Báo cáo số URL thành công ngay, thành công sau retry, và thất bại hẳn.

### Bài tập 6 (Khó): Pipeline 3 tầng

Xây pipeline async gồm 3 tầng nối nhau bằng 2 `asyncio.Queue`: **tải** (3 worker, giả lập tải trang) → **phân tích** (2 worker, đếm số từ) → **lưu** (1 worker, ghi vào list). Dùng `TaskGroup`, `Queue(maxsize=...)` để tạo **back-pressure** (tầng sau chậm thì tầng trước tự chờ). Đảm bảo chương trình dừng sạch sẽ khi hết việc.

<details>
<summary>💡 Xem đáp án Bài tập 2 và gợi ý Bài tập 5</summary>

```python
import threading
import time


def autosave(stop_event: threading.Event) -> None:
    while not stop_event.is_set():
        print("💾 Đã lưu")
        stop_event.wait(0.2)            # Ngủ 0.2s NHƯNG thức dậy ngay khi có lệnh dừng
    print("👋 Dừng tự động lưu")        # Có cơ hội dọn dẹp - daemon thread thì không


stop = threading.Event()
t = threading.Thread(target=autosave, args=(stop,))
t.start()
time.sleep(0.5)
stop.set()                              # Yêu cầu dừng
t.join()
print("Main kết thúc")
# Output:
# 💾 Đã lưu
# 💾 Đã lưu
# 💾 Đã lưu
# 👋 Dừng tự động lưu
# Main kết thúc
```

Gợi ý Bài tập 5 - khung hàm retry:

```text
async def get_with_retry(client, url, attempts=3, base_delay=0.1):
    for attempt in range(attempts):
        try:
            async with asyncio.timeout(0.5):
                response = await client.get(url)
            if response.status_code < 500:
                return response, attempt
        except (TimeoutError, httpx.HTTPError):
            pass
        if attempt < attempts - 1:
            await asyncio.sleep(base_delay * 2**attempt)   # 0.1 → 0.2 → 0.4
    return None, attempts
```

</details>

## ✅ Checklist hoàn thành

- [ ] Phân biệt concurrency / parallelism, I/O-bound / CPU-bound và tự đo được bằng `perf_counter` + `process_time`
- [ ] Giải thích được GIL là gì, tại sao tồn tại, khi nào được nhả
- [ ] Tạo thread với `Thread`, `start`, `join`; hiểu daemon thread
- [ ] Tái hiện được race condition và sửa bằng `Lock`
- [ ] Dùng `queue.Queue` cho mô hình producer-consumer với thread
- [ ] Dùng `ThreadPoolExecutor` / `ProcessPoolExecutor` với `submit`, `map`, `as_completed`
- [ ] Giải thích được tại sao cần `if __name__ == "__main__"` với multiprocessing
- [ ] Biết các cách chia sẻ dữ liệu giữa process (`Value`, `Manager`, `Queue`, trả kết quả)
- [ ] Phân biệt coroutine và Task; biết giữ tham chiếu tới task
- [ ] Hiểu khác biệt `gather` và `TaskGroup` khi có lỗi; dùng `except*`
- [ ] Dùng `asyncio.timeout`, `Semaphore`, `asyncio.Queue`, `task.cancel()`
- [ ] Viết async context manager và async generator (`async with`, `async for`)
- [ ] Dùng `asyncio.to_thread` cho code đồng bộ
- [ ] Gọi HTTP bằng `httpx.AsyncClient` và test offline bằng `MockTransport`
- [ ] Chạy lại được 4 ứng dụng thực tế và hoàn thành ít nhất 3 bài tập

## 🚀 Tiếp theo

Bạn đã biết cách làm cho chương trình **chạy nhanh hơn** bằng cách tận dụng thời gian chờ và nhiều lõi CPU. Bài tiếp theo chuyển sang một kỹ năng mà gần như mọi công việc đều cần: **xử lý dữ liệu và tự động hóa** - đọc CSV/Excel, phân tích với pandas, vẽ biểu đồ, thu thập dữ liệu web và tự động gửi báo cáo.

**Bài tiếp theo**: [Xử lý dữ liệu & Tự động hóa](./15-data-processing.md)

---

💡 **Tips nhớ lâu**:

- **Chờ nhiều → asyncio/thread. Tính nhiều → process**
- **GIL = một micro** - thread chỉ thay nhau hát, trừ khi đang đi lấy nước (I/O)
- **Dữ liệu chung + nhiều thread = Lock** (hoặc tốt hơn: Queue)
- **Process: luôn `if __name__ == "__main__"`**, hàm ở cấp module, dữ liệu gửi đi nhỏ gọn
- **TaskGroup + timeout + Semaphore** = bộ ba an toàn cho code async
- **Đo, đừng đoán** - tối ưu mà không đo chỉ là mê tín
