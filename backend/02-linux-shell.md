# 📚 Bài 2: Linux & Shell cho Backend Developer

## 🎯 Mục tiêu bài học

- Hiểu **cây thư mục Linux** (filesystem hierarchy): `/etc`, `/var/log`, `/opt`, `/proc`... và biết file cấu hình, log, app thường nằm ở đâu
- Đọc và chỉnh **quyền truy cập** (`rwx`, `chmod 640`, `chown`), hiểu vì sao **không chạy app bằng root**
- Quản lý **process** và **signal**: `ps`, `top`, `kill`, phân biệt **SIGTERM vs SIGKILL**, viết **graceful shutdown** bằng Go và Python
- Thành thạo **pipe & redirection** (`|`, `>`, `2>&1`, `tee`) và "bộ đồ nghề" xử lý văn bản: `grep`, `sed`, `awk`, `sort`, `uniq`, `jq`
- Tìm file với `find` + `xargs`; kiểm tra mạng với `ss`, `curl`, `dig`, `nc`
- Dùng **biến môi trường** để cấu hình app đúng chuẩn 12-factor
- Chạy app như một **dịch vụ systemd** (tự khởi động lại, xem log bằng `journalctl`), lập lịch với **cron**
- Đăng nhập server bằng **SSH key**, cấu hình `~/.ssh/config`, copy file bằng `rsync`
- Theo dõi tài nguyên: `df`, `du`, `free`, `lsof`
- Viết một **script deploy nhỏ** có health check và rollback
- Xử lý 3 sự cố "kinh điển": **port already in use**, **disk full**, **xem log service đang chạy**

> 💡 **Vì sao backend dev phải biết Linux?** Hơn 90% server trên Internet chạy Linux. Docker container là Linux. Kubernetes node là Linux. Khi production có sự cố lúc 2 giờ sáng, bạn sẽ không có giao diện đồ họa - chỉ có một cửa sổ **terminal** và một dấu nhắc `$`. Người biết shell sẽ tìm ra lỗi trong 5 phút; người không biết sẽ... gọi người biết shell dậy.

> 💡 **Kiến thức cần có**: [Bài 1: Web hoạt động thế nào](./01-how-the-web-works.md) (IP, port, TCP, DNS, HTTP). Mọi lệnh trong bài chạy được trên Ubuntu/Debian; macOS gần giống (một số lệnh như `ss`, `systemctl` chỉ có trên Linux). Trên Windows hãy dùng **WSL2**.

---

## 📖 1. Shell là gì? - "Người phiên dịch" giữa bạn và hệ điều hành

### Ví von: Quầy giao dịch ngân hàng

- **Kernel** (nhân Linux) giống **kho tiền và hệ thống lõi** của ngân hàng: quản lý CPU, RAM, ổ đĩa, mạng. Bạn không được vào thẳng đó.
- **Shell** (bash, zsh) là **giao dịch viên ở quầy**: bạn nói "rút 2 triệu" (gõ lệnh), giao dịch viên chuyển yêu cầu vào hệ thống lõi (gọi **system call**), rồi trả kết quả cho bạn.
- **Terminal** là **cái quầy** - cửa sổ để bạn nói chuyện với giao dịch viên.

```mermaid
flowchart LR
    U["Bạn gõ lệnh"] --> T["Terminal<br/>(cửa sổ)"]
    T --> S["Shell (bash/zsh)<br/>phân tích lệnh, biến, pipe"]
    S --> P["Chương trình<br/>(ls, grep, app của bạn)"]
    P --> K["Kernel Linux<br/>(system call: open, read, fork, socket)"]
    K --> H["Phần cứng<br/>CPU, RAM, disk, NIC"]
```

### Cấu trúc một câu lệnh

```bash
ls -la /var/log
│   │   └── đối số (argument): thư mục cần liệt kê
│   └────── tùy chọn (option/flag): -l (chi tiết) + -a (cả file ẩn)
└────────── tên lệnh (command)
```

Các "phím tắt sống còn" trong terminal:

| Phím / lệnh | Tác dụng |
|---|---|
| `Tab` | Tự hoàn thành tên file/lệnh (bấm 2 lần để xem gợi ý) |
| `Ctrl+C` | Gửi **SIGINT** - dừng lệnh đang chạy |
| `Ctrl+R` | Tìm lại lệnh cũ trong lịch sử |
| `Ctrl+L` hoặc `clear` | Xóa màn hình |
| `!!` | Chạy lại lệnh vừa rồi (vd `sudo !!`) |
| `man ls`, `ls --help` | Xem hướng dẫn của lệnh |
| `history \| tail -20` | 20 lệnh gần nhất |

---

## 📖 2. Filesystem - "Mọi thứ đều là file"

### Cây thư mục chuẩn (FHS)

Linux không có ổ `C:`, `D:`. Tất cả bắt đầu từ **gốc `/`**:

```mermaid
flowchart TD
    R["/ (root)"] --> ETC["/etc<br/>file cấu hình<br/>nginx, systemd, ssh"]
    R --> VAR["/var<br/>dữ liệu thay đổi"]
    VAR --> LOG["/var/log<br/>log hệ thống, nginx"]
    VAR --> LIB["/var/lib<br/>dữ liệu DB, docker"]
    R --> HOME["/home/USER<br/>thư mục người dùng"]
    R --> OPT["/opt<br/>app cài thủ công<br/>(vd /opt/cinema)"]
    R --> USR["/usr/bin, /usr/local/bin<br/>chương trình"]
    R --> TMP["/tmp<br/>file tạm, xóa khi reboot"]
    R --> PROC["/proc<br/>thông tin process, kernel<br/>(file ảo)"]
    R --> DEV["/dev<br/>thiết bị: disk, /dev/null"]
```

| Thư mục | Backend dev dùng khi nào |
|---|---|
| `/etc` | Sửa cấu hình nginx (`/etc/nginx/`), systemd unit (`/etc/systemd/system/`), hosts (`/etc/hosts`) |
| `/var/log` | Đọc log: `/var/log/nginx/access.log`, `/var/log/syslog` |
| `/var/lib` | Dữ liệu PostgreSQL (`/var/lib/postgresql`), Docker (`/var/lib/docker`) - thủ phạm hay gây **đầy ổ** |
| `/opt` hoặc `/srv` | Nơi đặt app của bạn: `/opt/cinema/current/` |
| `/proc` | `cat /proc/cpuinfo`, `/proc/<pid>/environ` - xem env của process |
| `/tmp` | File tạm. **Đừng lưu dữ liệu quan trọng** ở đây |

### Các lệnh cơ bản với file

```bash
pwd                          # Tôi đang ở đâu?  → /home/dev
cd /var/log                  # Đi tới thư mục (đường dẫn tuyệt đối)
cd ..                        # Lên một cấp
cd -                         # Quay lại thư mục trước đó
cd ~                         # Về home (~ = /home/dev)

ls -lah                      # Liệt kê chi tiết, cả file ẩn, dung lượng dễ đọc (K, M, G)
mkdir -p /opt/cinema/releases/v1   # Tạo cả chuỗi thư mục, không lỗi nếu đã có
touch app.env                # Tạo file rỗng (hoặc cập nhật thời gian sửa)
cp config.yaml config.yaml.bak      # Sao chép (backup trước khi sửa - thói quen tốt!)
cp -r src/ backup/           # Sao chép cả thư mục
mv old.log archive/          # Di chuyển / đổi tên
rm file.txt                  # Xóa file - KHÔNG có thùng rác!
rm -r thu-muc/               # Xóa thư mục và mọi thứ bên trong

cat small.txt                # In toàn bộ file (chỉ dùng với file nhỏ)
less big.log                 # Xem file lớn, cuộn được (/ để tìm, q để thoát, G xuống cuối)
head -n 20 app.log           # 20 dòng đầu
tail -n 50 app.log           # 50 dòng cuối
tail -f app.log              # "Theo dõi" file - in dòng mới khi được ghi thêm (Ctrl+C để thoát)
wc -l access.log             # Đếm số dòng
```

!!! warning "`rm -rf` - lệnh nguy hiểm nhất"
    `rm -rf $DIR/` với biến `DIR` **rỗng** sẽ thành `rm -rf /` - xóa sạch máy. Luôn dùng `set -u` trong script (mục 5) và kiểm tra biến trước khi xóa: `rm -rf "${DIR:?DIR chưa được đặt}/"`. Cú pháp `${DIR:?msg}` làm script **dừng ngay** nếu `DIR` rỗng.

### Đường dẫn tuyệt đối vs tương đối, symlink

- **Tuyệt đối** bắt đầu bằng `/`: `/opt/cinema/current/bin/api` - dùng trong script, systemd, cron (vì các môi trường này **không biết** bạn đang "đứng" ở đâu)
- **Tương đối**: `./bin/api`, `../config` - tính từ thư mục hiện tại

**Symbolic link** (lối tắt) cực kỳ hữu ích khi deploy:

```bash
ln -sfn /opt/cinema/releases/v2 /opt/cinema/current
# -s: symlink, -f: ghi đè link cũ, -n: coi link cũ là file (không đi vào trong nó)
ls -l /opt/cinema/current
# Output (ví dụ): lrwxrwxrwx 1 deploy deploy 23 Sep 28 10:00 /opt/cinema/current -> /opt/cinema/releases/v2
```

App luôn chạy từ `/opt/cinema/current`. Deploy bản mới = đổi link sang `releases/v3`; rollback = đổi link về `releases/v2`. Đổi symlink gần như tức thời - đây là kỹ thuật mà Capistrano, Deployer và rất nhiều hệ thống deploy dùng. Ta sẽ viết script này ở mục 13.

### "Mọi thứ đều là file"

Trên Linux, rất nhiều thứ được trình bày như file: thiết bị (`/dev/sda`), thông tin process (`/proc/1234/`), thậm chí **socket mạng** và **pipe**. Hệ quả thực tế: lỗi **"too many open files"** không chỉ do mở nhiều file - mỗi **kết nối TCP** cũng tốn một **file descriptor**. Server nhận 10.000 kết nối cần giới hạn `ulimit -n` đủ lớn (xem mục 11).

---

## 📖 3. User & Permission - Ai được làm gì?

### Ví von: Chung cư

Mỗi file giống một **căn hộ** có 3 nhóm người: **chủ nhà** (owner/user), **người trong gia đình** (group) và **người ngoài** (others). Với mỗi nhóm có 3 quyền: **đọc** (r), **ghi** (w), **thực thi** (x).

```bash
ls -l /opt/cinema/
# Output (ví dụ):
# -rwxr-x--- 1 cinema cinema 12M Sep 28 10:00 api
# -rw-r----- 1 cinema cinema 312 Sep 28 10:00 app.env
# drwxr-xr-x 2 cinema cinema 4.0K Sep 28 10:00 static
```

Giải mã `-rwxr-x---`:

```text
-    rwx    r-x    ---
│    │      │      └── others (người khác): không có quyền gì
│    │      └───────── group (nhóm cinema): đọc + thực thi
│    └──────────────── user/owner (cinema): đọc + ghi + thực thi
└───────────────────── loại: - file thường, d thư mục, l symlink
```

| Quyền | Với file | Với thư mục |
|---|---|---|
| `r` (4) | Đọc nội dung | Liệt kê tên file bên trong (`ls`) |
| `w` (2) | Sửa nội dung | Tạo/xóa/đổi tên file bên trong |
| `x` (1) | Chạy như chương trình | **Đi vào** thư mục (`cd`), truy cập file bên trong |

### Số bát phân (octal) - cộng điểm

`r=4, w=2, x=1`, cộng lại cho từng nhóm:

| Octal | Ký hiệu | Dùng cho |
|---|---|---|
| `755` | `rwxr-xr-x` | Chương trình, thư mục công khai |
| `644` | `rw-r--r--` | File cấu hình thông thường, file tĩnh |
| `640` | `rw-r-----` | File cấu hình có bí mật, chỉ owner + group đọc |
| `600` | `rw-------` | **Private key SSH**, file `.env` chứa mật khẩu |
| `700` | `rwx------` | Thư mục `~/.ssh` |
| `777` | `rwxrwxrwx` | ❌ **Gần như không bao giờ đúng** - ai cũng sửa được |

```bash
chmod 600 ~/.ssh/id_ed25519        # Private key: chỉ mình tôi đọc/ghi
chmod +x deploy.sh                 # Thêm quyền thực thi cho mọi nhóm
chmod u+x,g-w,o-rwx app            # Dạng ký hiệu: user thêm x, group bỏ w, others bỏ hết
chown cinema:cinema /opt/cinema -R # Đổi owner và group (cần sudo), -R đệ quy
id                                 # Tôi là ai, thuộc group nào
# Output (ví dụ): uid=1000(dev) gid=1000(dev) groups=1000(dev),27(sudo),998(docker)
```

### root, sudo và nguyên tắc "đặc quyền tối thiểu"

- `root` (uid 0) là "chủ tịch" - làm được mọi thứ, kể cả xóa hệ điều hành.
- `sudo <lệnh>` = chạy **một lệnh** với quyền root, có ghi log ai đã làm gì.
- App backend nên chạy bằng **user riêng không có quyền đăng nhập**:

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin cinema
```

Vì sao? Nếu app bị hack (vd lỗi RCE), kẻ tấn công chỉ có quyền của user `cinema` - không đọc được `/etc/shadow`, không cài được rootkit. Đây là nguyên tắc **least privilege** bạn sẽ gặp lại ở [Bài 12: Bảo mật Backend](./12-security.md).

> 💡 **Port dưới 1024** (80, 443) mặc định cần quyền root để listen. Thay vì chạy app bằng root, hãy cho app listen port cao (8080) và đặt **nginx** (reverse proxy - xem Bài 1) ở phía trước, hoặc dùng `AmbientCapabilities=CAP_NET_BIND_SERVICE` trong systemd.

### 💡 Tips quan trọng

- Lỗi `Permission denied` → kiểm tra theo thứ tự: `ls -l` file, `ls -ld` **từng thư mục cha** (thiếu `x` ở thư mục cha cũng bị chặn), `id` xem mình thuộc group nào
- SSH từ chối private key có quyền `644` với lỗi `UNPROTECTED PRIVATE KEY FILE` - phải `chmod 600`
- `umask 027` trong service → file app tạo ra mặc định là `640`, thư mục `750`

---

## 📖 4. Process & Signal - Quản lý "công nhân" trong máy

### Process là gì?

Mỗi chương trình đang chạy là một **process** có:

- **PID** (process ID) - số định danh duy nhất
- **PPID** - PID của process cha (process nào đã khởi động nó)
- **User** chạy nó, **trạng thái**, lượng **CPU/RAM** đang dùng
- Các **file descriptor** đang mở: `0` stdin, `1` stdout, `2` stderr, file, socket...

```bash
ps aux | head -5                   # Mọi process: user, PID, %CPU, %MEM, lệnh
ps aux | grep '[a]pi'              # Tìm process tên chứa "api" (mẹo [a] để không tự bắt chính lệnh grep)
pgrep -a api                       # Cách gọn hơn: PID + lệnh
ps -o pid,ppid,stat,etime,cmd -p 1234   # Thông tin chi tiết của PID 1234
top                                # Xem realtime (q để thoát, P sắp theo CPU, M theo RAM)
htop                               # Bản "đẹp" hơn của top (cần cài)
```

```text
Output (ví dụ) của ps aux:
USER       PID %CPU %MEM    VSZ   RSS TTY  STAT START   TIME COMMAND
cinema    1234  2.1  1.5 1245000 61000 ?   Ssl  09:58   0:03 /opt/cinema/current/api
postgres   812  0.3  3.2  220000 130000 ?  Ss   09:00   0:10 postgres: main
```

Cột `STAT`: `R` đang chạy, `S` đang ngủ chờ sự kiện (bình thường với server), `D` chờ I/O không ngắt được (ổ đĩa chậm!), `Z` **zombie** (đã chết nhưng cha chưa "nhận xác").

### Vòng đời của một process

```mermaid
stateDiagram-v2
    [*] --> Running: fork + exec
    Running --> Sleeping: chờ I/O, chờ request
    Sleeping --> Running: có dữ liệu
    Running --> Stopped: SIGSTOP / Ctrl+Z
    Stopped --> Running: SIGCONT / fg
    Running --> Zombie: exit(code)
    Zombie --> [*]: cha gọi wait()
```

### Signal - "Tin nhắn" gửi tới process

Signal là cách hệ điều hành (hoặc bạn) **báo** cho process một sự kiện.

| Signal | Số | Gửi bằng | Ý nghĩa | Process có bắt được không? |
|---|---|---|---|---|
| `SIGINT` | 2 | `Ctrl+C` | "Ngắt" - người dùng muốn dừng | ✅ Có |
| `SIGTERM` | 15 | `kill PID` (mặc định), `docker stop`, `systemctl stop`, Kubernetes | "Làm ơn dừng lại" - **lịch sự** | ✅ Có - nên dọn dẹp rồi thoát |
| `SIGKILL` | 9 | `kill -9 PID`, OOM killer | "Chết ngay" - kernel giết thẳng | ❌ **Không** - không kịp dọn dẹp gì |
| `SIGHUP` | 1 | Đóng terminal, `kill -HUP` | Nhiều daemon (nginx) hiểu là "đọc lại cấu hình" | ✅ Có |
| `SIGQUIT` | 3 | `Ctrl+\` | Thoát + dump (Go in stack trace của mọi goroutine!) | ✅ Có |
| `SIGSTOP`/`SIGCONT` | 19/18 | `Ctrl+Z` / `fg` | Tạm dừng / chạy tiếp | ❌ / ✅ |

### SIGTERM vs SIGKILL - Ví von nhà hàng

- **SIGTERM** = quản lý nói với đầu bếp: *"Hết giờ rồi, nấu nốt mấy món khách đã gọi, đừng nhận order mới, dọn bếp rồi về."*
- **SIGKILL** = **cúp cầu dao điện**. Món đang nấu dở bỏ đó, bếp bẩn nguyên.

Với backend, "món đang nấu dở" là: request HTTP đang xử lý, transaction DB chưa commit, message queue chưa ack, file ghi dở. Vì vậy quy trình dừng chuẩn (Docker, systemd, Kubernetes đều làm vậy) là:

```mermaid
sequenceDiagram
    participant O as Orchestrator<br/>(systemd / docker / k8s)
    participant A as App của bạn
    O->>A: SIGTERM
    Note over A: 1. Ngừng nhận kết nối mới<br/>2. Xử lý nốt request đang chạy<br/>3. Đóng DB pool, flush log
    alt Dọn xong trong thời gian cho phép
        A-->>O: exit(0)
    else Quá hạn (docker 10s, k8s 30s, systemd 90s)
        O->>A: SIGKILL
        Note over A: Chết ngay, request dở bị cắt
    end
```

```bash
kill 1234            # Gửi SIGTERM (mặc định) - LUÔN thử cách này trước
kill -TERM 1234      # Tương đương
kill -9 1234         # SIGKILL - chỉ dùng khi process "treo" không chịu thoát
pkill -f 'cinema/current/api'    # Gửi SIGTERM theo tên/lệnh
kill -l              # Liệt kê mọi signal
```

### Graceful shutdown - Code thật

Chương trình dưới đây chạy HTTP server ở cổng 8080, có endpoint `/slow` mất 3 giây. Khi nhận SIGTERM hoặc Ctrl+C, nó **không** chết ngay mà chờ request `/slow` đang chạy trả lời xong.

=== "Go"

    ```go
    package main

    import (
    	"context"
    	"errors"
    	"fmt"
    	"net/http"
    	"os"
    	"os/signal"
    	"syscall"
    	"time"
    )

    func main() {
    	mux := http.NewServeMux()
    	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
    		fmt.Fprintln(w, "ok")
    	})
    	mux.HandleFunc("GET /slow", func(w http.ResponseWriter, r *http.Request) {
    		time.Sleep(3 * time.Second) // giả lập xử lý lâu (gọi cổng thanh toán...)
    		fmt.Fprintln(w, "xong việc chậm")
    	})
    	srv := &http.Server{Addr: ":8080", Handler: mux}

    	// ctx bị hủy khi nhận SIGINT (Ctrl+C) hoặc SIGTERM (kill, docker stop)
    	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
    	defer stop()

    	go func() {
    		fmt.Println("PID", os.Getpid(), "đang lắng nghe :8080")
    		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
    			fmt.Println("lỗi server:", err)
    			os.Exit(1)
    		}
    	}()

    	<-ctx.Done() // chặn ở đây tới khi có signal
    	fmt.Println("nhận tín hiệu dừng, đang shutdown êm...")

    	// Cho tối đa 10 giây để xử lý nốt request đang chạy
    	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    	defer cancel()
    	if err := srv.Shutdown(shutdownCtx); err != nil {
    		fmt.Println("shutdown quá hạn:", err)
    	}
    	// Đây là chỗ đóng DB pool, flush log, ... 
    	fmt.Println("đã dừng sạch sẽ")
    }
    ```

=== "Python"

    ```python
    import os
    import signal
    import threading
    import time
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path == "/slow":
                time.sleep(3)  # giả lập xử lý lâu
                body = "xong việc chậm\n"
            else:
                body = "ok\n"
            data = body.encode()
            self.send_response(200)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, *args):  # tắt log mặc định cho gọn
            pass


    class Server(ThreadingHTTPServer):
        daemon_threads = False  # KHÔNG bỏ rơi thread đang xử lý request
        block_on_close = True   # server_close() chờ các thread đó xong


    httpd = Server(("0.0.0.0", 8080), Handler)


    def on_signal(signum, frame):
        print("nhận tín hiệu dừng, đang shutdown êm...", flush=True)
        # shutdown() phải gọi từ thread khác thread đang chạy serve_forever()
        threading.Thread(target=httpd.shutdown).start()


    signal.signal(signal.SIGTERM, on_signal)
    signal.signal(signal.SIGINT, on_signal)

    print("PID", os.getpid(), "đang lắng nghe :8080", flush=True)
    httpd.serve_forever()   # trả về khi shutdown() được gọi
    httpd.server_close()    # chờ request đang chạy xong
    # Đây là chỗ đóng DB pool, flush log, ...
    print("đã dừng sạch sẽ", flush=True)
    ```

Thử nghiệm với 2 terminal:

```bash
# Terminal 1
go run main.go        # hoặc: python3 main.py
# Terminal 2
curl localhost:8080/slow &   # gửi request chậm (chạy nền)
sleep 1; pkill -TERM -f main # gửi SIGTERM khi request còn đang xử lý
```

```text
Output (ví dụ) ở Terminal 1:
PID 48213 đang lắng nghe :8080
nhận tín hiệu dừng, đang shutdown êm...
đã dừng sạch sẽ

Output ở Terminal 2 (request KHÔNG bị cắt ngang):
xong việc chậm
```

Nếu thay bằng `kill -9`, curl sẽ báo `curl: (52) Empty reply from server` - khách hàng nhận lỗi.

!!! warning "Trong Docker: PID 1 và exec form"
    Nếu Dockerfile viết `CMD ./api` (shell form), process PID 1 là `/bin/sh`, **không chuyển tiếp** SIGTERM cho app → app bị SIGKILL sau 10 giây. Luôn dùng **exec form** `CMD ["./api"]`. Chi tiết ở [Go - Bài 17: Docker](../golang/17-docker.md).

### Exit code - "Báo cáo kết quả"

Mỗi process khi kết thúc trả về một số: **`0` = thành công**, khác 0 = lỗi. Shell lưu nó trong biến `$?`:

```bash
ls /khong-ton-tai; echo "exit code: $?"
# Output:
# ls: cannot access '/khong-ton-tai': No such file or directory
# exit code: 2
```

Quy ước: `1` lỗi chung, `2` dùng sai lệnh, `126` không có quyền chạy, `127` không tìm thấy lệnh, `128+N` bị giết bởi signal N (**`137` = 128+9 = SIGKILL** - thường là bị **OOM killer** giết vì hết RAM; `143` = 128+15 = SIGTERM).

> 💡 Thấy container restart với `exit code 137`? Gần như chắc chắn là **hết bộ nhớ (OOMKilled)**. Kiểm tra: `dmesg -T | grep -i 'killed process'` hoặc `kubectl describe pod`.

### Job control - chạy nền

```bash
./long-task.sh &           # Chạy nền, trả lại dấu nhắc ngay
jobs                       # Liệt kê job nền của shell hiện tại
fg %1                      # Đưa job 1 lên foreground
nohup ./api > api.log 2>&1 &   # Chạy tiếp kể cả khi thoát SSH (nhưng systemd tốt hơn nhiều - mục 9)
```

---

## 📖 5. Pipe & Redirection - Dây chuyền sản xuất

### 3 luồng chuẩn

Mỗi process có sẵn 3 "đường ống":

```mermaid
flowchart LR
    IN["stdin (0)<br/>bàn phím / file / pipe"] --> P["Process"]
    P --> OUT["stdout (1)<br/>kết quả bình thường"]
    P --> ERR["stderr (2)<br/>thông báo lỗi"]
```

Tách riêng stdout và stderr để: kết quả đưa vào pipe/file, còn lỗi vẫn hiện ra màn hình cho người đọc.

| Cú pháp | Ý nghĩa |
|---|---|
| `cmd > out.txt` | Ghi stdout vào file (**ghi đè**) |
| `cmd >> out.txt` | Ghi **nối thêm** vào cuối file |
| `cmd 2> err.txt` | Ghi stderr vào file |
| `cmd > all.log 2>&1` | Ghi cả stdout và stderr vào cùng file (thứ tự quan trọng!) |
| `cmd &> all.log` | Cách viết tắt của bash cho dòng trên |
| `cmd > /dev/null 2>&1` | Vứt bỏ mọi output ("hố đen") |
| `cmd < input.txt` | Lấy stdin từ file |
| `cmd1 \| cmd2` | **Pipe**: stdout của cmd1 thành stdin của cmd2 |
| `cmd \| tee out.txt` | Vừa in ra màn hình vừa ghi file |

### Pipe - Triết lý Unix

> "Viết chương trình làm **một việc** và làm thật tốt. Viết chương trình để **làm việc cùng nhau**." - Doug McIlroy

Giống **dây chuyền** trong xưởng: công nhân A lọc, B sắp xếp, C đếm. Mỗi người chỉ giỏi một việc, nối lại thành quy trình mạnh.

```bash
# "Top 3 IP gọi nhiều nhất" = lấy cột IP | sắp xếp | đếm trùng | sắp theo số đếm giảm dần | lấy 3
awk '{print $1}' access.log | sort | uniq -c | sort -rn | head -3
```

### Kết hợp lệnh: `&&`, `||`, `;`

```bash
go build -o api . && ./api          # Chỉ chạy nếu build thành công
curl -fsS localhost:8080/healthz || echo "SERVICE DOWN"   # Chạy vế phải nếu vế trái lỗi
cd /opt/cinema; ls                  # Chạy tuần tự bất kể kết quả
```

### Here-doc - ghi nhiều dòng

```bash
cat > /tmp/app.env <<'EOF'
PORT=8080
DB_URL=postgres://cinema@localhost/cinema
EOF
```

(Dấu nháy `'EOF'` nghĩa là không thay thế biến `$...` bên trong.)

### "Chế độ an toàn" cho script bash

Mặc định bash **chạy tiếp** khi một lệnh lỗi - rất nguy hiểm trong script deploy. Luôn mở đầu script bằng:

```bash
#!/usr/bin/env bash
set -euo pipefail
# -e: dừng ngay khi một lệnh lỗi
# -u: dùng biến chưa khai báo là lỗi (tránh rm -rf "$DIR/" với DIR rỗng)
# -o pipefail: pipe lỗi nếu BẤT KỲ lệnh nào trong pipe lỗi (không chỉ lệnh cuối)
```

---

## 📖 6. Xử lý văn bản: grep, sed, awk, sort, uniq, jq

Đây là "dao mổ" khi điều tra sự cố. Ta dùng file log mẫu `access.log` (định dạng giống nginx, cột cuối là thời gian xử lý tính bằng giây):

```text
10.0.0.5 - - [28/Sep/2026:10:00:01 +0700] "GET /api/movies HTTP/1.1" 200 5120 0.012
10.0.0.7 - - [28/Sep/2026:10:00:02 +0700] "POST /api/bookings HTTP/1.1" 201 312 0.180
10.0.0.5 - - [28/Sep/2026:10:00:02 +0700] "GET /api/movies/42 HTTP/1.1" 200 1024 0.009
10.0.0.9 - - [28/Sep/2026:10:00:03 +0700] "POST /api/bookings HTTP/1.1" 500 87 2.301
10.0.0.5 - - [28/Sep/2026:10:00:04 +0700] "GET /api/showtimes HTTP/1.1" 200 2048 0.034
10.0.0.7 - - [28/Sep/2026:10:00:05 +0700] "GET /api/movies HTTP/1.1" 200 5120 0.011
10.0.0.9 - - [28/Sep/2026:10:00:06 +0700] "POST /api/bookings HTTP/1.1" 502 0 5.002
10.0.0.3 - - [28/Sep/2026:10:00:07 +0700] "GET /admin HTTP/1.1" 403 64 0.002
10.0.0.5 - - [28/Sep/2026:10:00:08 +0700] "GET /api/movies HTTP/1.1" 200 5120 0.010
10.0.0.7 - - [28/Sep/2026:10:00:09 +0700] "DELETE /api/bookings/7 HTTP/1.1" 204 0 0.045
```

Khi `awk` tách theo khoảng trắng, các cột là: `$1` IP, `$4` thời gian, `$6` method (kèm dấu `"`), `$7` path, `$9` status, `$10` bytes, `$NF` (cột cuối) latency.

### grep - Lọc dòng

```bash
grep 'bookings' access.log              # Dòng chứa "bookings"
grep -v '" 200 ' access.log             # Dòng KHÔNG chứa (invert)
grep -i 'error' app.log                 # Không phân biệt hoa thường
grep -c '" 5[0-9][0-9] ' access.log     # ĐẾM số dòng lỗi 5xx
# Output: 2
grep -E '"(POST|DELETE) ' access.log | wc -l   # -E: regex mở rộng
# Output: 4
grep -rn 'DB_URL' /opt/cinema/current/  # Tìm đệ quy (-r) trong thư mục, in số dòng (-n)
grep -B 3 -A 10 'panic' app.log         # 3 dòng Trước và 10 dòng Sau mỗi chỗ panic
```

### sort, uniq, cut, wc - Thống kê nhanh

```bash
awk '{print $1}' access.log | sort | uniq -c | sort -rn | head -3
# Output:
#       4 10.0.0.5
#       3 10.0.0.7
#       2 10.0.0.9

awk '{print $9}' access.log | sort | uniq -c | sort -rn   # Phân bố status code
# Output:
#       5 200
#       1 502
#       1 500
#       1 403
#       1 204
#       1 201

cut -d'"' -f2 access.log | awk '{print $2}' | sort | uniq -c | sort -rn | head -2
# cut -d'"' -f2: tách theo dấu ", lấy phần thứ 2 = "GET /api/movies HTTP/1.1"
# Output:
#       3 /api/movies
#       3 /api/bookings
```

!!! note "`uniq` chỉ gộp các dòng trùng **liền kề**"
    Vì vậy luôn `sort` trước `uniq -c`. Quên `sort` là lỗi rất hay gặp.

### awk - "Excel trên dòng lệnh"

`awk 'điều kiện { hành động }'` chạy cho **từng dòng**; `END { }` chạy một lần ở cuối.

```bash
# Request lỗi server (status >= 500): IP, path, status
awk '$9 >= 500 {print $1, $7, $9}' access.log
# Output:
# 10.0.0.9 /api/bookings 500
# 10.0.0.9 /api/bookings 502

# Request chậm hơn 1 giây
awk '$NF > 1 {print $7, $NF"s"}' access.log
# Output:
# /api/bookings 2.301s
# /api/bookings 5.002s

# Latency trung bình
awk '{sum += $NF; n++} END {printf "avg=%.3fs n=%d\n", sum/n, n}' access.log
# Output: avg=0.761s n=10
```

### sed - Tìm & thay thế theo dòng

```bash
# Ẩn 2 octet cuối của IP trước khi gửi log cho bên thứ ba (bảo vệ dữ liệu cá nhân)
sed -E 's/^([0-9]+\.[0-9]+)\.[0-9]+\.[0-9]+/\1.x.x/' access.log | head -2
# Output:
# 10.0.x.x - - [28/Sep/2026:10:00:01 +0700] "GET /api/movies HTTP/1.1" 200 5120 0.012
# 10.0.x.x - - [28/Sep/2026:10:00:02 +0700] "POST /api/bookings HTTP/1.1" 201 312 0.180

sed -i.bak 's/^PORT=.*/PORT=9090/' app.env   # Sửa file tại chỗ (-i), giữ bản backup .bak
sed -n '100,120p' big.log                     # In dòng 100 → 120
```

### jq - Xử lý JSON (log có cấu trúc)

App hiện đại thường ghi **log dạng JSON** (mỗi dòng một object - JSON Lines). `jq` là "grep + awk cho JSON". File `app.jsonl`:

```json
{"ts":"2026-09-28T10:00:02Z","level":"info","msg":"booking created","user_id":17,"latency_ms":180}
{"ts":"2026-09-28T10:00:03Z","level":"error","msg":"db timeout","user_id":21,"latency_ms":2301}
{"ts":"2026-09-28T10:00:06Z","level":"error","msg":"payment gateway 502","user_id":21,"latency_ms":5002}
{"ts":"2026-09-28T10:00:09Z","level":"info","msg":"booking cancelled","user_id":17,"latency_ms":45}
```

```bash
jq -r 'select(.level=="error") | "\(.ts) \(.msg)"' app.jsonl
# Output:
# 2026-09-28T10:00:03Z db timeout
# 2026-09-28T10:00:06Z payment gateway 502

jq -s 'map(.latency_ms) | add / length' app.jsonl      # -s: gom mọi dòng thành 1 mảng
# Output: 1882

jq -s -c 'group_by(.level) | map({level: .[0].level, count: length})' app.jsonl
# Output: [{"level":"error","count":2},{"level":"info","count":2}]

curl -s https://api.github.com/repos/golang/go | jq '{stars: .stargazers_count, lang: .language}'
# Output (ví dụ): { "stars": 130000, "lang": "Go" }
```

### 💡 Tips quan trọng

- Log lớn hàng GB: dùng `grep` lọc **trước**, rồi mới `awk`/`sort` - `grep` cực nhanh
- Log nén `.gz` (sau khi logrotate): dùng `zgrep`, `zcat file.gz | awk ...`
- Khi pipeline phức tạp quá 3-4 lệnh, cân nhắc viết script Python/Go - dễ đọc và test hơn

---

## 📖 7. find & xargs - Tìm và xử lý hàng loạt

```bash
find /var/log -name '*.log' -size +100M          # File .log lớn hơn 100MB
find /opt/cinema/releases -maxdepth 1 -type d -mtime +30   # Thư mục release cũ hơn 30 ngày
find . -name '*.go' -newer go.mod                # File .go sửa sau go.mod
find /tmp -type f -user cinema -delete           # Xóa file tạm của user cinema

# xargs: biến output thành đối số cho lệnh khác
find . -name '*.py' | xargs grep -l 'import requests'     # File Python nào dùng requests?
find . -name '*.log' -print0 | xargs -0 gzip              # -print0/-0: an toàn với tên file có khoảng trắng
cat urls.txt | xargs -P 8 -n 1 curl -s -o /dev/null -w '%{http_code} %{url}\n'   # 8 request song song
```

> 💡 `find ... -exec cmd {} +` tương đương `| xargs cmd` và an toàn với tên file lạ. Còn `xargs -P N` cho phép chạy **song song** - rất tiện để "bắn" thử nhiều request.

---

## 📖 8. Công cụ mạng: ss, lsof, curl, dig, nc

Nhắc lại từ [Bài 1](./01-how-the-web-works.md): debug mạng **đi từ dưới lên**. Đây là bộ công cụ cho từng tầng:

```mermaid
flowchart TB
    A["Tầng ứng dụng (HTTP)<br/>curl -i, curl -v"] --> B["TLS<br/>curl -v, openssl s_client"]
    B --> C["TCP - port có mở không?<br/>nc -zv host port, ss -tlnp"]
    C --> D["DNS - tên ra IP nào?<br/>dig, getent hosts"]
    D --> E["IP - có đường tới không?<br/>ping, traceroute, ip addr"]
```

### ss - Ai đang nghe port nào?

```bash
ss -tlnp            # t: TCP, l: listening, n: số (không đổi ra tên), p: process
```

```text
Output (ví dụ):
State   Recv-Q  Send-Q  Local Address:Port  Peer Address:Port  Process
LISTEN  0       4096        127.0.0.1:5432       0.0.0.0:*      users:(("postgres",pid=812,fd=6))
LISTEN  0       4096                *:8080             *:*      users:(("api",pid=1234,fd=3))
LISTEN  0       511           0.0.0.0:80         0.0.0.0:*      users:(("nginx",pid=700,fd=6))
```

Đọc được gì? Postgres chỉ nghe `127.0.0.1` (an toàn - không lộ ra ngoài). App nghe mọi interface ở 8080. Nginx nghe 80.

```bash
ss -tn state established '( dport = :5432 )' | wc -l   # Bao nhiêu kết nối tới Postgres?
ss -s                                                  # Tổng quan: bao nhiêu TCP estab, time-wait...
lsof -i :8080                                          # Process nào dùng port 8080 (cách khác)
```

### curl - "Dao Thụy Sĩ" của backend dev

```bash
curl -i http://localhost:8080/healthz          # -i: in cả status + header
curl -v https://example.com                   # -v: xem DNS, TCP, TLS handshake, header gửi/nhận
curl -X POST localhost:8080/api/bookings \
     -H 'Content-Type: application/json' \
     -H 'Authorization: Bearer <token>' \
     -d '{"showtime_id": 42, "seats": ["F7","F8"]}'
curl -fsS localhost:8080/healthz              # -f: exit code ≠ 0 nếu HTTP >= 400 (dùng trong script!)
curl -o /dev/null -s -w 'dns=%{time_namelookup} connect=%{time_connect} tls=%{time_appconnect} total=%{time_total}\n' https://example.com
# Output (ví dụ): dns=0.004 connect=0.021 tls=0.058 total=0.112
```

Dòng cuối cực kỳ hữu ích khi ai đó kêu "API chậm": bạn biết ngay chậm ở **DNS**, **kết nối**, **TLS** hay **server xử lý**.

### dig, nc, ping

```bash
dig +short api.example.com           # IP của tên miền
dig api.example.com @8.8.8.8         # Hỏi thẳng DNS server của Google (so sánh khi nghi DNS nội bộ sai)
nc -zv db.internal 5432              # Port 5432 có mở không? (-z: chỉ quét, -v: in kết quả)
# Output (ví dụ): Connection to db.internal 5432 port [tcp/postgresql] succeeded!
ping -c 3 10.0.0.9                   # Có đường tới máy đó không (ICMP, có thể bị firewall chặn)
ip addr                              # IP của máy mình
```

---

## 📖 9. Biến môi trường - Cấu hình không nằm trong code

### Vì sao?

Theo **12-Factor App** (nguyên tắc số III): *cấu hình thay đổi giữa các môi trường (dev, staging, prod) phải nằm trong biến môi trường, không nằm trong code*. Lợi ích:

- Cùng **một file binary/image** chạy được ở mọi nơi, chỉ khác env
- **Không commit mật khẩu** lên Git
- Docker, systemd, Kubernetes đều hỗ trợ truyền env sẵn

```bash
export PORT=9090                # Đặt biến cho shell hiện tại và các process con
echo "$PORT"                    # Đọc
env | grep -i port              # Xem mọi biến môi trường
PORT=7070 ./api                 # Đặt biến CHỈ cho lệnh này
unset PORT                      # Xóa
echo "$PATH"                    # PATH: danh sách thư mục shell tìm lệnh, phân cách bởi ":"
cat /proc/1234/environ | tr '\0' '\n'   # Xem env của một process ĐANG chạy (cần quyền)
```

> 💡 `export` chỉ có tác dụng với shell hiện tại và con của nó. Muốn lâu dài, thêm vào `~/.bashrc`. Nhưng **service chạy bằng systemd không đọc `~/.bashrc`** - phải khai báo trong unit file (mục 10).

### Đọc cấu hình từ env - có mặc định và kiểm tra

Nguyên tắc: **fail fast** - thiếu cấu hình bắt buộc thì dừng ngay lúc khởi động với thông báo rõ ràng, đừng để đến lúc có request mới lỗi.

=== "Go"

    ```go
    package main

    import (
    	"fmt"
    	"os"
    	"strconv"
    	"time"
    )

    type Config struct {
    	Port        int
    	DatabaseURL string
    	ReadTimeout time.Duration
    }

    func getenv(key, def string) string {
    	if v, ok := os.LookupEnv(key); ok && v != "" {
    		return v
    	}
    	return def
    }

    func loadConfig() (Config, error) {
    	var c Config
    	port, err := strconv.Atoi(getenv("PORT", "8080"))
    	if err != nil || port < 1 || port > 65535 {
    		return c, fmt.Errorf("PORT không hợp lệ: %q", os.Getenv("PORT"))
    	}
    	c.Port = port

    	c.DatabaseURL = os.Getenv("DATABASE_URL")
    	if c.DatabaseURL == "" {
    		return c, fmt.Errorf("thiếu biến bắt buộc DATABASE_URL")
    	}

    	c.ReadTimeout, err = time.ParseDuration(getenv("READ_TIMEOUT", "5s"))
    	if err != nil {
    		return c, fmt.Errorf("READ_TIMEOUT không hợp lệ: %w", err)
    	}
    	return c, nil
    }

    func main() {
    	cfg, err := loadConfig()
    	if err != nil {
    		fmt.Fprintln(os.Stderr, "lỗi cấu hình:", err)
    		os.Exit(1)
    	}
    	fmt.Printf("port=%d timeout=%s db_set=%v\n", cfg.Port, cfg.ReadTimeout, cfg.DatabaseURL != "")
    }
    ```

=== "Python"

    ```python
    import os
    import sys
    from dataclasses import dataclass


    @dataclass(frozen=True)
    class Config:
        port: int
        database_url: str
        read_timeout: float


    def load_config() -> Config:
        try:
            port = int(os.environ.get("PORT") or "8080")
            if not 1 <= port <= 65535:
                raise ValueError
        except ValueError:
            raise SystemExit(f"lỗi cấu hình: PORT không hợp lệ: {os.environ.get('PORT')!r}")

        database_url = os.environ.get("DATABASE_URL", "")
        if not database_url:
            raise SystemExit("lỗi cấu hình: thiếu biến bắt buộc DATABASE_URL")

        read_timeout = float(os.environ.get("READ_TIMEOUT_SECONDS") or "5")
        return Config(port, database_url, read_timeout)


    if __name__ == "__main__":
        cfg = load_config()
        print(f"port={cfg.port} timeout={cfg.read_timeout}s db_set={bool(cfg.database_url)}")
    ```

```bash
go run config.go
# Output: lỗi cấu hình: thiếu biến bắt buộc DATABASE_URL   (exit code 1)
DATABASE_URL=postgres://localhost/cinema PORT=9090 go run config.go
# Output: port=9090 timeout=5s db_set=true
DATABASE_URL=postgres://localhost/cinema PORT=abc python3 config.py
# Output: lỗi cấu hình: PORT không hợp lệ: 'abc'
```

!!! warning "Đừng in giá trị bí mật ra log"
    Code trên chỉ in `db_set=true`, **không** in `DATABASE_URL` (chứa mật khẩu). Log thường được gửi đi nhiều nơi (ELK, Datadog...) và nhiều người đọc được.

---

## 📖 10. systemd - Biến app thành "dịch vụ" thật sự

### Vì sao không dùng `nohup ./api &`?

`nohup` chạy được, nhưng: app crash thì **không ai khởi động lại**; reboot server thì app **không tự chạy**; log nằm lung tung; không giới hạn tài nguyên. **systemd** (process PID 1 trên hầu hết Linux hiện đại) giải quyết tất cả.

```mermaid
flowchart LR
    B["Server khởi động"] --> SD["systemd (PID 1)"]
    SD -->|"đọc /etc/systemd/system/cinema-api.service"| S["Start app<br/>User=cinema"]
    S --> R{"App đang chạy"}
    R -->|"crash (exit ≠ 0)"| W["Chờ RestartSec=2s"] --> S
    R -->|"stdout/stderr"| J["journald<br/>xem bằng journalctl"]
    R -->|"systemctl stop"| T["SIGTERM → chờ TimeoutStopSec → SIGKILL"]
```

### Unit file cho app Go

File `/etc/systemd/system/cinema-api.service`:

```ini
[Unit]
Description=Cinema Booking API (Go)
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=cinema
Group=cinema
WorkingDirectory=/opt/cinema/current
EnvironmentFile=/etc/cinema/api.env
ExecStart=/opt/cinema/current/api
Restart=on-failure
RestartSec=2s
TimeoutStopSec=30s
KillSignal=SIGTERM
LimitNOFILE=65536

# Hardening: hạn chế những gì app được làm
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/lib/cinema

[Install]
WantedBy=multi-user.target
```

File `/etc/cinema/api.env` (quyền `640`, owner `root:cinema`):

```bash
PORT=8080
DATABASE_URL=postgres://cinema:SECRET@127.0.0.1:5432/cinema
```

### Unit file cho app Python (FastAPI + uvicorn)

Chỉ khác vài dòng trong `[Service]`:

```ini
[Service]
User=cinema
WorkingDirectory=/opt/cinema-py/current
EnvironmentFile=/etc/cinema/api.env
Environment=PYTHONUNBUFFERED=1
ExecStart=/opt/cinema-py/current/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 4
Restart=on-failure
TimeoutStopSec=30s
```

> 💡 `PYTHONUNBUFFERED=1` để `print()`/log hiện ngay trong journal thay vì bị giữ trong buffer. Dùng **đường dẫn tuyệt đối tới venv** - systemd không "activate" venv cho bạn.

### Các lệnh systemctl

```bash
sudo systemctl daemon-reload            # BẮT BUỘC sau khi tạo/sửa unit file
sudo systemctl enable --now cinema-api  # Bật tự chạy khi boot + start ngay
sudo systemctl status cinema-api        # Trạng thái, PID, RAM, vài dòng log cuối
sudo systemctl restart cinema-api       # Dừng rồi chạy lại
sudo systemctl stop cinema-api          # Gửi SIGTERM (KillSignal)
systemctl list-units --type=service --state=failed   # Service nào đang lỗi?
systemctl cat cinema-api                # Xem unit file đang có hiệu lực
```

```text
Output (ví dụ) của systemctl status:
● cinema-api.service - Cinema Booking API (Go)
     Loaded: loaded (/etc/systemd/system/cinema-api.service; enabled)
     Active: active (running) since Mon 2026-09-28 09:58:02 +07; 2min ago
   Main PID: 1234 (api)
     Memory: 18.2M
     CGroup: /system.slice/cinema-api.service
             └─1234 /opt/cinema/current/api
```

### journalctl - Đọc log của service

```bash
journalctl -u cinema-api -f                      # Theo dõi realtime (như tail -f)
journalctl -u cinema-api -n 100 --no-pager       # 100 dòng cuối
journalctl -u cinema-api --since "10 min ago"    # 10 phút gần đây
journalctl -u cinema-api --since today -p err    # Chỉ mức error trở lên
journalctl -u cinema-api -o cat | jq 'select(.level=="error")'   # App log JSON → lọc bằng jq
journalctl -u cinema-api -b                      # Từ lần boot gần nhất
journalctl --disk-usage                          # Journal đang chiếm bao nhiêu disk
```

---

## 📖 11. cron & systemd timer - Việc định kỳ

### Cú pháp cron

```text
┌───────── phút (0-59)
│ ┌─────── giờ (0-23)
│ │ ┌───── ngày trong tháng (1-31)
│ │ │ ┌─── tháng (1-12)
│ │ │ │ ┌─ thứ trong tuần (0-7, 0 và 7 = Chủ nhật)
│ │ │ │ │
* * * * *  lệnh
```

| Biểu thức | Nghĩa |
|---|---|
| `*/5 * * * *` | Mỗi 5 phút |
| `0 2 * * *` | 2:00 sáng mỗi ngày (backup DB) |
| `30 8 * * 1-5` | 8:30 các ngày thứ 2 - thứ 6 |
| `0 0 1 * *` | 0:00 ngày 1 hàng tháng (xuất báo cáo doanh thu) |

```bash
crontab -e      # Sửa crontab của user hiện tại
crontab -l      # Xem
```

Ví dụ: dọn vé giữ chỗ hết hạn mỗi phút, backup lúc 2 giờ sáng:

```bash
* * * * * /usr/bin/flock -n /tmp/expire.lock /opt/cinema/current/bin/expire-holds >> /var/log/cinema/cron.log 2>&1
0 2 * * * /opt/cinema/scripts/backup-db.sh >> /var/log/cinema/backup.log 2>&1
```

!!! warning "Những cái bẫy của cron"
    - Cron chạy với **PATH tối thiểu** (`/usr/bin:/bin`) và **không đọc `.bashrc`** → luôn dùng **đường dẫn tuyệt đối**
    - Output không được chuyển hướng sẽ bị gửi "mail" và **biến mất** → luôn `>> file.log 2>&1`
    - Ký tự `%` trong crontab có nghĩa đặc biệt (xuống dòng) → phải viết `\%` (hay gặp với `date +%F`)
    - Job chạy lâu hơn chu kỳ sẽ **chồng lên nhau** → dùng `flock -n` để chỉ một bản chạy
    - Cron dùng **múi giờ của server** (thường là UTC!) - "2 giờ sáng" có thể là 9 giờ sáng giờ Việt Nam
    - Chạy trên **nhiều server** thì job chạy **nhiều lần** → cần distributed lock hoặc scheduler trung tâm (xem [Bài 9](./09-message-queues.md))

**systemd timer** là lựa chọn hiện đại hơn: log vào journal, có `Persistent=true` (chạy bù nếu máy tắt lúc đến giờ), quản lý cùng chỗ với service:

```ini
# /etc/systemd/system/cinema-backup.timer
[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

(Đi kèm file `cinema-backup.service` với `Type=oneshot` và `ExecStart=/opt/cinema/scripts/backup-db.sh`; bật bằng `systemctl enable --now cinema-backup.timer`, xem lịch bằng `systemctl list-timers`.)

---

## 📖 12. SSH - Chìa khóa vào server

### Password vs SSH key

Đăng nhập bằng mật khẩu giống **khóa số** - ai đoán được là vào. Server public bị **bot dò mật khẩu** liên tục (xem `/var/log/auth.log` sẽ thấy hàng nghìn lần thử mỗi ngày). **SSH key** dùng mật mã khóa công khai:

- **Private key** (`~/.ssh/id_ed25519`) - **chìa khóa**, chỉ nằm trên máy bạn, **không bao giờ chia sẻ**
- **Public key** (`~/.ssh/id_ed25519.pub`) - **ổ khóa**, gắn lên server nào cũng được (trong `~/.ssh/authorized_keys`)

```mermaid
sequenceDiagram
    participant C as Máy bạn (có private key)
    participant S as Server (có public key trong authorized_keys)
    C->>S: Kết nối, "tôi là deploy, dùng key ed25519 này"
    S->>S: Tìm public key trong authorized_keys
    S->>C: Thử thách: ký dữ liệu phiên này đi
    C->>C: Ký bằng private key (không gửi key đi!)
    C->>S: Chữ ký
    S->>S: Kiểm tra chữ ký bằng public key
    S-->>C: Hợp lệ, mời vào
```

```bash
ssh-keygen -t ed25519 -C "dev@cinema"       # Tạo cặp key (nên đặt passphrase)
ssh-copy-id deploy@203.0.113.10             # Copy public key lên server
ssh deploy@203.0.113.10                     # Đăng nhập
```

### ~/.ssh/config - Đỡ gõ dài dòng

```text
Host cinema-prod
    HostName 203.0.113.10
    User deploy
    IdentityFile ~/.ssh/id_ed25519
    Port 22

Host cinema-db
    HostName 10.0.1.5
    User deploy
    ProxyJump cinema-prod      # Đi "nhảy" qua máy prod (bastion) để vào DB trong mạng nội bộ
```

```bash
ssh cinema-prod                                   # Thay cho ssh deploy@203.0.113.10
ssh cinema-prod 'systemctl status cinema-api'     # Chạy một lệnh từ xa
rsync -avz --delete ./dist/ cinema-prod:/opt/cinema/releases/v3/   # Đồng bộ thư mục (chỉ gửi phần thay đổi)
scp backup.sql cinema-prod:/tmp/                  # Copy 1 file
ssh -L 5433:localhost:5432 cinema-prod            # Tunnel: localhost:5433 trên máy bạn → Postgres trên server
```

Dòng cuối là **SSH tunnel**: Postgres trên server chỉ nghe `127.0.0.1` (an toàn), nhưng bạn vẫn mở được bằng DBeaver/psql ở máy mình qua `localhost:5433`.

### Làm cứng SSH server

Trong `/etc/ssh/sshd_config`:

```text
PasswordAuthentication no     # Chỉ cho đăng nhập bằng key
PermitRootLogin no            # Không cho SSH thẳng vào root
```

Rồi `sudo systemctl reload ssh`. ⚠️ **Mở sẵn một phiên SSH khác** trước khi reload - nếu cấu hình sai, bạn vẫn còn đường vào để sửa.

---

## 📖 13. Tài nguyên: disk, RAM, file descriptor

```bash
df -h                 # Dung lượng từng ổ/phân vùng
df -i                 # INODE - số lượng file tối đa (hết inode cũng báo "No space left" dù còn GB trống!)
du -sh /var/log/*     # Mỗi thứ trong /var/log chiếm bao nhiêu
du -xh / --max-depth=1 2>/dev/null | sort -rh | head   # 10 thư mục lớn nhất ở gốc (-x: không sang ổ khác)
free -h               # RAM: used, free, available (nhìn cột available!)
uptime                # Load average 1/5/15 phút
nproc                 # Số CPU core
ulimit -n             # Giới hạn số file descriptor của shell này
ls /proc/1234/fd | wc -l   # Process 1234 đang mở bao nhiêu fd
```

```text
Output (ví dụ):
$ df -h /
Filesystem      Size  Used Avail Use% Mounted on
/dev/vda1        40G   38G  2.0G  95% /
$ uptime
 10:05:01 up 12 days,  3:02,  1 user,  load average: 3.95, 2.10, 1.20
```

> 💡 **Load average** ≈ số process đang chạy hoặc chờ CPU/disk. So với `nproc`: máy 4 core có load 3.95 là "gần đầy"; load 12 là quá tải. Ba con số (1, 5, 15 phút) cho biết xu hướng: `3.95, 2.10, 1.20` = **đang tăng**.

---

## 📖 14. Script deploy nhỏ - Ghép mọi thứ lại

Quy trình "release theo thư mục + symlink" (không cần Docker/K8s, rất hợp cho VPS):

```mermaid
flowchart TD
    A["Build binary trên máy/CI"] --> B["rsync lên releases/TIMESTAMP"]
    B --> C["Đổi symlink current → release mới"]
    C --> D["systemctl restart cinema-api"]
    D --> E{"Health check<br/>/healthz OK trong 20s?"}
    E -->|"Có"| F["Xóa release cũ, giữ 5 bản gần nhất"]
    E -->|"Không"| G["Rollback: symlink về bản cũ + restart"]
    G --> H["Báo lỗi, exit 1"]
```

```bash
#!/usr/bin/env bash
# deploy.sh - Deploy Cinema API lên một server qua SSH
set -euo pipefail

HOST="${HOST:-cinema-prod}"                  # có thể ghi đè: HOST=cinema-staging ./deploy.sh
APP_DIR="/opt/cinema"
RELEASE="$(date +%Y%m%d%H%M%S)"
KEEP=5

log() { echo "[$(date +%H:%M:%S)] $*"; }

log "1/5 Build"
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o dist/api ./cmd/api

log "2/5 Upload release $RELEASE"
ssh "$HOST" "mkdir -p $APP_DIR/releases/$RELEASE"
rsync -az dist/ "$HOST:$APP_DIR/releases/$RELEASE/"

log "3/5 Chuyển symlink và restart"
PREVIOUS="$(ssh "$HOST" "readlink -f $APP_DIR/current || true")"
ssh "$HOST" "ln -sfn $APP_DIR/releases/$RELEASE $APP_DIR/current && sudo systemctl restart cinema-api"

log "4/5 Health check"
for i in $(seq 1 20); do
  if ssh "$HOST" "curl -fsS -m 2 http://127.0.0.1:8080/healthz" > /dev/null 2>&1; then
    log "Healthy sau ${i}s ✅"
    log "5/5 Dọn release cũ (giữ $KEEP bản)"
    ssh "$HOST" "cd $APP_DIR/releases && ls -1t | tail -n +$((KEEP + 1)) | xargs -r rm -rf --"
    exit 0
  fi
  sleep 1
done

log "Health check THẤT BẠI ❌ - rollback về ${PREVIOUS:-<không có>}"
if [[ -n "$PREVIOUS" ]]; then
  ssh "$HOST" "ln -sfn $PREVIOUS $APP_DIR/current && sudo systemctl restart cinema-api"
fi
ssh "$HOST" "journalctl -u cinema-api -n 30 --no-pager" || true
exit 1
```

Những điều script này làm đúng: `set -euo pipefail`; build **trước khi** động vào server; mỗi release một thư mục riêng (rollback tức thì); **health check** thay vì tin rằng "restart xong là chạy"; tự **rollback** và in log lỗi; dọn release cũ để không đầy ổ. Trong thực tế bạn sẽ chạy nó từ CI (xem [Bài 13: Testing, CI/CD & Deployment](./13-testing-cicd-deployment.md)).

> 💡 Để `sudo systemctl restart cinema-api` không hỏi mật khẩu, thêm quy tắc hẹp vào sudoers (`sudo visudo -f /etc/sudoers.d/deploy`): `deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart cinema-api` - chỉ cho đúng lệnh đó, không phải toàn quyền root.

---

## 📖 15. Ba sự cố kinh điển - Playbook xử lý

### Sự cố 1: "address already in use"

```text
listen tcp :8080: bind: address already in use          (Go)
OSError: [Errno 98] Address already in use               (Python)
```

```mermaid
flowchart TD
    A["bind: address already in use"] --> B["sudo ss -tlnp 'sport = :8080'<br/>hoặc sudo lsof -i :8080"]
    B --> C{"Process nào?"}
    C -->|"Bản cũ của chính app<br/>(chạy tay rồi quên)"| D["kill PID (SIGTERM)<br/>đợi vài giây, kiểm tra lại"]
    C -->|"App bị systemd quản lý"| E["systemctl stop/restart thay vì chạy tay"]
    C -->|"Dịch vụ khác cần port đó"| F["Đổi PORT qua biến môi trường"]
    C -->|"Không thấy process nào"| G["Có thể socket đang TIME_WAIT<br/>hoặc process ở namespace khác (Docker)<br/>docker ps, ss -tan"]
```

```bash
sudo ss -tlnp 'sport = :8080'
# Output (ví dụ): LISTEN 0 4096 *:8080 *:* users:(("api",pid=5566,fd=3))
ps -o pid,etime,cmd -p 5566        # Chạy từ bao giờ, lệnh gì?
kill 5566                          # Lịch sự trước
sleep 3; ss -tlnp 'sport = :8080'  # Còn không?
kill -9 5566                       # Chỉ khi nó không chịu dừng
```

> 💡 Go `net/http` và Python `socketserver` (thuộc tính `allow_reuse_address = True` của `HTTPServer`) đã bật `SO_REUSEADDR`, nên restart nhanh thường không dính lỗi do `TIME_WAIT`. Nếu vẫn dính → gần như chắc chắn **còn một process thật** đang giữ port.

### Sự cố 2: Disk full - "No space left on device"

Triệu chứng: DB không ghi được, app không ghi log, deploy lỗi, thậm chí không SSH được.

```bash
df -h                                              # Phân vùng nào đầy?
df -i                                              # Hay là hết inode (hàng triệu file nhỏ)?
sudo du -xh / --max-depth=2 2>/dev/null | sort -rh | head -15   # Thủ phạm ở đâu?
```

Những thủ phạm hay gặp và cách xử lý:

| Thủ phạm | Kiểm tra | Xử lý |
|---|---|---|
| Log app không được xoay vòng | `du -sh /var/log/* /opt/cinema/logs` | Cấu hình **logrotate**; ghi log ra stdout cho journald quản lý |
| Journal systemd | `journalctl --disk-usage` | `sudo journalctl --vacuum-size=500M`, đặt `SystemMaxUse=` |
| Docker image/layer cũ | `docker system df` | `docker system prune` (cẩn thận với volume) |
| Release cũ | `du -sh /opt/cinema/releases/*` | Giữ N bản gần nhất (script mục 14) |
| **File đã xóa nhưng process vẫn mở** | `sudo lsof +L1` | Restart process đó (hoặc `: > /proc/PID/fd/N`) |

!!! warning "Xóa file log mà dung lượng không giảm?"
    Khi bạn `rm app.log` trong lúc app **vẫn đang mở** file đó, tên file biến mất nhưng dữ liệu **vẫn chiếm đĩa** cho tới khi process đóng file. `lsof +L1` sẽ hiện nó là `(deleted)`. Cách đúng để làm rỗng một log đang được ghi: `truncate -s 0 app.log` (hoặc `: > app.log`), **không phải** `rm`.

Cấu hình logrotate mẫu `/etc/logrotate.d/cinema`:

```text
/var/log/cinema/*.log {
    daily
    rotate 14
    compress
    missingok
    notifempty
    copytruncate
}
```

### Sự cố 3: "Xem log service đang chạy xem nó bị gì"

```bash
systemctl status cinema-api                          # Còn sống không? restart bao nhiêu lần?
journalctl -u cinema-api -f                          # Xem realtime trong lúc tái hiện lỗi
journalctl -u cinema-api --since "10:00" --until "10:15" -p warning   # Khoảng thời gian có sự cố
journalctl -u cinema-api -o cat --since "1 hour ago" | grep -c 'db timeout'   # Đếm số lần lỗi
tail -F /var/log/nginx/access.log | awk '$9 >= 500'  # Chỉ xem request 5xx đi qua nginx (-F: theo cả khi file bị rotate)
docker logs -f --since 10m cinema-api                # Nếu app chạy trong Docker
kubectl logs -f deploy/cinema-api --since=10m        # Nếu chạy trên Kubernetes
```

Quy trình tư duy (chi tiết ở [Tư duy SE - Tư duy Debug](../mindset/05-debugging.md)): **thời điểm bắt đầu** lỗi → có **deploy/thay đổi** gì lúc đó không → lỗi **tất cả** request hay **một phần** (endpoint nào, user nào) → **tài nguyên** (CPU, RAM, disk, kết nối DB) có bất thường không.

---

## 🌍 Ứng dụng thực tế

### 1. Báo cáo nhanh sau sự cố "đặt vé lỗi lúc 10 giờ"

Sếp hỏi: *"Sáng nay bao nhiêu khách bị lỗi đặt vé, từ IP nào?"* - trả lời trong 1 phút:

```bash
grep 'POST /api/bookings' access.log | awk '$9 >= 500 {print $1}' | sort | uniq -c | sort -rn
# Output:
#       2 10.0.0.9
```

### 2. Kiểm tra "sức khỏe" server trong 30 giây khi mới SSH vào

```bash
uptime; free -h; df -h /; systemctl --failed --no-legend; ss -tlnp | head
```

Đây là "khám tổng quát": tải CPU, RAM, disk, service nào hỏng, port nào đang mở. Nhiều kỹ sư SRE lưu nó thành alias `health`.

### 3. Script Go/Python "đọc log từ stdin" - dùng được trong pipe

Viết công cụ của riêng bạn theo triết lý Unix: đọc từ **stdin**, in ra **stdout**, lỗi ra **stderr**. Chương trình sau đếm status code theo nhóm (2xx/4xx/5xx) - dùng như `cat access.log | go run statuscount.go`:

=== "Go"

    ```go
    package main

    import (
    	"bufio"
    	"fmt"
    	"os"
    	"strings"
    )

    func main() {
    	counts := map[string]int{}
    	sc := bufio.NewScanner(os.Stdin)
    	for sc.Scan() {
    		f := strings.Fields(sc.Text())
    		if len(f) < 9 {
    			fmt.Fprintln(os.Stderr, "bỏ qua dòng lỗi định dạng")
    			continue
    		}
    		counts[f[8][:1]+"xx"]++ // cột 9 = status, lấy chữ số đầu
    	}
    	for _, k := range []string{"2xx", "3xx", "4xx", "5xx"} {
    		fmt.Printf("%s %d\n", k, counts[k])
    	}
    }
    // Output (với access.log mẫu):
    // 2xx 7
    // 3xx 0
    // 4xx 1
    // 5xx 2
    ```

=== "Python"

    ```python
    import sys
    from collections import Counter

    counts = Counter()
    for line in sys.stdin:
        f = line.split()
        if len(f) < 9:
            print("bỏ qua dòng lỗi định dạng", file=sys.stderr)
            continue
        counts[f[8][0] + "xx"] += 1  # cột 9 = status, lấy chữ số đầu

    for k in ("2xx", "3xx", "4xx", "5xx"):
        print(k, counts[k])
    # Output (với access.log mẫu):
    # 2xx 7
    # 3xx 0
    # 4xx 1
    # 5xx 2
    ```

---

## ⚠️ Lỗi thường gặp

### 1. `kill -9` là phản xạ đầu tiên

```bash
kill -9 $(pgrep api)     # ❌ Request đang xử lý bị cắt, transaction dở dang
kill $(pgrep api)        # ✅ SIGTERM trước, chờ, chỉ -9 khi thật sự treo
```

### 2. `chmod 777` để "sửa" Permission denied

```bash
chmod -R 777 /opt/cinema          # ❌ Ai cũng sửa được binary và file .env
chown -R cinema:cinema /opt/cinema && chmod 750 /opt/cinema   # ✅ Đúng owner, đúng quyền
```

### 3. Thứ tự redirection sai

```bash
./api 2>&1 > app.log      # ❌ stderr vẫn ra màn hình (2 trỏ tới stdout CŨ trước khi 1 bị đổi)
./api > app.log 2>&1      # ✅ Cả hai vào app.log
```

### 4. Sửa unit file quên `daemon-reload`

systemd vẫn dùng bản cũ trong bộ nhớ và cảnh báo `Warning: The unit file changed on disk`. Luôn `sudo systemctl daemon-reload` rồi mới `restart`.

### 5. Script bash không có `set -euo pipefail`

Lệnh `go build` lỗi nhưng script vẫn chạy tiếp, upload binary **cũ** và restart - bạn tưởng đã deploy bản mới.

### 6. Biến không có nháy kép

```bash
FILE="bao cao.txt"
rm $FILE        # ❌ bash hiểu thành: rm bao cao.txt  (2 file!)
rm "$FILE"      # ✅ Luôn bọc biến trong "..."
```

### 7. App trong systemd "không thấy" biến môi trường đã export

Biến `export` trong `~/.bashrc` **không** có tác dụng với service. Dùng `Environment=` hoặc `EnvironmentFile=` trong unit file. Tương tự cho cron.

### 8. Listen `127.0.0.1` rồi thắc mắc sao máy khác không gọi được

Xem lại [Bài 1](./01-how-the-web-works.md) - phía sau nginx thì `127.0.0.1` là **đúng** (an toàn); trong Docker thì phải là `0.0.0.0`.

---

## 🏋️ Bài tập

### Bài 1 (Dễ): Khám phá hệ thống

Trả lời bằng lệnh: (a) Máy có bao nhiêu core và RAM? (b) Phân vùng `/` còn trống bao nhiêu phần trăm? (c) Có những port TCP nào đang listen? (d) 5 process tốn RAM nhất?

<details markdown="1">
<summary>Đáp án</summary>

```bash
nproc; free -h
df -h /
ss -tlnp
ps aux --sort=-%mem | head -6
```

</details>

### Bài 2 (Dễ): Quyền truy cập

Tạo file `secret.env` sao cho: owner đọc/ghi, group chỉ đọc, others không có quyền. Viết bằng cả octal và ký hiệu. Rồi giải thích vì sao thư mục chứa nó cần quyền `x` cho group.

<details markdown="1">
<summary>Đáp án</summary>

```bash
touch secret.env
chmod 640 secret.env          # octal
chmod u=rw,g=r,o= secret.env  # ký hiệu
```

Quyền `x` trên thư mục cho phép "đi vào" và truy cập file bên trong theo tên. Thiếu `x` ở thư mục cha, group không mở được `secret.env` dù file có `r`.

</details>

### Bài 3 (Trung bình): Phân tích log

Với `access.log` mẫu ở mục 6, viết pipeline: (a) tỉ lệ phần trăm request lỗi 5xx; (b) endpoint (path) có latency trung bình cao nhất; (c) số request theo method.

<details markdown="1">
<summary>Đáp án</summary>

```bash
# (a)
awk '{n++} $9>=500 {e++} END {printf "%.1f%%\n", 100*e/n}' access.log
# Output: 20.0%

# (b)
awk '{s[$7]+=$NF; c[$7]++} END {for (p in s) printf "%.3f %s\n", s[p]/c[p], p}' access.log | sort -rn | head -1
# Output: 2.494 /api/bookings

# (c)
awk '{gsub(/"/, "", $6); print $6}' access.log | sort | uniq -c | sort -rn
# Output:
#       6 GET
#       3 POST
#       1 DELETE
```

</details>

### Bài 4 (Trung bình): Graceful shutdown có kiểm chứng

Chạy ví dụ graceful shutdown ở mục 4. Viết một script bash: khởi động server nền, gửi request `/slow` nền, sau 1 giây gửi SIGTERM, rồi in ra kết quả curl và exit code của server. Lặp lại với `kill -9` và so sánh.

<details markdown="1">
<summary>Gợi ý</summary>

```bash
#!/usr/bin/env bash
set -euo pipefail
go build -o /tmp/gs main.go
/tmp/gs & SERVER=$!
sleep 0.5
curl -s localhost:8080/slow > /tmp/out.txt & CURL=$!
sleep 1
kill -TERM "$SERVER"          # đổi thành kill -9 để so sánh
wait "$CURL" || echo "curl lỗi: $?"
wait "$SERVER"; echo "server exit: $?"
cat /tmp/out.txt
```

Với SIGTERM: curl nhận "xong việc chậm", server exit 0. Với `kill -9`: curl lỗi 52 (Empty reply), server exit 137.

</details>

### Bài 5 (Khó): Đưa app lên "server" bằng systemd

Trên một máy ảo Ubuntu (hoặc WSL2 có bật systemd, hoặc VPS rẻ): tạo user `cinema`, build app Go (hoặc Python) có `/healthz`, viết unit file với `Restart=on-failure`, `EnvironmentFile`, hardening. Kiểm chứng: (a) `kill -9` process → systemd tự khởi động lại sau 2 giây (xem `journalctl`); (b) reboot → app tự chạy; (c) `systemctl stop` → log có dòng "đã dừng sạch sẽ".

### Bài 6 (Khó): Deploy script có rollback

Chỉnh `deploy.sh` ở mục 14 để: (a) nhận tham số `--rollback` đổi symlink về release ngay trước đó; (b) deploy lần lượt lên **nhiều host** (`HOSTS="web1 web2"`), dừng lại nếu host đầu tiên health check thất bại (đây là ý tưởng **rolling deploy**, sẽ gặp lại ở [Bài 13](./13-testing-cicd-deployment.md)).

---

## ✅ Checklist hoàn thành

- [ ] Biết `/etc`, `/var/log`, `/var/lib`, `/opt`, `/proc` chứa gì
- [ ] Đọc hiểu `-rwxr-x---`, dùng `chmod` (octal + ký hiệu), `chown`; biết vì sao không chạy app bằng root
- [ ] Dùng `ps`, `top`, `pgrep`, `kill`; giải thích SIGTERM vs SIGKILL, exit code 137
- [ ] Viết được graceful shutdown bằng Go hoặc Python và kiểm chứng
- [ ] Dùng đúng `>`, `>>`, `2>&1`, `|`, `tee`, `&&`, `||`; luôn `set -euo pipefail` trong script
- [ ] Phân tích log bằng `grep`, `awk`, `sort | uniq -c`, `sed`, `jq`
- [ ] Dùng `find` + `xargs`, `ss -tlnp`, `lsof -i`, `curl -v`, `curl -w`, `dig`, `nc -zv`
- [ ] Đọc cấu hình từ biến môi trường, fail fast khi thiếu
- [ ] Viết unit file systemd, dùng `systemctl` và `journalctl` thành thạo
- [ ] Viết crontab đúng (đường dẫn tuyệt đối, redirect log, `flock`)
- [ ] Đăng nhập bằng SSH key, có `~/.ssh/config`, biết tạo SSH tunnel
- [ ] Xử lý được "port already in use", "disk full", "xem log service"
- [ ] Làm ít nhất 4/6 bài tập

---

**Bài tiếp theo**: [Bài 3: Thiết kế API](./03-api-design.md)
