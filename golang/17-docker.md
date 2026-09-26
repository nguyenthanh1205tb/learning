# 📚 Bài 17: Docker cho ứng dụng Go

## 🎯 Mục tiêu bài học

- Hiểu **Docker là gì**, tại sao nó giải quyết được bài toán kinh điển *"Nó chạy trên máy em mà!"*
- Phân biệt **container** và **máy ảo (VM)**; nắm vững 4 khái niệm **image, container, layer, registry**
- Cài Docker Desktop (Windows/macOS) hoặc Docker Engine (Linux) và dùng thành thạo các **lệnh cơ bản**
- Viết **Dockerfile** hiểu rõ từng lệnh: `FROM`, `WORKDIR`, `COPY`, `RUN`, `ENV`, `ARG`, `EXPOSE`, `USER`, `ENTRYPOINT`/`CMD`, `HEALTHCHECK`
- Tận dụng **layer cache** và **cache mount** để build nhanh gấp 10 lần
- Kỹ thuật riêng cho Go: **multi-stage build**, `CGO_ENABLED=0`, **binary tĩnh**, `-ldflags`, chọn base image (`golang`, `alpine`, `distroless`, `scratch`) dựa trên **số đo thật**
- Chạy container **an toàn**: user không phải root, chứng chỉ CA, múi giờ, **graceful shutdown** khi `docker stop`, hiểu vấn đề **PID 1**
- Cấu hình bằng **biến môi trường**, lưu dữ liệu bằng **volume**, cho container nói chuyện với nhau qua **network**
- **Docker Compose**: dựng cả stack Go API + PostgreSQL + Adminer bằng một lệnh; **hot reload** khi phát triển
- **Build đa nền tảng** (amd64 + arm64), đẩy image lên **Docker Hub / GHCR**, tự động hóa bằng **GitHub Actions**, **quét lỗ hổng** image
- **Debug** các lỗi hay gặp: container thoát ngay, không truy cập được cổng, `permission denied`, image quá to

> 💡 **Bài này nối tiếp Bài 16.** Ở [Bài 16](./16-production-ready.md) bạn đã viết Dockerfile multi-stage cho Bookmark API (mục 12). Bài này đi **sâu và rộng hơn**: từ con số 0 về Docker đến quy trình làm việc thực tế của một team Go. Mọi lệnh, kích thước image, log và kết quả `curl` trong bài đều được **chạy thật** với Docker 29.3, Docker Compose v5.1 và Go 1.24.

## 📖 1. Docker là gì? Tại sao cần?

### Câu chuyện "Nó chạy trên máy em mà!"

Bạn viết xong API Go, chạy ngon trên laptop. Đem lên server thì:

- Server cài **PostgreSQL 13**, máy bạn dùng **17** → câu SQL mới không chạy
- Server thiếu **múi giờ** `Asia/Ho_Chi_Minh` → báo cáo lệch 7 tiếng
- Đồng nghiệp dùng Windows, bạn dùng macOS, server chạy Linux → mỗi người một kiểu lỗi
- Onboard nhân viên mới mất **cả ngày** chỉ để cài database, Redis, cấu hình...

**Docker** giải quyết bằng cách **đóng gói** ứng dụng **cùng toàn bộ môi trường** của nó (hệ điều hành thu gọn, thư viện, cấu hình) thành một **image**. Image này chạy **giống hệt nhau** ở mọi nơi có Docker: laptop, server, cloud, CI.

> 💡 **Ví von - Container hàng hải**: Trước khi có container tiêu chuẩn, bốc dỡ hàng ở cảng rất khổ: thùng gỗ, bao tải, thùng phuy... mỗi loại một cách xử lý. Container thép tiêu chuẩn ra đời → mọi tàu, cần cẩu, xe tải đều xử lý **giống nhau**, không cần biết bên trong chứa gì. Docker làm điều tương tự với phần mềm: server không cần biết bên trong là Go, Python hay Java - chỉ cần biết **"chạy container"**.

### Container khác máy ảo (VM) thế nào?

> 💡 **Ví von - Nhà riêng và căn hộ chung cư**:
> - **Máy ảo (VM)** giống **xây nhiều ngôi nhà riêng**: mỗi nhà có móng, điện, nước riêng (mỗi VM có **hệ điều hành đầy đủ** với kernel riêng). Chắc chắn, cách ly tốt, nhưng **tốn đất, tốn thời gian xây**.
> - **Container** giống **các căn hộ trong một tòa chung cư**: dùng chung móng, đường điện nước (dùng chung **kernel** của máy chủ), nhưng mỗi căn có cửa, khóa, nội thất riêng (**tiến trình, file, mạng riêng**). Nhẹ, dọn vào ở ngay.

```text
        MÁY ẢO (VM)                              CONTAINER
┌────────┐ ┌────────┐ ┌────────┐      ┌────────┐ ┌────────┐ ┌────────┐
│ App A  │ │ App B  │ │ App C  │      │ App A  │ │ App B  │ │ App C  │
│ Libs   │ │ Libs   │ │ Libs   │      │ Libs   │ │ Libs   │ │ Libs   │
│Guest OS│ │Guest OS│ │Guest OS│      └────────┘ └────────┘ └────────┘
│(kernel)│ │(kernel)│ │(kernel)│      ┌──────────────────────────────┐
└────────┘ └────────┘ └────────┘      │     Docker Engine            │
┌──────────────────────────────┐      ├──────────────────────────────┤
│   Hypervisor (VMware, KVM)   │      │  Hệ điều hành máy chủ (kernel │
├──────────────────────────────┤      │  Linux dùng CHUNG)           │
│      Hệ điều hành máy chủ    │      ├──────────────────────────────┤
├──────────────────────────────┤      │          Phần cứng           │
│          Phần cứng           │      └──────────────────────────────┘
└──────────────────────────────┘
```

| Tiêu chí | Máy ảo (VM) | Container |
|----------|-------------|-----------|
| Khởi động | Vài chục giây - vài phút (boot cả OS) | **Dưới 1 giây** (chỉ là một tiến trình) |
| Kích thước | Vài GB | Vài MB - vài trăm MB (API Go trong bài: **~3.4 MB**) |
| Cách ly | Rất mạnh (kernel riêng) | Tốt (namespace, cgroup) nhưng dùng chung kernel |
| Số lượng trên 1 máy | Vài chục | Hàng trăm - hàng nghìn |
| Dùng khi | Cần OS khác hẳn (chạy Windows trên Linux), cách ly tuyệt đối | Đóng gói và triển khai ứng dụng - **99% trường hợp của lập trình viên backend** |

> ⚠️ Container Linux cần **kernel Linux**. Trên Windows và macOS, Docker Desktop âm thầm chạy **một máy ảo Linux nhỏ** (WSL 2 trên Windows, máy ảo nhẹ trên macOS) rồi chạy container bên trong đó. Bạn không cần quan tâm, nhưng nên biết để hiểu tại sao Docker Desktop "ăn" RAM.

### 4 khái niệm cốt lõi

> 💡 **Ví von - Làm bánh**: **Dockerfile** là **công thức**. **Image** là **khuôn bánh** đúc theo công thức (chỉ đọc, dùng lại mãi). **Container** là **cái bánh** đúc ra từ khuôn - bạn có thể đúc 10 cái bánh từ một khuôn. **Registry** là **siêu thị** bán khuôn: bạn mua khuôn người khác làm sẵn (`postgres`, `golang`) hoặc đem khuôn của mình lên bán.

| Khái niệm | Là gì | Ví dụ |
|-----------|-------|-------|
| **Dockerfile** | File văn bản mô tả **cách tạo** image | `FROM golang:1.24-alpine` ... |
| **Image** | Gói **chỉ đọc** chứa mọi thứ để chạy app: file hệ thống, binary, cấu hình mặc định | `postgres:17-alpine`, `notes-api:1.0.0` |
| **Container** | Một **phiên bản đang chạy** của image, có lớp ghi riêng, tiến trình riêng | `docker run postgres:17-alpine` |
| **Layer** | Image được xếp từ nhiều **lớp** chồng lên nhau, mỗi lệnh `RUN`/`COPY` tạo một lớp. Lớp giống nhau được **dùng chung** và **cache** | Lớp `golang:1.24-alpine` dùng chung cho mọi project Go của bạn |
| **Registry** | Kho lưu trữ image | Docker Hub, GitHub Container Registry (`ghcr.io`), AWS ECR, Google Artifact Registry |

Tên image đầy đủ có dạng:

```text
ghcr.io/my-team/notes-api:1.2.0
└──┬──┘ └──┬──┘ └───┬───┘ └─┬─┘
registry  chủ sở hữu  tên    tag (phiên bản)

postgres:17-alpine  ←  viết tắt của  docker.io/library/postgres:17-alpine
```

Không ghi tag → Docker hiểu là `:latest`. **Đừng dựa vào `latest` ở production** - hôm nay `latest` là bản 17, tháng sau có thể là 18.

## 📖 2. Cài đặt Docker

### Windows 10/11

1. Bật **WSL 2**: mở PowerShell **quyền Administrator**, chạy `wsl --install`, khởi động lại máy
2. Tải **Docker Desktop** tại [docs.docker.com/desktop](https://docs.docker.com/desktop/) → chạy file cài → chọn **"Use WSL 2 instead of Hyper-V"**
3. Mở Docker Desktop, chờ biểu tượng cá voi ở khay hệ thống chuyển sang trạng thái **running**

> 💡 Nếu dùng WSL (Ubuntu), hãy để **code trong ổ Linux** (`~/projects/...`) thay vì `/mnt/c/...`: build nhanh hơn nhiều và hot reload hoạt động ổn định hơn.

### macOS

1. Tải Docker Desktop **đúng chip**: **Apple Silicon** (M1/M2/M3/M4) hoặc **Intel** - hoặc dùng Homebrew: `brew install --cask docker`
2. Kéo vào Applications, mở lên và cấp quyền khi được hỏi

### Linux (Ubuntu/Debian) - Docker Engine

Trên Linux, bạn cài thẳng **Docker Engine** (không cần Docker Desktop):

```bash
# Script cài đặt chính thức (thêm repo apt của Docker và cài docker-ce, buildx, compose plugin)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Cho phép user hiện tại dùng docker không cần sudo (đăng xuất rồi đăng nhập lại)
sudo usermod -aG docker $USER
```

> ⚠️ **Nhóm `docker` tương đương quyền root** trên máy đó (ai chạy được `docker run -v /:/host ...` là đọc/ghi được mọi file). Chỉ thêm user tin cậy vào nhóm này.

| | Docker Desktop | Docker Engine |
|---|---|---|
| Hệ điều hành | Windows, macOS, Linux | Linux |
| Có giao diện đồ họa | ✅ | ❌ (chỉ CLI) |
| Kèm sẵn | Engine, CLI, Compose, Buildx, Scout, Kubernetes | Engine, CLI (+ plugin compose, buildx nếu cài qua script trên) |
| Giấy phép | Miễn phí cho cá nhân, học tập, doanh nghiệp nhỏ (dưới 250 nhân viên **và** dưới 10 triệu USD doanh thu/năm) | Miễn phí, mã nguồn mở |

### Kiểm tra cài đặt

```bash
docker version
```

```text
Client: Docker Engine - Community
 Version:           29.3.1
 Go version:        go1.25.8
 ...
Server: Docker Engine - Community
 Engine:
  Version:          29.3.1
  Go version:       go1.25.8
  ...
```

Để ý dòng `Go version`: **Docker được viết bằng Go** 🐹. Có hai phần: **Client** (lệnh `docker` bạn gõ) và **Server** (Docker daemon - tiến trình nền làm việc thật). Nếu chỉ thấy phần Client kèm lỗi `Cannot connect to the Docker daemon` → daemon chưa chạy (mở Docker Desktop, hoặc `sudo systemctl start docker` trên Linux).

```bash
docker compose version    # Docker Compose version v5.1.1
docker buildx version     # github.com/docker/buildx v0.31.1 ...
docker run hello-world
```

```text
Hello from Docker!
This message shows that your installation appears to be working correctly.

To generate this message, Docker took the following steps:
 1. The Docker client contacted the Docker daemon.
 2. The Docker daemon pulled the "hello-world" image from the Docker Hub.
    (amd64)
...
```

> 💡 Compose hiện đại là **plugin** gõ `docker compose` (dấu cách). Lệnh cũ `docker-compose` (gạch nối, viết bằng Python) đã ngừng phát triển từ 2023 - gặp trong tài liệu cũ thì cứ thay bằng `docker compose`.

## 📖 3. Các lệnh Docker cơ bản ⭐

Cách học nhanh nhất là chạy một thứ **thật**: một PostgreSQL chỉ với một lệnh, không cần cài đặt gì.

### 3.1. `docker run` - Tạo và chạy container

```bash
docker run -d \
  --name pg \
  -e POSTGRES_PASSWORD=matkhau123 \
  -p 5432:5432 \
  -v pg-demo:/var/lib/postgresql/data \
  postgres:17-alpine
```

```text
40cb58843c669d73d128ff123298d7cd340b07da79b41b447e6ce529f6f142bc
```

Dòng dài kia là **ID container**. Chưa có image `postgres:17-alpine` thì Docker tự tải (pull) về trước.

| Cờ | Ý nghĩa | Ví dụ |
|----|---------|-------|
| `-d` | **Detached**: chạy nền, trả lại terminal ngay | `docker run -d nginx` |
| `--name` | Đặt tên dễ nhớ (không đặt thì Docker sinh tên ngẫu nhiên kiểu `quirky_heyrovsky`) | `--name pg` |
| `-p host:container` | **Publish** cổng: nối cổng máy thật với cổng trong container | `-p 8080:8080`, `-p 127.0.0.1:5432:5432` |
| `-e KEY=VALUE` | Đặt biến môi trường | `-e POSTGRES_PASSWORD=...` |
| `--env-file` | Đọc biến môi trường từ file | `--env-file .env` |
| `-v nguồn:đích` | Gắn **volume** hoặc thư mục máy thật vào container | `-v pg-demo:/var/lib/postgresql/data` |
| `--rm` | **Tự xóa** container khi nó dừng - hợp cho lệnh chạy một lần | `docker run --rm alpine:3.22 echo hi` |
| `-it` | `-i` giữ stdin + `-t` cấp terminal → dùng khi cần **tương tác** | `docker run -it --rm alpine:3.22 sh` |
| `--network` | Gắn vào network | `--network backend` |
| `--user` | Chạy bằng UID:GID khác | `--user 1000:1000` |

```bash
docker run -it --rm alpine:3.22 sh     # Vào shell của một Alpine Linux "sạch", gõ exit để thoát
docker run --rm alpine:3.22 cat /etc/os-release
```

```text
NAME="Alpine Linux"
ID=alpine
VERSION_ID=3.22.6
...
```

### 3.2. Xem, đọc log, "chui vào" container

```bash
docker ps                # Container ĐANG chạy
docker ps -a             # Tất cả, kể cả đã dừng
```

```text
CONTAINER ID   IMAGE                STATUS         PORTS                    NAMES
40cb58843c66   postgres:17-alpine   Up 4 seconds   0.0.0.0:5432->5432/tcp   pg
```

```bash
docker logs pg               # Toàn bộ log (stdout + stderr) của container
docker logs --tail 3 pg      # 3 dòng cuối
docker logs -f pg            # Theo dõi log liên tục (như tail -f), Ctrl+C để thoát
```

```text
2026-09-26 10:29:03.684 UTC [1] LOG:  listening on Unix socket "/var/run/postgresql/.s.PGSQL.5432"
2026-09-26 10:29:03.687 UTC [55] LOG:  database system was shut down at 2026-09-26 10:29:03 UTC
2026-09-26 10:29:03.692 UTC [1] LOG:  database system is ready to accept connections
```

```bash
docker exec pg psql -U postgres -c 'SELECT version();'   # Chạy một lệnh bên trong container
docker exec -it pg sh                                    # Mở shell tương tác bên trong
```

```text
                                         version
------------------------------------------------------------------------------------------
 PostgreSQL 17.11 on x86_64-pc-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit
(1 row)
```

> 💡 `docker run` = **tạo container mới** từ image. `docker exec` = **chạy thêm lệnh** trong container **đang chạy**. Người mới hay nhầm hai lệnh này.

### 3.3. Dừng, khởi động lại, xóa

```bash
docker stop pg        # Gửi SIGTERM, chờ tối đa 10 giây, rồi SIGKILL (mục 8 giải thích kỹ)
docker start pg       # Chạy lại container đã dừng (giữ nguyên cấu hình, dữ liệu trong container)
docker restart pg
docker rm pg          # Xóa container (phải dừng trước)
docker rm -f pg       # Dừng + xóa luôn
```

Xóa container đang chạy mà không có `-f`:

```text
Error response from daemon: cannot remove container "pg": container is running: stop the container before removing or force remove
```

### 3.4. Quản lý image

```bash
docker images                     # Liệt kê image (tương đương: docker image ls)
docker pull alpine:3.22           # Tải image về
docker rmi hello-api:naive        # Xóa image (tương đương: docker image rm)
docker image inspect alpine:3.22  # Xem metadata chi tiết (JSON)
docker history hello-api:1.1.0    # Xem các layer tạo nên image
```

```text
3.22: Pulling from library/alpine
Digest: sha256:5291449c3df73caf6ed85e649dec1b9e818b39a5d8c871e97afc13e9cd5e8fa8
Status: Image is up to date for alpine:3.22
docker.io/library/alpine:3.22
```

`docker images` trên Docker 29 (dùng containerd image store):

```text
IMAGE                                       ID             DISK USAGE   CONTENT SIZE   EXTRA
adminer:5                                   6c19fd07aaf2        164MB         43.8MB
alpine:3.22                                 5291449c3df7       12.8MB         3.88MB
gcr.io/distroless/static-debian12:nonroot   afa5c872c891       6.18MB          721kB
golang:1.24                                 d2d2bc1c84f7       1.32GB          335MB
golang:1.24-alpine                          8bee1901f1e5        395MB         83.5MB
postgres:17-alpine                          b0f9560a2de0        424MB          118MB
```

- **CONTENT SIZE**: dung lượng **nén** - đúng bằng lượng dữ liệu phải tải khi `pull`/`push`. Đây là con số bài này dùng để so sánh
- **DISK USAGE**: dung lượng thực chiếm trên ổ đĩa (bản nén + bản đã giải nén)
- Phiên bản Docker cũ hơn chỉ có một cột `SIZE` (dung lượng đã giải nén)

### 3.5. Soi chi tiết và dọn dẹp

```bash
docker inspect pg                                        # Mọi thông tin: IP, mount, env, trạng thái...
docker inspect -f '{{.State.Status}} {{.Config.User}}' web   # Lọc bằng Go template (quen không? 🐹)
docker stats --no-stream                                 # CPU/RAM từng container
docker system df                                         # Docker đang chiếm bao nhiêu ổ đĩa
```

```text
NAME      CPU %     MEM USAGE / LIMIT
web2      0.00%     2.227MiB / 15.72GiB
```

API Go của chúng ta lúc nghỉ chỉ dùng **2.2 MiB RAM**!

`docker system df` cho biết image, container, volume, build cache chiếm bao nhiêu và **thu hồi được** bao nhiêu (ví dụ `Images 16 ... 3.454GB  1.602GB (46%)`).

```bash
docker system prune
```

```text
WARNING! This will remove:
  - all stopped containers
  - all networks not used by at least one container
  - all dangling images
  - unused build cache

Are you sure you want to continue? [y/N]
```

> ⚠️ `docker system prune -a --volumes` xóa **mọi image không dùng** và **mọi volume không gắn với container** - tức là có thể xóa sạch database dev của bạn. Đọc kỹ cảnh báo trước khi gõ `y`.

### 💡 Tips quan trọng - Bảng lệnh hay dùng

| Việc cần làm | Lệnh |
|--------------|------|
| Chạy nền, mở cổng, đặt tên | `docker run -d -p 8080:8080 --name web image:tag` |
| Chạy thử rồi tự xóa | `docker run --rm image:tag` |
| Xem container | `docker ps` / `docker ps -a` |
| Xem log | `docker logs -f --tail 100 web` |
| Vào trong container | `docker exec -it web sh` |
| Dừng / xóa | `docker stop web` / `docker rm -f web` |
| Build image | `docker build -t image:tag .` |
| Đổi tên (tag) & đẩy lên registry | `docker tag image:tag user/image:tag` → `docker push user/image:tag` |
| Xem chi tiết | `docker inspect web` |
| Dọn dẹp | `docker system prune` |

## 📖 4. Dockerfile - "Công thức" tạo image

### 4.1. Ứng dụng mẫu: `hello-api`

Chúng ta dùng một API nhỏ, **chỉ dùng thư viện chuẩn**, nhưng có đủ những thứ cần để minh họa Docker: đọc biến môi trường, ghi file dữ liệu, log JSON bằng `slog`, graceful shutdown, endpoint `/healthz` và chế độ `-healthcheck`.

```bash
mkdir hello-api && cd hello-api
go mod init hello-api
```

📄 **`main.go`**

```go
package main

import (
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

// version được ghi đè lúc build: -ldflags "-X main.version=1.0.0"
var version = "dev"

func main() {
	// Chế độ "tự kiểm tra sức khỏe" cho HEALTHCHECK trong image không có curl/wget
	healthcheck := flag.Bool("healthcheck", false, "gọi /healthz rồi thoát (0 = khỏe, 1 = lỗi)")
	flag.Parse()

	addr := cmp.Or(os.Getenv("ADDR"), ":8080")
	if *healthcheck {
		os.Exit(runHealthcheck(addr))
	}

	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(logger, addr); err != nil {
		logger.Error("dừng vì lỗi", "err", err)
		os.Exit(1)
	}
}

func run(logger *slog.Logger, addr string) error {
	greeting := cmp.Or(os.Getenv("APP_GREETING"), "Xin chào từ Docker!")
	dataDir := os.Getenv("DATA_DIR") // Rỗng = không lưu lượt truy cập ra file
	hostname, _ := os.Hostname()     // Trong container, hostname = ID container (rút gọn)

	var mu sync.Mutex
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, "ok")
	})

	mux.HandleFunc("GET /{$}", func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]any{
			"message":  greeting,
			"hostname": hostname,
			"version":  version,
		}
		if dataDir != "" {
			mu.Lock()
			visits, err := incVisits(filepath.Join(dataDir, "visits.txt"))
			mu.Unlock()
			if err != nil {
				logger.Error("không ghi được file đếm", "err", err)
				http.Error(w, "lỗi lưu dữ liệu", http.StatusInternalServerError)
				return
			}
			resp["visits"] = visits
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	})

	mux.HandleFunc("GET /time", func(w http.ResponseWriter, r *http.Request) {
		loc, err := time.LoadLocation("Asia/Ho_Chi_Minh")
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		fmt.Fprintln(w, "Giờ Việt Nam:", time.Now().In(loc).Format("2006-01-02 15:04:05 MST"))
	})

	mux.HandleFunc("GET /slow", func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(3 * time.Second) // Giả lập request xử lý lâu
		fmt.Fprintln(w, "xong việc chậm")
	})

	srv := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	// SIGTERM là tín hiệu "docker stop" gửi cho tiến trình PID 1 trong container
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	serverErr := make(chan error, 1)
	go func() {
		logger.Info("server khởi động", "addr", addr, "version", version, "pid", os.Getpid())
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
		}
		close(serverErr)
	}()

	select {
	case err := <-serverErr:
		return err
	case <-ctx.Done():
		logger.Info("nhận tín hiệu dừng, bắt đầu graceful shutdown")
	}

	// Docker chờ 10 giây rồi mới SIGKILL → phải tắt xong trong thời gian đó
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("shutdown: %w", err)
	}
	logger.Info("đã dừng an toàn")
	return nil
}

// incVisits đọc số trong file, cộng 1, ghi lại và trả về giá trị mới.
func incVisits(path string) (int, error) {
	n := 0
	b, err := os.ReadFile(path)
	switch {
	case err == nil:
		n, _ = strconv.Atoi(strings.TrimSpace(string(b)))
	case !errors.Is(err, os.ErrNotExist):
		return 0, err
	}
	n++
	if err := os.WriteFile(path, []byte(strconv.Itoa(n)), 0o644); err != nil {
		return 0, err
	}
	return n, nil
}

// runHealthcheck gọi http://127.0.0.1<port>/healthz - dùng trong HEALTHCHECK của Dockerfile.
func runHealthcheck(addr string) int {
	_, port, _ := strings.Cut(addr, ":")
	client := http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get("http://127.0.0.1:" + port + "/healthz")
	if err != nil {
		fmt.Fprintln(os.Stderr, "healthcheck lỗi:", err)
		return 1
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		fmt.Fprintln(os.Stderr, "healthcheck status:", resp.StatusCode)
		return 1
	}
	return 0
}
```

### 4.2. Dockerfile đầu tiên (cách "ngây thơ")

📄 **`Dockerfile.naive`**

```dockerfile
# ❌ Cách "ngây thơ": build và chạy trong cùng image golang
FROM golang:1.24
WORKDIR /app
COPY . .
RUN go build -o hello-api .
EXPOSE 8080
CMD ["./hello-api"]
```

```bash
docker build -f Dockerfile.naive -t hello-api:naive .
```

```text
#5 [1/4] FROM docker.io/library/golang:1.24@sha256:d2d2bc1c84f7...
#6 [2/4] WORKDIR /app
#7 [3/4] COPY . .
#8 [4/4] RUN go build -o hello-api .
#8 DONE 11.2s
#9 exporting to image
#9 naming to docker.io/library/hello-api:naive done
```

Chạy được! Nhưng nhìn kích thước:

```text
IMAGE             ID             DISK USAGE   CONTENT SIZE
hello-api:naive   a5bfd002a3f1       1.44GB          350MB
```

**350 MB (nén) / 1.44 GB trên đĩa** cho một binary 6 MB 😱. Image chứa cả trình biên dịch Go, git, gcc, bộ nhớ đệm build (riêng layer `go build` đã nặng **104 MB**)... Mục 6 sẽ giảm con số này xuống **3.4 MB**. Nhưng trước hết, hãy hiểu từng lệnh.

### 4.3. Từng lệnh trong Dockerfile

| Lệnh | Ý nghĩa | Ví dụ |
|------|---------|-------|
| `FROM` | Image nền để bắt đầu. `AS tên` đặt tên cho **giai đoạn** (stage) | `FROM golang:1.24-alpine AS build` |
| `WORKDIR` | Thư mục làm việc (tự tạo nếu chưa có) cho các lệnh sau | `WORKDIR /src` |
| `COPY` | Copy file từ **build context** (thư mục bạn build) vào image | `COPY go.mod go.sum ./` |
| `COPY --from` | Copy từ một **stage khác** hoặc image khác | `COPY --from=build /out/app /app` |
| `RUN` | Chạy lệnh **lúc build**, kết quả thành một layer mới | `RUN go mod download` |
| `ENV` | Biến môi trường, tồn tại **cả lúc build và lúc chạy** | `ENV NOTES_ADDR=:8080` |
| `ARG` | Biến **chỉ lúc build**, truyền bằng `--build-arg` | `ARG VERSION=dev` |
| `EXPOSE` | **Ghi chú** cổng app lắng nghe (chỉ là tài liệu, **không** mở cổng!) | `EXPOSE 8080` |
| `USER` | Chạy các lệnh sau (và container) bằng user này | `USER nonroot:nonroot` |
| `ENTRYPOINT` | Chương trình **chính** của container | `ENTRYPOINT ["/hello-api"]` |
| `CMD` | Tham số **mặc định** (hoặc lệnh mặc định nếu không có ENTRYPOINT) | `CMD ["-port", "8080"]` |
| `HEALTHCHECK` | Lệnh Docker gọi định kỳ để biết container còn "khỏe" | xem 4.5 |
| `LABEL` | Metadata (tác giả, repo nguồn...) | `LABEL org.opencontainers.image.source=...` |
| `VOLUME` | Đánh dấu thư mục chứa dữ liệu cần lưu bền | `VOLUME ["/data"]` |

**Một số điểm hay nhầm**:

- **`COPY` vs `ADD`**: `ADD` còn tự giải nén `.tar` và tải được URL - "phép thuật" dễ gây bất ngờ. ✅ Luôn dùng `COPY`, trừ khi thật sự cần tính năng của `ADD`.
- **`ARG` vs `ENV`**: `ARG` biến mất sau khi build xong (container không thấy), `ENV` nằm lại trong image. Nhưng **cả hai đều hiện trong `docker history`** → ❌ **không bao giờ** truyền mật khẩu, token qua `ARG`/`ENV` (dùng `RUN --mount=type=secret`, xem mục 13.5).
- **`EXPOSE` không publish cổng**: muốn truy cập từ máy thật vẫn phải `-p 8080:8080`.
- **Mỗi `RUN` tạo một layer**: gộp các lệnh liên quan bằng `&&` để image gọn và cache hợp lý.

### 4.4. `ENTRYPOINT` vs `CMD` - và "exec form" vs "shell form"

```dockerfile
ENTRYPOINT ["/hello-api"]      # ✅ exec form (mảng JSON): chạy TRỰC TIẾP binary
ENTRYPOINT /hello-api          # ⚠️ shell form: chạy qua "/bin/sh -c /hello-api"
```

Luôn dùng **exec form** cho ứng dụng Go - lý do nằm ở mục 8 (tín hiệu và PID 1). Ngoài ra image `distroless`/`scratch` **không có** `/bin/sh` nên shell form không chạy được.

Khi có cả hai, Docker ghép `ENTRYPOINT + CMD`. Mọi thứ bạn viết **sau tên image** trong `docker run` sẽ **thay thế `CMD`** và được nối vào sau `ENTRYPOINT`:

| Dockerfile | Lệnh chạy | Tiến trình thực tế |
|------------|-----------|-------------------|
| `ENTRYPOINT ["/hello-api"]` | `docker run img` | `/hello-api` |
| `ENTRYPOINT ["/hello-api"]` | `docker run img -healthcheck` | `/hello-api -healthcheck` |
| `ENTRYPOINT ["/app"]` + `CMD ["-port","8080"]` | `docker run img` | `/app -port 8080` |
| `ENTRYPOINT ["/app"]` + `CMD ["-port","8080"]` | `docker run img -port 9000` | `/app -port 9000` |
| (bất kỳ) | `docker run --entrypoint sh img -c 'ls'` | `sh -c ls` (ghi đè cả ENTRYPOINT) |

Thử với `hello-api` (Dockerfile ở mục 6):

```bash
docker run --rm hello-api:1.1.0 -h
```

```text
Usage of /hello-api:
  -healthcheck
    	gọi /healthz rồi thoát (0 = khỏe, 1 = lỗi)
```

```bash
docker run --rm hello-api:1.1.0 -healthcheck; echo "exit=$?"
```

```text
healthcheck lỗi: Get "http://127.0.0.1:8080/healthz": dial tcp 127.0.0.1:8080: connect: connection refused
exit=1
```

(Lỗi là đúng: container mới này không có server nào chạy - ta chỉ muốn thấy `-healthcheck` được nối vào sau `ENTRYPOINT`.)

### 4.5. `HEALTHCHECK` - Container "khỏe" hay chỉ "đang chạy"?

Container có trạng thái `Up` chưa chắc app đã hoạt động (có thể bị treo, deadlock). `HEALTHCHECK` cho Docker một cách **hỏi thăm** định kỳ:

```dockerfile
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD ["/hello-api", "-healthcheck"]
```

| Tùy chọn | Mặc định | Ý nghĩa |
|----------|----------|---------|
| `--interval` | 30s | Bao lâu kiểm tra một lần |
| `--timeout` | 30s | Lệnh kiểm tra chạy quá thời gian này = thất bại |
| `--start-period` | 0s | Thời gian "ân hạn" lúc khởi động, thất bại không bị tính |
| `--retries` | 3 | Thất bại liên tiếp bao nhiêu lần thì là `unhealthy` |

Lệnh trả về **exit code 0** = khỏe, **1** = không khỏe. Image `distroless`/`scratch` **không có `curl`/`wget`**, nên mẹo phổ biến là cho **chính binary Go** một chế độ `-healthcheck` như trên - không cần cài thêm gì.

```text
CONTAINER ID   IMAGE             COMMAND        STATUS                           PORTS                    NAMES
0895f6ad78c8   hello-api:1.0.0   "/hello-api"   Up 1 second (health: starting)   0.0.0.0:8080->8080/tcp   web
...
NAMES     STATUS                    PORTS
web       Up 15 seconds (healthy)   0.0.0.0:8080->8080/tcp
```

> ⚠️ Docker (khi chạy đơn lẻ) chỉ **báo** `unhealthy`, **không tự restart** container. Trạng thái này được dùng bởi `depends_on: condition: service_healthy` trong Compose (mục 12), Docker Swarm, hoặc công cụ giám sát. Kubernetes **bỏ qua** `HEALTHCHECK` và dùng `livenessProbe`/`readinessProbe` riêng ([Bài 16](./16-production-ready.md), mục 8).

### 4.6. `.dockerignore` - Đừng gửi "rác" vào build

Khi chạy `docker build .`, toàn bộ thư mục `.` (**build context**) được gửi cho Docker daemon. `.dockerignore` loại bớt file - giống `.gitignore`:

📄 **`.dockerignore`**

```text
# Không gửi những thứ này vào build context
.git
.gitignore
.env
*.md
bin/
tmp/
data/
*.db
Dockerfile*
docker-compose*.yml
compose*.yaml
```

Ba lợi ích: **build nhanh hơn** (ít dữ liệu phải gửi), **cache ổn định hơn** (sửa README không làm build lại), và **an toàn hơn** (file `.env` chứa mật khẩu, database thật không lọt vào image qua `COPY . .`).

## 📖 5. Layer cache - Build nhanh gấp 10 lần

### 5.1. Cache hoạt động thế nào?

Mỗi lệnh trong Dockerfile tạo một **layer**. Khi build lại, Docker đi từ trên xuống và hỏi: *"Lệnh này và các file nó dùng có giống lần trước không?"*

- **Giống** → dùng lại layer cũ (dòng `CACHED` trong log), gần như tức thì
- **Khác** → chạy lại lệnh đó **và TẤT CẢ các lệnh phía sau** (cache bị "vỡ" từ đó trở xuống)

> 💡 **Ví von**: Như xếp chồng bánh crepe nhiều lớp. Muốn thay lớp thứ 3, bạn phải bỏ **mọi lớp phía trên** nó và làm lại. Vì vậy: lớp **ít thay đổi** đặt **dưới cùng**, lớp **hay thay đổi** đặt **trên cùng**.

Với Go: `go.mod`/`go.sum` thay đổi **hiếm khi** (chỉ khi thêm thư viện), còn code `.go` thay đổi **liên tục**.

```dockerfile
# ❌ SAI THỨ TỰ - Dockerfile.bad
FROM golang:1.24-alpine AS build
WORKDIR /src
# ❌ Copy toàn bộ code TRƯỚC → mỗi lần sửa 1 dòng code, bước tải module chạy lại từ đầu
COPY . .
RUN go mod download
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/notes-api .
```

```dockerfile
# ✅ ĐÚNG THỨ TỰ
FROM golang:1.24-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./          # 1. Chỉ file khai báo dependency
RUN go mod download             # 2. Tải module - được CACHE nếu go.mod/go.sum không đổi
COPY . .                        # 3. Code (hay đổi) để SAU CÙNG
RUN CGO_ENABLED=0 go build ...
```

### 5.2. Cache mount - Giữ bộ nhớ đệm của Go giữa các lần build

Dù thứ tự đúng, khi sửa code thì bước `go build` vẫn phải **biên dịch lại từ đầu** mọi package (kể cả thư viện như SQLite driver - rất nặng), vì bộ nhớ đệm build của Go (`GOCACHE`) không được giữ lại giữa các lần build.

BuildKit (engine build mặc định của Docker) có **cache mount**: một thư mục được **giữ lại giữa các lần build** nhưng **không nằm trong image**:

```dockerfile
# syntax=docker/dockerfile:1
...
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -o /out/notes-api .
```

- `/go/pkg/mod`: **module cache** (mã nguồn các thư viện đã tải) - `GOPATH` trong image `golang` là `/go`
- `/root/.cache/go-build`: **build cache** (kết quả biên dịch từng package) của user root

### 5.3. Đo thật: sửa một dòng code rồi build lại

Thử với Notes API (có thư viện `modernc.org/sqlite` - code ở Ứng dụng 1): thêm một dòng comment vào `main.go` rồi build lại.

**❌ Sai thứ tự, không cache mount** (`Dockerfile.bad`):

```text
#9 [build 3/5] COPY . .
#10 [build 4/5] RUN go mod download
#10 DONE 5.0s
#11 [build 5/5] RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/notes-api .
#11 DONE 20.5s
real	0m26.664s
```

**✅ Đúng thứ tự + cache mount** (Dockerfile ở Ứng dụng 1):

```text
#11 [build 3/6] COPY go.mod go.sum ./
#11 CACHED
#12 [build 4/6] RUN --mount=type=cache,target=/go/pkg/mod     go mod download
#12 CACHED
#13 [build 5/6] COPY . .
#14 [build 6/6] RUN --mount=type=cache,target=/go/pkg/mod     --mount=type=cache,target=/root/.cache/go-build     CGO_ENABLED=0 ...
#14 DONE 0.6s
real	0m2.639s
```

| | Tải module | Biên dịch | Tổng |
|---|---|---|---|
| ❌ Sai thứ tự, không cache mount | 5.0s (chạy lại) | 20.5s (từ đầu) | **26.7s** |
| ✅ Đúng thứ tự + cache mount | `CACHED` | 0.6s (chỉ biên dịch package `main`) | **2.6s** |

**Nhanh gấp 10 lần** - và bạn build hàng chục lần mỗi ngày!

> 💡 Cache mount nằm trên **máy build**. Trên GitHub Actions mỗi lần chạy là một máy mới, nên cache mount không được giữ; thay vào đó dùng `cache-from/cache-to: type=gha` để lưu **layer cache** (mục 13.4).

### 5.4. Xem các layer của image

```bash
docker history hello-api:1.1.0 --format 'table {{.CreatedBy}}\t{{.Size}}'
```

```text
CREATED BY                                      SIZE
ENTRYPOINT ["/hello-api"]                       0B
HEALTHCHECK {Test:[CMD /hello-api -healthche…   0B
EXPOSE [8080/tcp]                               0B
USER nonroot:nonroot                            0B
ENV DATA_DIR=/data                              0B
COPY --chown=65532:65532 /out/data /data # b…   8.19kB
COPY /out/hello-api /hello-api # buildkit       6.37MB
bazel build //common:cacerts_debian12_amd64_…   319kB
bazel build //common:os_release_debian12        16.4kB
...
```

Lệnh chỉ đổi metadata (`ENV`, `USER`, `EXPOSE`...) tạo layer **0B**. Layer thực sự có dữ liệu là binary (6.37 MB) và vài file của distroless (chứng chỉ CA, `/etc/passwd`...).

## 📖 6. Multi-stage build cho Go ⭐

### 6.1. Ý tưởng

Go biên dịch ra **một file binary duy nhất**. Để **chạy** nó, bạn không cần trình biên dịch, không cần mã nguồn. Multi-stage build tách hai việc:

- **Stage 1 (`build`)**: image `golang` đầy đủ → biên dịch
- **Stage 2 (runtime)**: image **siêu nhỏ** → chỉ `COPY --from=build` đúng cái binary

> 💡 **Ví von**: Xây nhà cần cần cẩu, giàn giáo, máy trộn bê tông. Khi bàn giao, chủ nhà chỉ nhận **căn nhà** - không ai giao kèm cần cẩu. (Bạn đã gặp ví von này ở Bài 16.)

### 6.2. `CGO_ENABLED=0` và binary tĩnh

Mặc định, khi chương trình Go dùng package `net` (mọi HTTP server!) và **máy build có trình biên dịch C**, Go bật **cgo** và link **động** với thư viện C của hệ điều hành (`libc`) để phân giải DNS:

```bash
go build -o h0 . && ldd h0
```

```text
	linux-vdso.so.1 (0x00007f2a22e7a000)
	libc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x00007f2a22c00000)
	/lib64/ld-linux-x86-64.so.2 (0x00007f2a22e7c000)
```

```bash
CGO_ENABLED=0 go build -o h1 . && ldd h1 && file h1
```

```text
	not a dynamic executable
h1: ELF 64-bit LSB executable, x86-64, version 1 (SYSV), statically linked, ... with debug_info, not stripped
```

Binary **tĩnh** (statically linked) chứa **mọi thứ** nó cần → chạy được trong image **trống rỗng**. Binary **động** mà copy vào `scratch`/`distroless/static` thì gặp lỗi khó hiểu nhất của Docker:

```dockerfile
FROM golang:1.24 AS build
WORKDIR /src
COPY . .
# ❌ Quên CGO_ENABLED=0 - image golang (Debian) có gcc nên cgo được BẬT mặc định
RUN go build -o /out/hello-api .
FROM scratch
COPY --from=build /out/hello-api /hello-api
ENTRYPOINT ["/hello-api"]
```

```bash
docker run --rm hello-api:cgo-bug
```

```text
exec /hello-api: no such file or directory
```

File **có** ở đó! Cái "không tìm thấy" là **trình nạp thư viện động** `/lib64/ld-linux-x86-64.so.2` - thứ mà `scratch` không có.

```bash
docker run --rm --entrypoint sh golang:1.24 -c 'go env CGO_ENABLED'   # 1  (Debian có gcc)
docker run --rm golang:1.24-alpine go env CGO_ENABLED                 # 0  (Alpine không có gcc)
```

✅ **Luôn ghi rõ `CGO_ENABLED=0`** trong Dockerfile, đừng phụ thuộc vào image build có gcc hay không.

> ⚠️ Nếu **thật sự cần cgo** (ví dụ thư viện `mattn/go-sqlite3`, `confluent-kafka-go`), bạn phải dùng image runtime có `libc` như `gcr.io/distroless/base-debian12` hoặc `debian:bookworm-slim`. Với SQLite, hãy ưu tiên driver thuần Go `modernc.org/sqlite` như Bài 13, 16.

### 6.3. `-ldflags`, `-trimpath` - Binary nhỏ hơn, có version

```bash
go build -trimpath -ldflags="-s -w -X main.version=1.0.0" -o hello-api .
```

| Cờ | Tác dụng |
|----|----------|
| `-s` | Bỏ bảng ký hiệu (symbol table) |
| `-w` | Bỏ thông tin debug DWARF |
| `-X main.version=1.0.0` | Gán giá trị cho biến **`string`** cấp package (không dùng được với `const`) |
| `-trimpath` | Xóa đường dẫn máy build (`/home/an/projects/...`) khỏi binary → build **tái lập được**, không lộ thông tin |

Kích thước binary `hello-api` (đo thật):

| Cách build | Kích thước |
|------------|-----------|
| `CGO_ENABLED=0 go build` | 9.36 MB |
| `+ -trimpath -ldflags="-s -w"` | **6.35 MB** (−32%) |
| `+ -tags timetzdata` (nhúng dữ liệu múi giờ, mục 7.2) | 6.76 MB |

> 💡 `-s -w` không làm chậm chương trình và stack trace khi panic **vẫn có** tên hàm, số dòng. Bạn chỉ mất khả năng debug bằng `dlv` trên binary đó - không ai debug trên production bằng cách này cả.

### 6.4. Dockerfile hoàn chỉnh cho `hello-api`

📄 **`Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1

# ============ Giai đoạn 1: build ============
FROM golang:1.24-alpine AS build
WORKDIR /src

# 1. Copy file khai báo dependency TRƯỚC → layer này được cache nếu go.mod không đổi
#    (project có thư viện ngoài thì dùng: COPY go.mod go.sum ./)
COPY go.mod ./
RUN go mod download

# 2. Sau đó mới copy code (thay đổi thường xuyên)
COPY . .

ARG VERSION=dev
# 3. Build binary tĩnh, bỏ thông tin debug, nhúng version
RUN --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build \
      -trimpath \
      -ldflags="-s -w -X main.version=${VERSION}" \
      -o /out/hello-api . \
 && mkdir -p /out/data

# ============ Giai đoạn 2: image chạy ============
FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=build /out/hello-api /hello-api
# Thư mục dữ liệu thuộc về user nonroot (UID 65532) → volume mới tạo sẽ "kế thừa" quyền này
COPY --from=build --chown=65532:65532 /out/data /data

ENV DATA_DIR=/data

USER nonroot:nonroot
EXPOSE 8080

# Image distroless không có curl/wget → dùng chính binary để tự kiểm tra
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD ["/hello-api", "-healthcheck"]

ENTRYPOINT ["/hello-api"]
```

> 💡 Dòng đầu `# syntax=docker/dockerfile:1` bảo BuildKit dùng phiên bản cú pháp Dockerfile mới nhất (cần cho `RUN --mount`). Dòng `mkdir -p /out/data` và `COPY --chown` sẽ được giải thích ở mục 10 (volume).

```bash
docker build --build-arg VERSION=1.1.0 -t hello-api:1.1.0 .
docker run -d --name web -p 8080:8080 -e APP_GREETING="Chào team Go" hello-api:1.1.0
curl localhost:8080/
```

```json
{"hostname":"d23ca20ced22","message":"Chào team Go","version":"1.1.0","visits":1}
```

```bash
docker logs web
```

```text
{"time":"2026-09-26T10:34:40.597682433Z","level":"INFO","msg":"server khởi động","addr":":8080","version":"1.1.0","pid":1}
```

Để ý: `hostname` chính là **ID container**, và `pid` là **1** - binary Go của bạn là tiến trình **đầu tiên** trong container (mục 8 sẽ giải thích vì sao điều này quan trọng).

## 📖 7. Chọn base image: `golang`, `alpine`, `distroless` hay `scratch`?

### 7.1. So sánh bằng số đo thật

Cùng một ứng dụng `hello-api`, 5 cách đóng gói (Dockerfile các biến thể nằm bên dưới):

| Image | Base image runtime | CONTENT SIZE (nén) | DISK USAGE | Có shell? | CA cert | Múi giờ | User non-root sẵn |
|-------|--------------------|-----------------|------------|-----------|---------|---------|------------------|
| `hello-api:naive` | `golang:1.24` | **350 MB** | 1.44 GB | ✅ | ✅ | ✅ | ❌ |
| `hello-api:alpine` | `alpine:3.22` | 6.51 MB | 21.9 MB | ✅ | ✅ | ❌ (cần `apk add tzdata`) | ❌ (tự tạo) |
| `hello-api:1.1.0` | `distroless/static-debian12:nonroot` | **3.44 MB** | 15.3 MB | ❌ | ✅ | ✅ | ✅ `nonroot` (65532) |
| `hello-api:scratch` | `scratch` + CA + tzdata nhúng | 2.94 MB | 9.96 MB | ❌ | ✅ (tự copy) | ✅ (nhúng) | ⚠️ UID số |
| `hello-api:scratch-bare` | `scratch` (chỉ binary) | 2.72 MB | 9.08 MB | ❌ | ❌ | ❌ | ❌ |

Kích thước các image nền (tham khảo): `golang:1.24` 335 MB, `golang:1.24-alpine` 83.5 MB, `alpine:3.22` 3.88 MB, `distroless/static-debian12` **721 kB** (nén).

Stage runtime của `Dockerfile.alpine` chỉ khác ở: `FROM alpine:3.22`, `RUN adduser -D -H -u 10001 app` (tự tạo user), `USER app` (cần múi giờ thì thêm `apk add --no-cache tzdata`).

📄 **`Dockerfile.scratch`**

```dockerfile
# syntax=docker/dockerfile:1
FROM golang:1.24-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
# -tags timetzdata: nhúng dữ liệu múi giờ (~400 KB) vào binary
# (tương đương thêm  import _ "time/tzdata"  trong main.go)
RUN CGO_ENABLED=0 go build -trimpath -tags timetzdata -ldflags="-s -w" -o /out/hello-api .

FROM scratch
# Chứng chỉ CA để gọi HTTPS ra ngoài (có sẵn trong golang:alpine)
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=build /out/hello-api /hello-api
# scratch không có /etc/passwd → dùng UID:GID dạng số
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["/hello-api"]
```

### 7.2. Ba "cái bẫy" của `scratch`

`scratch` là image **rỗng tuyệt đối**. Nhỏ nhất, nhưng bạn phải tự lo mọi thứ.

**Bẫy 1 - Thiếu múi giờ**: `/time` trên ba image:

```bash
curl localhost:8081/time   # scratch-bare
curl localhost:8082/time   # scratch (có -tags timetzdata)
curl localhost:8083/time   # distroless
```

```text
unknown time zone Asia/Ho_Chi_Minh
Giờ Việt Nam: 2026-09-26 17:11:39 +07
Giờ Việt Nam: 2026-09-26 17:11:39 +07
```

✅ Cách sửa (chọn một):
- Thêm `import _ "time/tzdata"` vào `main.go` (nhúng ~400 KB dữ liệu múi giờ vào binary - đo được: 6.35 MB → 6.76 MB)
- Hoặc build với `-tags timetzdata` (tác dụng y hệt, không cần sửa code)
- Hoặc copy `/usr/share/zoneinfo` từ một image có gói `tzdata`
- Hoặc dùng `distroless` (có sẵn tzdata)

**Bẫy 2 - Thiếu chứng chỉ CA**: chương trình nhỏ gọi HTTPS ra ngoài:

```go
resp, err := http.Get("https://api.github.com")
```

```text
❌ lỗi: Get "https://api.github.com": tls: failed to verify certificate: x509: certificate signed by unknown authority
```

Go không tìm thấy file chứng chỉ gốc (`/etc/ssl/certs/ca-certificates.crt`) để xác thực HTTPS. Có file đó (copy từ stage build như `Dockerfile.scratch`, hoặc dùng `distroless`) là chạy:

```text
✅ status: 200 OK
```

**Bẫy 3 - Không có gì để debug**: không shell, không `ls`, không `/etc/passwd` (nên `USER nonroot` không dùng được, phải ghi UID số). Mục 14 có cách debug container kiểu này.

### 7.3. Nên chọn gì?

| Tình huống | Lựa chọn |
|------------|----------|
| **Mặc định cho API Go** | ✅ `gcr.io/distroless/static-debian12:nonroot` - nhỏ, có CA + tzdata + user nonroot, không shell (ít bề mặt tấn công) |
| Muốn nhỏ tuyệt đối, hiểu rõ mình đang làm gì | `scratch` + copy CA + nhúng tzdata + `USER` số |
| Cần shell để debug, cần cài thêm gói (`apk add`) | `alpine` |
| Cần cgo (thư viện C) | `gcr.io/distroless/base-debian12` hoặc `debian:bookworm-slim` |
| Chạy `go test`, công cụ dev | `golang:1.24-alpine` / `golang:1.24` (chỉ ở stage build hoặc image dev) |

## 📖 8. Chạy an toàn: non-root, tín hiệu, PID 1

### 8.1. Đừng chạy bằng root

Mặc định, tiến trình trong container chạy bằng **root** (UID 0). Nếu kẻ tấn công khai thác được lỗ hổng trong app, chúng có quyền root **trong container** - và nếu có thêm lỗ hổng của runtime/kernel, có thể leo thang ra máy chủ.

```dockerfile
USER nonroot:nonroot     # distroless: user có sẵn, UID/GID 65532
USER app                 # alpine: sau khi "adduser -D -H -u 10001 app"
USER 10001:10001         # scratch: không có /etc/passwd → chỉ dùng được số
```

Kiểm tra:

```bash
docker inspect -f '{{.Config.User}}' web
# nonroot:nonroot

docker exec web2 sh -c 'whoami; ps'      # web2 chạy image alpine (có shell)
```

```text
app
PID   USER     TIME  COMMAND
    1 app       0:00 hello-api
   14 app       0:00 sh -c whoami; ps
   21 app       0:00 ps
```

> 💡 Ứng dụng Go lắng nghe cổng `8080` (> 1024) nên **không cần root**. Đừng cho app nghe cổng 80 trong container - cứ nghe 8080 rồi `-p 80:8080` ở ngoài.

### 8.2. `docker stop` làm gì? Graceful shutdown trong container

```text
docker stop web
   │
   ├─► Gửi SIGTERM cho PID 1 trong container
   │        (app nên: ngừng nhận request mới, xử lý nốt request đang chạy, đóng DB, thoát)
   │
   ├─► Chờ tối đa 10 giây  (đổi bằng: docker stop -t 30 / stop_grace_period trong Compose)
   │
   └─► Vẫn chưa thoát? → SIGKILL (giết ngay, không dọn dẹp gì, exit code 137)
```

`hello-api` đã bắt `SIGTERM` bằng `signal.NotifyContext` và gọi `srv.Shutdown` (đã học ở [Bài 16](./16-production-ready.md), mục 7). Thử gọi `/slow` (mất 3 giây) rồi `docker stop` ngay khi request đang chạy:

```bash
(curl -s localhost:8080/slow; echo "curl exit=$?") &
sleep 0.5
time docker stop web
docker logs web
```

```text
xong việc chậm
curl exit=0
web

real	0m2.848s
```

```text
{"time":"2026-09-26T10:34:40.597682433Z","level":"INFO","msg":"server khởi động","addr":":8080","version":"1.1.0","pid":1}
{"time":"2026-09-26T10:34:52.17190099Z","level":"INFO","msg":"nhận tín hiệu dừng, bắt đầu graceful shutdown"}
{"time":"2026-09-26T10:34:54.808295485Z","level":"INFO","msg":"đã dừng an toàn"}
```

Request đang chạy **được làm xong** (client nhận đủ "xong việc chậm"), rồi server mới thoát với `Exited (0)`. `docker stop` chỉ mất 2.8 giây - đúng bằng thời gian còn lại của request.

> ⚠️ Timeout của `Shutdown` phải **nhỏ hơn** thời gian chờ của Docker (10s mặc định) - trong code là 8 giây. Nếu không, Docker sẽ SIGKILL giữa chừng.

### 8.3. Vấn đề PID 1

Tiến trình **PID 1** trong container nhận tín hiệu từ `docker stop`. Nếu PID 1 **không phải** app của bạn, tín hiệu có thể **không bao giờ đến** app.

**Thử nghiệm 1** - Shell form, và shell phải làm thêm việc sau app (giống một script khởi động viết thiếu `exec`):

```bash
docker run -d --name t3 --entrypoint sh hello-api:alpine -c 'hello-api; echo "app đã thoát"'
docker top t3
time docker stop t3
```

```text
PID                 COMMAND             COMMAND
21494               sh                  sh -c hello-api; echo "app đã thoát"
21509               hello-api           hello-api

t3

real	0m10.155s
```

```text
t3 Exited (137) Less than a second ago
```

`sh` là PID 1, nhận SIGTERM nhưng **không chuyển tiếp** cho `hello-api` → Docker chờ đủ **10 giây** rồi SIGKILL → exit code **137** (= 128 + 9, bị SIGKILL). Log **không có** dòng "graceful shutdown" - mọi request đang chạy bị cắt ngang, dữ liệu có thể hỏng.

**Thử nghiệm 2** - Server Go **không** bắt tín hiệu (không có `signal.NotifyContext`):

```text
real	0m0.142s
ns Exited (2) Less than a second ago
```

Khác với nhiều ngôn ngữ, runtime Go luôn cài bộ xử lý tín hiệu nên chương trình **vẫn thoát ngay** - nhưng là **chết đột ngột** (exit code 2), không graceful: request đang chạy bị cắt, DB không được đóng.

✅ **Quy tắc**:
1. Luôn dùng **exec form**: `ENTRYPOINT ["/app"]`
2. Nếu phải dùng script khởi động (`entrypoint.sh`), dòng cuối phải là `exec /app "$@"` - `exec` **thay thế** shell bằng app, app trở thành PID 1
3. App Go **luôn** bắt `SIGTERM` và shutdown có kiểm soát
4. Nếu app sinh tiến trình con (hiếm với Go), dùng `docker run --init` (hoặc `init: true` trong Compose) để có một "init" nhỏ (`tini`) làm PID 1, chuyển tiếp tín hiệu và dọn tiến trình "zombie"

## 📖 9. Cấu hình qua biến môi trường

Theo nguyên tắc **12-factor** ([Bài 16](./16-production-ready.md), mục 3): **cùng một image** chạy ở mọi môi trường, chỉ **biến môi trường** là khác.

```bash
# Truyền từng biến
docker run -d -p 8080:8080 -e APP_GREETING="Chào team Go" -e ADDR=:8080 hello-api:1.1.0

# Truyền từ file (mỗi dòng KEY=VALUE)
docker run -d -p 8080:8080 --env-file .env hello-api:1.1.0

# Lấy giá trị từ biến của shell hiện tại (không ghi giá trị vào lệnh → không lưu trong history của shell)
export APP_GREETING="Xin chào"
docker run -d -p 8080:8080 -e APP_GREETING hello-api:1.1.0
```

`ENV` trong Dockerfile là **giá trị mặc định**, `-e` khi chạy sẽ **ghi đè**:

```bash
docker inspect -f '{{json .Config.Env}}' hello-api:1.1.0
```

```text
["PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin","SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt","DATA_DIR=/data"]
```

> ⚠️ **Biến môi trường không phải chỗ giấu bí mật tuyệt đối**: ai có quyền `docker inspect` đều đọc được. Với production, dùng cơ chế secret của nền tảng (Kubernetes Secret, AWS Secrets Manager, Docker secrets) - app có thể đọc secret từ **file** (ví dụ `/run/secrets/db_password`) thay vì biến môi trường. Và tuyệt đối **không** `COPY .env` vào image.

## 📖 10. Volume - Lưu dữ liệu bền vững

### 10.1. Container là "phòng khách sạn"

Mỗi container có một **lớp ghi** riêng. Xóa container (`docker rm`) là **mất sạch** mọi file nó đã ghi - kể cả file SQLite!

> 💡 **Ví von**: Container như **phòng khách sạn**: trả phòng là dọn sạch. **Volume** như **két gửi đồ** ở lễ tân: bạn trả phòng, đổi phòng, két vẫn còn nguyên.

| Loại | Cú pháp | Dữ liệu nằm ở | Dùng khi |
|------|---------|---------------|----------|
| **Named volume** | `-v web-data:/data` | Do Docker quản lý (`/var/lib/docker/volumes/...`) | ✅ **Dữ liệu ứng dụng**: database, file upload - production & dev |
| **Bind mount** | `-v "$(pwd)/data:/data"` | Một thư mục **bạn chọn** trên máy thật | Dev: chia sẻ **mã nguồn** (hot reload), file cấu hình |
| **tmpfs** | `--tmpfs /tmp` | RAM, mất khi dừng | File tạm, dữ liệu nhạy cảm không muốn ghi xuống đĩa |

### 10.2. Named volume: dữ liệu sống sót qua `docker rm`

```bash
docker volume create web-data
docker run -d --name web -p 8080:8080 -v web-data:/data hello-api:1.1.0
curl localhost:8080/
curl localhost:8080/
docker rm -f web                                            # Xóa hẳn container!
docker run -d --name web -p 8080:8080 -v web-data:/data hello-api:1.1.0
curl localhost:8080/
```

```text
{"hostname":"af813a35077c","message":"Xin chào từ Docker!","version":"1.1.0","visits":1}
{"hostname":"af813a35077c","message":"Xin chào từ Docker!","version":"1.1.0","visits":2}
web
{"hostname":"df021ca02765","message":"Xin chào từ Docker!","version":"1.1.0","visits":3}
```

Container mới (hostname khác) nhưng `visits` tiếp tục từ **3** - dữ liệu nằm trong volume.

`docker volume ls` liệt kê volume; `docker volume inspect web-data` cho biết dữ liệu thật nằm ở `"Mountpoint": "/var/lib/docker/volumes/web-data/_data"` (bên trong máy ảo Linux nếu dùng Docker Desktop).

**Sao lưu một volume** (mẹo hay dùng - mượn một container Alpine làm "người khuân vác"):

```bash
docker run --rm -v web-data:/data:ro -v "$(pwd)":/backup alpine:3.22 \
  tar czf /backup/web-data.tar.gz -C /data .
tar tzf web-data.tar.gz
# ./
# ./visits.txt
```

> 💡 Bookmark API ở [Bài 16](./16-production-ready.md) cũng dùng đúng cách này: `-v bookmark-data:/data` để file SQLite `/data/bookmarks.db` không mất khi cập nhật phiên bản mới.

### 10.3. Lỗi kinh điển: `permission denied` với volume

Phiên bản **đầu tiên** của Dockerfile `hello-api` (1.0.0) **không** tạo sẵn thư mục `/data`. Chạy với volume:

```bash
docker run -d --name web -p 8080:8080 -e DATA_DIR=/data -v web-data:/data hello-api:1.0.0
curl -i localhost:8080/
docker logs web
```

```text
HTTP/1.1 500 Internal Server Error
lỗi lưu dữ liệu
{"time":"2026-09-26T10:12:25.269532458Z","level":"ERROR","msg":"không ghi được file đếm","err":"open /data/visits.txt: permission denied"}
```

```bash
docker run --rm -v web-data:/data alpine:3.22 ls -ld /data
# drwxr-xr-x    2 root     root          4096 Sep 26 10:12 /data
```

**Nguyên nhân**: image không có `/data` → Docker tạo thư mục mount thuộc về **root**, còn app chạy bằng `nonroot` (65532) → không ghi được.

✅ **Cách sửa với named volume**: tạo sẵn thư mục **trong image** với đúng chủ sở hữu. Khi một named volume **rỗng** được gắn vào, Docker **copy nội dung và quyền** của thư mục đó từ image sang volume:

```dockerfile
RUN ... go build ... && mkdir -p /out/data             # stage build
COPY --from=build --chown=65532:65532 /out/data /data  # stage runtime
```

(`distroless` không có shell nên không `RUN mkdir` được ở stage cuối - ta tạo ở stage build rồi copy sang.)

**Với bind mount**, thư mục thuộc về user trên **máy thật**, Docker không đổi quyền:

```bash
mkdir data
docker run -d --name web -p 8080:8080 -v "$(pwd)/data:/data" hello-api:1.1.0
curl localhost:8080/        # lỗi lưu dữ liệu  (open /data/visits.txt: permission denied)
```

Hai cách sửa:

```bash
# Cách 1: chạy container bằng UID/GID của chính bạn (thường là 1000:1000 trên Linux)
docker run -d --name web -p 8080:8080 --user "$(id -u):$(id -g)" -v "$(pwd)/data:/data" hello-api:1.1.0

# Cách 2: cho user trong container (65532) sở hữu thư mục trên máy thật
sudo chown 65532:65532 data
```

```text
{"hostname":"0d6c9be42e8f","message":"Xin chào từ Docker!","version":"1.1.0","visits":1}
$ ls -ln data
-rw-r--r-- 1 65532 65532 1 Sep 26 10:12 visits.txt
```

> 💡 Trên **Docker Desktop** (Windows/macOS), bind mount đi qua một lớp chia sẻ file nên vấn đề quyền hầu như không xảy ra - nhưng khi đem lên server Linux thì gặp. Hãy hiểu cơ chế để không bất ngờ.

## 📖 11. Network - Container nói chuyện với nhau

### 11.1. `-p` hoạt động thế nào

```text
Máy thật (host)                            Container
localhost:8080  ──── -p 8080:8080 ────►  0.0.0.0:8080 (app Go lắng nghe)
```

- `-p 8080:8080` = mở cổng 8080 trên **mọi** địa chỉ của máy thật (`0.0.0.0`) - máy khác trong mạng LAN cũng truy cập được
- `-p 127.0.0.1:9090:8080` = chỉ **máy này** truy cập được, qua cổng 9090

```bash
docker run -d --name web -p 127.0.0.1:9090:8080 hello-api:1.1.0
docker port web
# 8080/tcp -> 127.0.0.1:9090
```

### 11.2. User-defined network và DNS theo tên

Container trong cùng một **user-defined network** gọi nhau bằng **tên container** - Docker có sẵn DNS nội bộ.

```bash
docker network create demo-net
docker run -d --name web --network demo-net hello-api:1.1.0      # Không cần -p!
docker run --rm --network demo-net alpine:3.22 wget -qO- http://web:8080/
```

```text
{"hostname":"1946dd9031f3","message":"Xin chào từ Docker!","version":"1.1.0","visits":1}
```

`docker run --rm --network demo-net alpine:3.22 nslookup web` trả về `Address: 172.18.0.2` - IP của container `web` trong network.

Còn trên network **mặc định** (`bridge` - khi không ghi `--network`), **không có** DNS theo tên: `wget http://web:8080/` từ container khác sẽ thất bại vì không phân giải được tên `web`. ✅ Luôn tạo network riêng (Compose tự làm việc này cho bạn).

| Network driver | Đặc điểm | Dùng khi |
|----------------|----------|----------|
| `bridge` (mặc định) | Mạng riêng trên một máy, **không** DNS theo tên | Chạy nhanh một container |
| `bridge` tự tạo | Mạng riêng, **có** DNS theo tên container/service | ✅ Hầu hết trường hợp |
| `host` | Container dùng thẳng mạng của máy thật (không cần `-p`) | Hiệu năng mạng tối đa (chỉ chạy tốt trên Linux) |
| `none` | Không có mạng | Job xử lý dữ liệu cần cách ly tuyệt đối |

> 💡 Container muốn gọi một dịch vụ chạy **trên máy thật** (ví dụ Postgres cài ngoài Docker)? Dùng hostname `host.docker.internal` (có sẵn trên Docker Desktop; trên Linux thêm `--add-host=host.docker.internal:host-gateway`). **Không** dùng `localhost` - bên trong container, `localhost` là **chính container đó**.

### 11.3. Bẫy `127.0.0.1` bên trong container

```bash
docker run -d --name web -p 8080:8080 -e ADDR=127.0.0.1:8080 hello-api:1.1.0
curl localhost:8080/healthz
```

```text
curl: (56) Recv failure: Connection reset by peer
```

Log vẫn báo "server khởi động" bình thường! Vấn đề: app chỉ lắng nghe `127.0.0.1` **của container**. Traffic từ `-p` đi vào qua card mạng ảo của container (ví dụ `172.17.0.2`), không phải loopback → bị từ chối.

✅ Trong container, app **luôn** lắng nghe `0.0.0.0` (trong Go: `":8080"`). Muốn giới hạn truy cập thì giới hạn ở **`-p 127.0.0.1:8080:8080`** bên ngoài.

## 📖 12. Docker Compose - Cả stack trong một file ⭐

### 12.1. Tại sao cần Compose?

Một ứng dụng thật có API + database + công cụ quản trị. Chạy bằng `docker run` thì phải nhớ: tạo network, tạo volume, đúng thứ tự khởi động, hàng chục cờ `-e`, `-p`, `-v`... Compose gom tất cả vào **một file YAML**, khởi động bằng **một lệnh**, và file đó được **commit vào Git** - ai clone repo về cũng chạy được y hệt.

> 💡 **Ví von**: `docker run` là **gọi từng món lẻ**. Compose là **thực đơn combo** in sẵn: gọi một lần, bếp tự biết làm món nào trước, dọn ra bàn nào.

### 12.2. Giải phẫu `compose.yaml`: Go API + PostgreSQL + Adminer

Đây là stack của **Ứng dụng 2** (mã nguồn Go đầy đủ ở phần 🌍). Hãy đọc kỹ từng dòng comment:

📄 **`compose.yaml`**

```yaml
# Tên project (mặc định = tên thư mục) → tiền tố cho container, volume, network
name: notes

services:
  # ---------- Go API ----------
  api:
    build:
      context: .
      args:
        VERSION: ${VERSION:-dev}
    image: notes-api-pg:${VERSION:-dev}
    ports:
      - "${API_PORT:-8080}:8080"          # host:container
    environment:
      NOTES_LOG_LEVEL: ${LOG_LEVEL:-info}
      # "db" là TÊN SERVICE → Docker DNS tự phân giải ra IP container postgres
      NOTES_DB_DSN: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}?sslmode=disable
    depends_on:
      db:
        condition: service_healthy        # Chờ Postgres THẬT SỰ sẵn sàng, không chỉ "đã start"
    restart: unless-stopped
    networks: [backend]
    # Dùng với "docker compose watch": sửa code → tự build lại image & chạy lại container
    develop:
      watch:
        - action: rebuild
          path: .
          ignore:
            - .env
            - compose.yaml
            - Makefile
            - "*.md"

  # ---------- PostgreSQL ----------
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pgdata:/var/lib/postgresql/data   # Dữ liệu sống sót qua "down" / "up"
    healthcheck:
      # $$ = ký tự $ thật, để biến được shell TRONG container đọc (không phải Compose)
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s
    restart: unless-stopped
    networks: [backend]
    # Không mở cổng 5432 ra host - chỉ API (cùng network) mới cần kết nối

  # ---------- Adminer: giao diện web xem database (chỉ bật khi cần) ----------
  adminer:
    image: adminer:5
    profiles: [tools]                     # Chỉ chạy khi: --profile tools
    # Mặc định Adminer nghe trên [::] (IPv6); máy/WSL tắt IPv6 sẽ lỗi → nghe IPv4
    command: ["php", "-S", "0.0.0.0:8080", "-t", "/var/www/html"]
    ports:
      - "8081:8080"
    environment:
      ADMINER_DEFAULT_SERVER: db
    depends_on: [db]
    networks: [backend]

volumes:
  pgdata:

networks:
  backend:
```

📄 **`.env`** (Compose **tự động đọc** file này để thay các `${BIẾN}`)

```text
# File .env: Compose tự đọc để thay ${BIẾN} trong compose.yaml
# ⚠️ KHÔNG commit file này nếu chứa mật khẩu thật - commit .env.example thay thế
POSTGRES_USER=notes
POSTGRES_PASSWORD=notes-secret-123
POSTGRES_DB=notes
API_PORT=8080
LOG_LEVEL=info
VERSION=1.0.0
```

**Giải thích các khối quan trọng**:

| Khối | Ý nghĩa |
|------|---------|
| `services` | Mỗi service = một (hoặc nhiều bản sao) container. **Tên service** cũng là **hostname** trong network |
| `build` + `image` | Build từ Dockerfile trong `context`, đặt tên image là giá trị `image` |
| `ports` | Như `-p` |
| `environment` | Như `-e`. `${VAR:-mặc_định}` lấy từ `.env`/shell, không có thì dùng mặc định. `${VAR:?thông báo}` bắt buộc phải có |
| `depends_on` | Thứ tự khởi động. `condition: service_healthy` chờ **healthcheck** của `db` báo khỏe. Các giá trị khác: `service_started` (mặc định), `service_completed_successfully` (chờ một job như migration chạy xong) |
| `healthcheck` | Như `HEALTHCHECK` trong Dockerfile. `pg_isready` là công cụ có sẵn trong image postgres |
| `restart` | `no` (mặc định), `always`, `on-failure`, `unless-stopped` (tự khởi động lại khi crash hoặc khi máy khởi động lại, trừ khi bạn chủ động stop) |
| `volumes` (cấp service) | Như `-v`. Tên không có `/` hoặc `.` → named volume, khai báo ở `volumes:` cấp gốc |
| `networks` | Compose tạo network `notes_backend`, mọi service trong đó gọi nhau bằng tên |
| `profiles` | Service chỉ chạy khi bật profile tương ứng - hợp cho công cụ phụ (Adminer, công cụ migrate, mock server...) |
| `develop.watch` | Cấu hình hot reload cho `docker compose watch` (mục 12.5) |

> ⚠️ **Dòng `version: "3.8"` ở đầu file đã lỗi thời** - Compose hiện đại bỏ qua và in cảnh báo `the attribute version is obsolete`. Không cần viết nữa.

> ⚠️ **PostgreSQL 18 trở lên** đổi vị trí dữ liệu: hãy mount volume vào `/var/lib/postgresql` (không phải `.../data`). Bài này dùng `postgres:17-alpine` nên giữ đường dẫn cũ. Luôn ghi **phiên bản chính** (`17-alpine`), đừng dùng `postgres:latest` - lên phiên bản chính mới cần **migrate dữ liệu**, không phải cứ đổi image là xong.

### 12.3. Các lệnh Compose hằng ngày

```bash
docker compose up -d --build
```

```text
 Image notes-api-pg:1.0.0 Building
 Image notes-api-pg:1.0.0 Built
 Network notes_backend Creating
 Network notes_backend Created
 Volume notes_pgdata Creating
 Volume notes_pgdata Created
 Container notes-db-1 Creating
 Container notes-db-1 Created
 Container notes-api-1 Creating
 Container notes-api-1 Created
 Container notes-db-1 Starting
 Container notes-db-1 Started
 Container notes-db-1 Waiting
 Container notes-db-1 Healthy
 Container notes-api-1 Starting
 Container notes-api-1 Started
```

Để ý thứ tự: `db` **Started** → **Waiting** → **Healthy** → rồi mới đến lượt `api`. Đó là tác dụng của `condition: service_healthy`.

```bash
docker compose ps
```

```text
NAME          IMAGE                COMMAND                  SERVICE   CREATED          STATUS                            PORTS
notes-api-1   notes-api-pg:1.0.0   "/notes-api"             api       10 seconds ago   Up 4 seconds (health: starting)   0.0.0.0:8080->8080/tcp
notes-db-1    postgres:17-alpine   "docker-entrypoint.s…"   db        11 seconds ago   Up 10 seconds (healthy)           5432/tcp
```

| Lệnh | Tác dụng |
|------|----------|
| `docker compose up -d` | Tạo & chạy mọi service ở chế độ nền |
| `docker compose up -d --build` | Build lại image trước khi chạy (sau khi sửa code) |
| `docker compose ps` | Trạng thái các service |
| `docker compose logs -f api` | Theo dõi log của service `api` |
| `docker compose exec db psql -U notes` | Chạy lệnh trong service đang chạy |
| `docker compose stop` / `start` | Dừng / chạy lại (giữ container) |
| `docker compose down` | Dừng **và xóa** container + network. **Giữ** volume |
| `docker compose down -v` | ⚠️ Xóa **cả volume** → mất sạch dữ liệu database |
| `docker compose --profile tools up -d` | Chạy thêm các service thuộc profile `tools` |
| `docker compose config` | In file cấu hình **sau khi** đã thay biến - rất hữu ích để debug `.env` |
| `docker compose watch` | Hot reload theo cấu hình `develop.watch` |

### 12.4. `depends_on` không thay thế được "retry" trong code

`depends_on` chỉ có tác dụng **lúc khởi động bằng Compose**. Database vẫn có thể khởi động lại, bị bảo trì, hoặc bạn deploy lên Kubernetes (không có `depends_on`). Vì vậy code Go ở Ứng dụng 2 **vẫn thử kết nối lại** với backoff. Chạy API khi database **chưa bật** (rút gọn trường `time`, `service`, `version`):

```text
{"level":"WARN","msg":"database chưa sẵn sàng, thử lại","attempt":1,"retry_in":"500ms","err":"failed to connect to `user=notes database=notes`: hostname resolving error: lookup db on 127.0.0.11:53: no such host"}
{"level":"WARN","msg":"database chưa sẵn sàng, thử lại","attempt":2,"retry_in":"1s",...}
{"level":"WARN","msg":"database chưa sẵn sàng, thử lại","attempt":3,"retry_in":"2s",...}
{"level":"WARN","msg":"database chưa sẵn sàng, thử lại","attempt":4,"retry_in":"4s",...}
{"level":"INFO","msg":"đã kết nối database","attempt":5}
{"level":"INFO","msg":"migration hoàn tất","applied":0,"total":2}
{"level":"INFO","msg":"server khởi động","addr":":8080"}
```

(`127.0.0.11` là địa chỉ **DNS nội bộ của Docker** trong mọi user-defined network.)

### 12.5. Hot reload khi phát triển - giới thiệu

Sửa code Go → phải build lại binary → khởi động lại. Có hai cách tự động hóa:

| Cách | Hoạt động | Ưu điểm | Nhược điểm |
|------|-----------|---------|------------|
| **`docker compose watch`** (`action: rebuild`) | Theo dõi file, thấy thay đổi → **build lại image** → thay container | Chạy đúng image production, không cần công cụ thêm | Mỗi lần sửa build lại image (vài giây nhờ cache mount) |
| **air** trong container dev | Bind mount code vào container có Go toolchain, [air](https://github.com/air-verse/air) tự `go build` + chạy lại | Nhanh (~2 giây), log liền mạch | Cần `Dockerfile.dev` riêng, image dev nặng (182 MB nén) |

Cả hai được thiết lập đầy đủ trong **Ứng dụng 3**.

## 📖 13. Build đa nền tảng & đưa image lên registry

### 13.1. Tại sao cần nhiều kiến trúc CPU?

- Laptop **Mac M-series** là **arm64**; server thường là **amd64** (x86_64)
- Cloud có server **arm64** rẻ hơn 20-40% (AWS Graviton, Google Axion, Azure Cobalt), Raspberry Pi cũng arm64
- Image build trên Mac M1 mang lên server amd64 → lỗi:

```bash
docker run --rm --platform linux/arm64 notes-api:1.0.0-multi -healthcheck
```

```text
exec /notes-api: exec format error
```

`exec format error` = binary **sai kiến trúc CPU** với máy đang chạy.

### 13.2. `docker buildx` + cross-compile của Go

Go cross-compile cực dễ (`GOOS`/`GOARCH` - [Bài 16](./16-production-ready.md), mục 11), nên ta **không cần giả lập CPU**. Mẹo nằm ở 3 dòng trong Dockerfile:

```dockerfile
# Stage build luôn chạy trên kiến trúc của MÁY BUILD (nhanh, không giả lập)
FROM --platform=$BUILDPLATFORM golang:${GO_VERSION}-alpine AS build
...
ARG TARGETOS TARGETARCH          # buildx tự điền: linux + amd64 / arm64
RUN ... CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build ...
```

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  --build-arg VERSION=1.0.0 -t notes-api:1.0.0-multi .
```

```text
#8 [linux/amd64 build 1/6] FROM docker.io/library/golang:1.24-alpine@sha256:8bee...
#16 [linux/amd64 build 6/6] RUN ... CGO_ENABLED=0 GOOS=linux GOARCH=amd64     go build ...
#19 [linux/amd64->arm64 build 6/6] RUN ... CGO_ENABLED=0 GOOS=linux GOARCH=arm64     go build ...
#19 DONE 19.2s
#20 [linux/arm64 stage-1 2/3] COPY --from=build /out/notes-api /notes-api
#21 [linux/arm64 stage-1 3/3] COPY --from=build --chown=nonroot:nonroot /out/data /data
#22 naming to docker.io/library/notes-api:1.0.0-multi done
```

Dòng `linux/amd64->arm64` nghĩa là: chạy **trên amd64**, tạo ra binary **cho arm64** - chính là cross-compile của Go. Stage cuối (`distroless`) không có lệnh `RUN` nào, nên **không cần QEMU** (bộ giả lập CPU).

```bash
docker images --tree notes-api:1.0.0-multi
```

```text
IMAGE                   ID             DISK USAGE   CONTENT SIZE   EXTRA
notes-api:1.0.0-multi   db3d6d0baef9       26.1MB         10.2MB
├─ linux/amd64          d0375fef8366       21.1MB         5.25MB
└─ linux/arm64          7d9365797f45       4.95MB         4.95MB
```

Một tag, **hai image bên trong** (gọi là *manifest list* / *image index*). Khi `docker pull`, máy arm64 tự lấy bản arm64, máy amd64 lấy bản amd64.

> 💡 Nếu `buildx` báo `docker exporter does not currently support exporting manifest lists`: Docker của bạn chưa bật **containerd image store** (Docker Desktop: Settings → General → "Use containerd for pulling and storing images"). Hoặc build xong đẩy thẳng lên registry bằng `--push`. Nếu stage cuối có `RUN` (ví dụ `apk add` trên alpine arm64), cần cài QEMU: `docker run --privileged --rm tonistiigi/binfmt --install all`.

### 13.3. Tag và đẩy lên registry

**Chiến lược tag** tốt: mỗi image có **nhiều tag** trỏ tới cùng nội dung:

```text
ghcr.io/my-team/notes-api:1.2.3     ← phiên bản chính xác (bất biến) - dùng để deploy
ghcr.io/my-team/notes-api:1.2       ← bản vá mới nhất của 1.2
ghcr.io/my-team/notes-api:sha-a1b2c3d  ← truy ngược được commit nào
ghcr.io/my-team/notes-api:latest    ← tiện để thử, KHÔNG dùng để deploy production
```

**Docker Hub**:

```bash
docker login                                   # Nhập username + Access Token (tạo ở Account Settings → Personal access tokens)
docker tag notes-api:1.0.0 yourname/notes-api:1.0.0
docker push yourname/notes-api:1.0.0
```

**GitHub Container Registry (GHCR)**:

```bash
# Tạo Personal Access Token (classic) có quyền write:packages
echo "$GHCR_TOKEN" | docker login ghcr.io -u your-github-username --password-stdin
docker tag notes-api:1.0.0 ghcr.io/your-github-username/notes-api:1.0.0
docker push ghcr.io/your-github-username/notes-api:1.0.0
```

> ⚠️ Tên image trên GHCR phải **viết thường** hết (`ghcr.io/MyTeam/...` sẽ bị từ chối).

Thử toàn bộ quy trình với một **registry chạy local** (chính là phần mềm registry mà Docker Hub dùng):

```bash
docker run -d --name registry -p 5000:5000 registry:3
docker tag notes-api:1.0.0 localhost:5000/notes-api:1.0.0
docker push localhost:5000/notes-api:1.0.0
```

```text
39dc083afc39: Pushed
3214acf345c0: Pushed
...
e0f6fde488b1: Pushed
1.0.0: digest: sha256:cac00b1e5d865f0d45e8709cb6ca8eaa02c6aef74b7e57b5824072c58d32354e size: 856
```

```bash
curl localhost:5000/v2/notes-api/tags/list
# {"name":"notes-api","tags":["1.0.0"]}
docker buildx imagetools inspect localhost:5000/notes-api:1.0.0-multi
```

```text
Name:      localhost:5000/notes-api:1.0.0-multi
MediaType: application/vnd.oci.image.index.v1+json
Manifests:
  Name:        localhost:5000/notes-api:1.0.0-multi@sha256:d0375fef8366...
  Platform:    linux/amd64
  Name:        localhost:5000/notes-api:1.0.0-multi@sha256:7d9365797f45...
  Platform:    linux/arm64
  ...
```

> 💡 Docker Hub **giới hạn số lần pull** cho người dùng ẩn danh (bạn sẽ gặp lỗi `429 Too Many Requests`). `docker login` (kể cả tài khoản miễn phí) để được hạn mức cao hơn - đặc biệt trên CI.

### 13.4. GitHub Actions: tự động build & push lên GHCR

Mỗi lần push lên `main` hoặc tạo tag `v1.2.3`, workflow build image **amd64 + arm64** và đẩy lên GHCR. Pull request thì **chỉ build** để kiểm tra, không push.

📄 **`.github/workflows/docker.yml`**

```yaml
name: docker

on:
  push:
    branches: [main]
    tags: ["v*.*.*"]
  pull_request:

permissions:
  contents: read
  packages: write        # Cho phép GITHUB_TOKEN đẩy image lên GHCR

jobs:
  image:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7

      # Buildx: cần cho multi-platform và cache
      - uses: docker/setup-buildx-action@v4

      # Không cần QEMU vì Go tự cross-compile (FROM --platform=$BUILDPLATFORM)

      - name: Đăng nhập GHCR
        if: github.event_name != 'pull_request'
        uses: docker/login-action@v4
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}   # Token tự động, không cần tạo secret

      # Sinh tag & label từ git: v1.2.3 → 1.2.3, 1.2 ; main → main ; commit → sha-xxxxxxx
      - name: Tính tag image
        id: meta
        uses: docker/metadata-action@v6
        with:
          images: ghcr.io/${{ github.repository }}   # Tự chuyển thành chữ thường
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=ref,event=branch
            type=ref,event=pr
            type=sha

      - name: Build & push
        uses: docker/build-push-action@v7
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          build-args: |
            VERSION=${{ steps.meta.outputs.version }}
          # Lưu layer cache vào GitHub Actions cache → lần build sau nhanh hơn nhiều
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

> 💡 Các action trên dùng phiên bản chính mới nhất tại thời điểm viết. Để an toàn chuỗi cung ứng, các team cẩn thận còn **ghim theo commit SHA** (`uses: docker/build-push-action@<sha-40-ký-tự> # v7.4.0`) - tag có thể bị kẻ xấu ghi đè, SHA thì không.

Kết hợp với workflow CI ở [Bài 16](./16-production-ready.md) (vet, test, lint, govulncheck): CI kiểm tra code, workflow này đóng gói và phát hành.

### 13.5. Quét lỗ hổng image

Image của bạn chứa: binary Go (thư viện chuẩn + dependency) và các gói của base image. Cả hai đều có thể có **lỗ hổng đã công bố (CVE)**. Hai công cụ phổ biến:

```bash
# Trivy (mã nguồn mở, của Aqua Security) - cài: brew install trivy, hoặc chạy qua Docker:
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image --severity HIGH,CRITICAL notes-api:1.0.0

# Docker Scout (có sẵn trong Docker Desktop)
docker scout quickview notes-api:1.0.0
docker scout cves notes-api:1.0.0
```

Kết quả Trivy **thật** cho Notes API build bằng **Go 1.24.13**:

```text
Report Summary

│             Target             │   Type   │ Vulnerabilities │ Secrets │
│ notes-api:1.0.0 (debian 12.15) │  debian  │        0        │    -    │
│ notes-api                      │ gobinary │       19        │    -    │

notes-api (gobinary)
====================
Total: 19 (HIGH: 19, CRITICAL: 0)

│ Library │ Vulnerability  │ Severity │ Status │ Installed Version │        Fixed Version         │                            Title                             │
├─────────┼────────────────┼──────────┼────────┼───────────────────┼──────────────────────────────┼──────────────────────────────────────────────────────────────┤
│ stdlib  │ CVE-2026-25679 │ HIGH     │ fixed  │ v1.24.13          │ 1.25.8, 1.26.1               │ net/url: Incorrect parsing of IPv6 host literals in net/url  │
│         │ CVE-2026-27145 │          │        │                   │ 1.25.11, 1.26.4              │ crypto/x509: golang: golang crypto/x509: Denial of Service   │
│         │ CVE-2026-32280 │          │        │                   │ 1.25.9, 1.26.2               │ crypto/x509: crypto/tls: golang: Go: Denial of Service       │
...
```

Đọc kết quả thế nào?

- Base image `distroless` (debian 12.15): **0 lỗ hổng** - image càng ít gói càng ít lỗ hổng
- **Cả 19 lỗ hổng đều nằm trong `stdlib`** - thư viện chuẩn của **Go 1.24.13**, và cột *Fixed Version* chỉ có bản 1.25.x, 1.26.x. Lý do: Go chỉ hỗ trợ (vá bảo mật) **hai phiên bản chính mới nhất**. Khi Go 1.26 ra mắt, Go 1.24 **hết hạn hỗ trợ**

Dockerfile của Ứng dụng 1 có `ARG GO_VERSION` nên đổi phiên bản Go không cần sửa file:

```bash
docker build --build-arg GO_VERSION=1.26 --build-arg VERSION=1.0.0 -t notes-api:1.0.0-go1.26 .
```

```text
│                Target                 │   Type   │ Vulnerabilities │ Secrets │
│ notes-api:1.0.0-go1.26 (debian 12.15) │  debian  │        0        │    -    │
│ notes-api                             │ gobinary │        0        │    -    │
```

**0 lỗ hổng.** Bài học thực tế: khóa học dùng Go 1.24 để thống nhất ví dụ, nhưng **khi deploy thật, hãy build bằng phiên bản Go mới nhất còn được hỗ trợ** và quét image định kỳ (ngay cả khi code không đổi, lỗ hổng mới vẫn được công bố mỗi tuần).

> 💡 `govulncheck` ([Bài 16](./16-production-ready.md)) còn thông minh hơn: nó chỉ báo lỗ hổng mà code của bạn **thực sự gọi tới**. Trivy/Scout quét **cả image** (kể cả gói hệ điều hành). Dùng cả hai.

### 13.6. Checklist bảo mật cho image Go

| ✅ Nên | ❌ Tránh |
|--------|----------|
| Multi-stage, runtime `distroless`/`scratch` | Deploy image `golang` có compiler, shell, git |
| `USER nonroot` / UID số | Chạy bằng root |
| Ghim phiên bản base image (`golang:1.24-alpine`, `postgres:17-alpine`); team lớn ghim cả digest `@sha256:...` | `FROM golang:latest` |
| Build bằng Go còn được hỗ trợ; quét Trivy/Scout trong CI | "Build một lần, dùng 3 năm" |
| `.dockerignore` loại `.env`, `.git`, `*.db` | `COPY . .` không có `.dockerignore` |
| Bí mật lúc build: `RUN --mount=type=secret,id=netrc,target=/root/.netrc go mod download` (module private) | `ARG GITHUB_TOKEN` / `ENV PASSWORD=...` (lộ trong `docker history`) |
| Chỉ publish cổng cần thiết; DB không `ports:` ra ngoài | Mở `5432:5432` ra Internet |
| `docker run --read-only --cap-drop=ALL` khi app không cần ghi file hệ thống | Cờ `--privileged` "cho chắc" |

## 📖 14. Debug container: các tình huống hay gặp

### 14.1. Container thoát ngay sau khi chạy

```bash
docker run -d --name web -e ADDR=:99999 hello-api:1.1.0
docker ps                   # Không thấy đâu!
docker ps -a --filter name=web
```

```text
NAMES     STATUS
web       Exited (1) 1 second ago
```

**Bước 1 luôn là xem log** (vẫn xem được dù container đã dừng):

```bash
docker logs web
```

```text
{"time":"...","level":"INFO","msg":"server khởi động","addr":":99999","version":"1.1.0","pid":1}
{"time":"...","level":"ERROR","msg":"dừng vì lỗi","err":"listen tcp: address 99999: invalid port"}
```

**Đọc exit code**:

| Exit code | Nghĩa thường gặp |
|-----------|------------------|
| `0` | Chương trình kết thúc bình thường. Nếu là server thì... nó **không nên** kết thúc! (ví dụ `docker run -d alpine:3.22` → `Exited (0)` ngay vì không có tiến trình chạy lâu) |
| `1` | App tự thoát vì lỗi (xem log) |
| `2` | Go panic, hoặc Go bị tín hiệu dừng mà không xử lý |
| `125` | Lỗi của chính `docker run` (cờ sai, tên trùng...) |
| `126` / `127` | Lệnh không chạy được / không tìm thấy lệnh |
| `137` | Bị **SIGKILL**: hết thời gian `docker stop`, hoặc **hết bộ nhớ (OOM)** - kiểm tra `docker inspect -f '{{.State.OOMKilled}}' web` |
| `143` | Bị SIGTERM và thoát theo mặc định |
| `255` + `exec ...: no such file or directory` | Binary động trong image `scratch`/`distroless` (quên `CGO_ENABLED=0`) |

### 14.2. Không truy cập được cổng

Kiểm tra theo thứ tự:

```bash
docker ps                      # 1. Container có đang chạy? Cột PORTS có "0.0.0.0:8080->8080/tcp"?
docker port web                # 2. Cổng nào được publish?
docker logs web                # 3. App lắng nghe địa chỉ nào? (":8080" ✅, "127.0.0.1:8080" ❌)
```

| Triệu chứng | Nguyên nhân |
|-------------|-------------|
| `curl: (7) Failed to connect to localhost port 8080` | Quên `-p` (cột PORTS chỉ có `8080/tcp` hoặc trống) |
| `curl: (56) Recv failure: Connection reset by peer` | App lắng nghe `127.0.0.1` trong container (mục 11.3) |
| `Bind for 0.0.0.0:8080 failed: port is already allocated` | Cổng 8080 trên máy thật đã bị container/chương trình khác dùng → đổi `-p 8090:8080` |
| Đúng hết mà vẫn không vào được từ máy khác | Firewall của máy chủ / security group của cloud |

### 14.3. `permission denied` khi ghi file

Xem mục 10.3: so sánh **chủ sở hữu thư mục** (`ls -ln`) với **UID container** (`docker inspect -f '{{.Config.User}}'`); sửa bằng `COPY --chown` (named volume), `--user`/`chown` (bind mount) - ❌ đừng chạy bằng root.

### 14.4. Debug image không có shell (distroless/scratch)

```bash
docker exec -it web sh
```

```text
OCI runtime exec failed: exec failed: unable to start container process: exec: "sh": executable file not found in $PATH
```

Đó là **tính năng** (ít công cụ = ít thứ để kẻ tấn công lợi dụng), nhưng khi cần debug:

```bash
# Mượn "mạng" của container web: chạy công cụ trong một container khác
docker run --rm --network container:web alpine:3.22 wget -qO- localhost:8080/healthz
# ok

# Mượn "không gian tiến trình": xem tiến trình của container web
docker run --rm --pid container:web alpine:3.22 ps
```

```text
PID   USER     TIME  COMMAND
    1 65532     0:00 /hello-api
   15 root      0:00 ps
```

Các lựa chọn khác: tag `:debug-nonroot` của distroless (có thêm busybox), `docker debug web` (Docker Desktop), hoặc `kubectl debug` trên Kubernetes.

### 14.5. Image quá to

```bash
docker images myapp                      # 1. Kích thước bao nhiêu?
docker history myapp:tag                 # 2. Layer nào nặng?
```

| Nguyên nhân | Dấu hiệu | Cách sửa |
|-------------|----------|----------|
| Không multi-stage | Image > 300 MB, có layer `go build` ~100 MB | Mục 6 |
| Build context chứa rác | `COPY . .` nặng, có `.git`, file DB | `.dockerignore` |
| Binary chưa strip | Binary lớn hơn ~30% | `-ldflags="-s -w"` |
| Xóa file ở layer sau | `RUN rm -rf /cache` nhưng image không nhỏ đi | File đã nằm ở layer trước - phải xóa **trong cùng lệnh `RUN`**, hoặc dùng multi-stage/cache mount |
| Base image to | `FROM ubuntu`, `FROM golang` ở stage cuối | `distroless/static` |

Công cụ [dive](https://github.com/wagoodman/dive) (`dive myapp:tag`) cho xem trực quan từng layer chứa file gì - rất đáng thử.

## 🌍 Ứng dụng thực tế

### Ứng dụng 1: Container hóa Notes API (SQLite) với Dockerfile tối ưu

**Bài toán**: Team bạn có một API ghi chú nhỏ dùng SQLite. Cần đóng gói thành image **nhỏ, an toàn, build nhanh**, có `/healthz` + `/readyz`, log JSON để hệ thống thu thập log đọc được, tắt an toàn khi deploy phiên bản mới, và **không mất dữ liệu** khi cập nhật.

**Cấu trúc**:

```text
notes-api/
├── .dockerignore
├── Dockerfile
├── go.mod
├── go.sum
├── main.go       ← config, HTTP handler, middleware log, graceful shutdown, -healthcheck
└── store.go      ← lưu trữ SQLite (ở Ứng dụng 2 chỉ thay file này bằng PostgreSQL)
```

```bash
mkdir notes-api && cd notes-api
go mod init notes-api
go get modernc.org/sqlite@v1.46.1     # Bản mới nhất còn hỗ trợ Go 1.24 (giống Bài 16)
```

📄 **`main.go`**

```go
package main

import (
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync/atomic"
	"syscall"
	"time"
)

var version = "dev" // Ghi đè khi build: -ldflags "-X main.version=1.0.0"

type config struct {
	Addr     string // NOTES_ADDR
	DSN      string // NOTES_DB_DSN: đường dẫn file SQLite (Ứng dụng 1) hoặc URL PostgreSQL (Ứng dụng 2)
	LogLevel string // NOTES_LOG_LEVEL: debug | info | warn | error
}

func loadConfig() config {
	return config{
		Addr:     cmp.Or(os.Getenv("NOTES_ADDR"), ":8080"),
		DSN:      cmp.Or(os.Getenv("NOTES_DB_DSN"), "notes.db"),
		LogLevel: cmp.Or(os.Getenv("NOTES_LOG_LEVEL"), "info"),
	}
}

func main() {
	healthcheck := flag.Bool("healthcheck", false, "gọi /healthz của server đang chạy rồi thoát")
	flag.Parse()
	cfg := loadConfig()

	if *healthcheck {
		os.Exit(runHealthcheck(cfg.Addr))
	}

	var level slog.Level
	if err := level.UnmarshalText([]byte(cfg.LogLevel)); err != nil {
		level = slog.LevelInfo
	}
	// Log JSON ra stdout: Docker thu thập stdout/stderr → "docker logs" đọc được
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level})).
		With("service", "notes-api", "version", version)

	if err := run(logger, cfg); err != nil {
		logger.Error("dừng vì lỗi", "err", err)
		os.Exit(1)
	}
}

func run(logger *slog.Logger, cfg config) error {
	// ctx bị hủy khi nhận SIGINT (Ctrl+C) hoặc SIGTERM (docker stop)
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	store, err := openStore(ctx, logger, cfg.DSN)
	if err != nil {
		return err
	}
	defer store.Close()

	var shuttingDown atomic.Bool
	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           logRequests(logger, routes(store, &shuttingDown)),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	serverErr := make(chan error, 1)
	go func() {
		logger.Info("server khởi động", "addr", cfg.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
		}
		close(serverErr)
	}()

	select {
	case err := <-serverErr:
		return err
	case <-ctx.Done():
		logger.Info("nhận tín hiệu dừng, bắt đầu graceful shutdown")
	}

	shuttingDown.Store(true) // /readyz trả 503 → load balancer ngừng gửi request mới
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("shutdown: %w", err)
	}
	logger.Info("đã dừng an toàn")
	return nil
}

func routes(store *Store, shuttingDown *atomic.Bool) http.Handler {
	mux := http.NewServeMux()

	// Liveness: tiến trình còn sống là đủ, KHÔNG kiểm tra database
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "version": version})
	})

	// Readiness: sẵn sàng nhận traffic? (DB phản hồi, không đang shutdown)
	mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if shuttingDown.Load() {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "shutting down"})
			return
		}
		if err := store.Ping(ctx); err != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "db unavailable"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ready"})
	})

	mux.HandleFunc("POST /v1/notes", func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			Title string `json:"title"`
			Body  string `json:"body"`
		}
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // Giới hạn 1 MB
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "JSON không hợp lệ"})
			return
		}
		in.Title = strings.TrimSpace(in.Title)
		if in.Title == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "title là bắt buộc"})
			return
		}
		n, err := store.Create(r.Context(), in.Title, in.Body)
		if err != nil {
			serverError(w, r, err)
			return
		}
		writeJSON(w, http.StatusCreated, n)
	})

	mux.HandleFunc("GET /v1/notes", func(w http.ResponseWriter, r *http.Request) {
		notes, err := store.List(r.Context())
		if err != nil {
			serverError(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, notes)
	})

	mux.HandleFunc("GET /v1/notes/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id không hợp lệ"})
			return
		}
		n, err := store.Get(r.Context(), id)
		if errors.Is(err, ErrNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "không tìm thấy ghi chú"})
			return
		}
		if err != nil {
			serverError(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, n)
	})

	return mux
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// serverError ghi log chi tiết (qua middleware) nhưng chỉ trả thông báo chung cho client.
func serverError(w http.ResponseWriter, r *http.Request, err error) {
	if rec, ok := w.(*statusRecorder); ok {
		rec.err = err
	}
	writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "lỗi hệ thống"})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
	err    error
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

// logRequests ghi MỘT dòng log JSON cho mỗi request.
func logRequests(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)

		attrs := []any{
			"method", r.Method, "path", r.URL.Path,
			"status", rec.status, "duration_ms", time.Since(start).Milliseconds(),
		}
		switch {
		case rec.err != nil:
			logger.Error("http request", append(attrs, "err", rec.err)...)
		case r.URL.Path == "/healthz" || r.URL.Path == "/readyz":
			logger.Debug("http request", attrs...) // Health check gọi liên tục → chỉ log ở mức debug
		default:
			logger.Info("http request", attrs...)
		}
	})
}

func runHealthcheck(addr string) int {
	_, port, _ := strings.Cut(addr, ":")
	client := http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get("http://127.0.0.1:" + port + "/healthz")
	if err != nil {
		fmt.Fprintln(os.Stderr, "healthcheck:", err)
		return 1
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return 1
	}
	return 0
}
```

📄 **`store.go`**

```go
package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"time"

	_ "modernc.org/sqlite" // Driver SQLite thuần Go → build được với CGO_ENABLED=0
)

var ErrNotFound = errors.New("not found")

type Note struct {
	ID        int64     `json:"id"`
	Title     string    `json:"title"`
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"created_at"`
}

type Store struct{ db *sql.DB }

func openStore(ctx context.Context, logger *slog.Logger, path string) (*Store, error) {
	// WAL + busy_timeout: cấu hình SQLite hay dùng cho web server (đã học ở Bài 13)
	dsn := "file:" + path + "?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)"
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("mở database: %w", err)
	}
	db.SetMaxOpenConns(1) // SQLite chỉ cho một writer tại một thời điểm

	const schema = `CREATE TABLE IF NOT EXISTS notes (
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		title      TEXT NOT NULL,
		body       TEXT NOT NULL DEFAULT '',
		created_at TEXT NOT NULL
	)`
	if _, err := db.ExecContext(ctx, schema); err != nil {
		db.Close()
		return nil, fmt.Errorf("tạo bảng: %w", err)
	}
	logger.Info("đã mở database", "driver", "sqlite", "path", path)
	return &Store{db: db}, nil
}

func (s *Store) Close() error                   { return s.db.Close() }
func (s *Store) Ping(ctx context.Context) error { return s.db.PingContext(ctx) }

func (s *Store) Create(ctx context.Context, title, body string) (Note, error) {
	n := Note{Title: title, Body: body, CreatedAt: time.Now().UTC().Truncate(time.Second)}
	res, err := s.db.ExecContext(ctx,
		`INSERT INTO notes (title, body, created_at) VALUES (?, ?, ?)`,
		n.Title, n.Body, n.CreatedAt.Format(time.RFC3339))
	if err != nil {
		return Note{}, fmt.Errorf("thêm ghi chú: %w", err)
	}
	n.ID, err = res.LastInsertId()
	return n, err
}

func (s *Store) Get(ctx context.Context, id int64) (Note, error) {
	var n Note
	var created string
	err := s.db.QueryRowContext(ctx,
		`SELECT id, title, body, created_at FROM notes WHERE id = ?`, id).
		Scan(&n.ID, &n.Title, &n.Body, &created)
	if errors.Is(err, sql.ErrNoRows) {
		return Note{}, ErrNotFound
	}
	if err != nil {
		return Note{}, fmt.Errorf("lấy ghi chú %d: %w", id, err)
	}
	n.CreatedAt, err = time.Parse(time.RFC3339, created)
	return n, err
}

func (s *Store) List(ctx context.Context) ([]Note, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, title, body, created_at FROM notes ORDER BY id`)
	if err != nil {
		return nil, fmt.Errorf("liệt kê ghi chú: %w", err)
	}
	defer rows.Close()

	notes := []Note{} // Trả về [] thay vì null khi chưa có ghi chú
	for rows.Next() {
		var n Note
		var created string
		if err := rows.Scan(&n.ID, &n.Title, &n.Body, &created); err != nil {
			return nil, err
		}
		if n.CreatedAt, err = time.Parse(time.RFC3339, created); err != nil {
			return nil, err
		}
		notes = append(notes, n)
	}
	return notes, rows.Err()
}
```

📄 **`Dockerfile`** - tổng hợp mọi kỹ thuật của bài:

```dockerfile
# syntax=docker/dockerfile:1

# ARG trước FROM: đổi phiên bản Go mà không sửa file (--build-arg GO_VERSION=1.26)
ARG GO_VERSION=1.24

# ================= Giai đoạn 1: build =================
# --platform=$BUILDPLATFORM: luôn build trên kiến trúc của MÁY BUILD (nhanh),
# rồi để Go cross-compile sang kiến trúc đích (TARGETOS/TARGETARCH)
FROM --platform=$BUILDPLATFORM golang:${GO_VERSION}-alpine AS build
WORKDIR /src

# Tải dependency trước - chỉ chạy lại khi go.mod/go.sum thay đổi.
# Cache mount giữ module cache giữa các lần build (không nằm trong image)
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

COPY . .

ARG VERSION=dev
ARG TARGETOS TARGETARCH
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -trimpath \
      -ldflags="-s -w -X main.version=${VERSION}" \
      -o /out/notes-api . \
 && mkdir -p /out/data

# ================= Giai đoạn 2: runtime =================
FROM gcr.io/distroless/static-debian12:nonroot

# OCI labels: metadata hiển thị trên registry (GHCR, Docker Hub)
LABEL org.opencontainers.image.title="notes-api" \
      org.opencontainers.image.source="https://github.com/your-org/notes-api"

COPY --from=build /out/notes-api /notes-api
COPY --from=build --chown=nonroot:nonroot /out/data /data

ENV NOTES_ADDR=:8080 \
    NOTES_DB_DSN=/data/notes.db

USER nonroot:nonroot
EXPOSE 8080
VOLUME ["/data"]

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD ["/notes-api", "-healthcheck"]

ENTRYPOINT ["/notes-api"]
```

📄 **`.dockerignore`**

```text
# Git, IDE, file tạm
.git
.github
.vscode
.idea
tmp/
bin/

# Dữ liệu & bí mật - TUYỆT ĐỐI không đưa vào image
*.db
*.db-*
.env
.env.*

# Không cần cho việc build
*.md
Dockerfile*
compose*.yaml
Makefile
coverage.out
```

**Build và kiểm tra kích thước**:

```bash
docker build --build-arg VERSION=1.0.0 -t notes-api:1.0.0 .
docker images notes-api:1.0.0
```

```text
IMAGE             ID             DISK USAGE   CONTENT SIZE   EXTRA
notes-api:1.0.0   6d9ad00c7344       21.1MB         5.25MB
```

**5.25 MB** cho một API có cả database SQLite nhúng bên trong (binary 10.4 MB trước khi nén).

**Chạy với named volume và thử API**:

```bash
docker run -d --name notes -p 8080:8080 -v notes-data:/data notes-api:1.0.0

curl localhost:8080/healthz
curl localhost:8080/readyz
curl -X POST localhost:8080/v1/notes -d '{"title":"Học Docker","body":"multi-stage build"}'
curl -X POST localhost:8080/v1/notes -d '{"title":"Học Compose"}'
curl -X POST localhost:8080/v1/notes -d '{"title":"  "}'
curl localhost:8080/v1/notes
curl localhost:8080/v1/notes/99
```

```text
{"status":"ok","version":"1.0.0"}
{"status":"ready"}
{"id":1,"title":"Học Docker","body":"multi-stage build","created_at":"2026-09-26T10:16:31Z"}
{"id":2,"title":"Học Compose","body":"","created_at":"2026-09-26T10:16:31Z"}
{"error":"title là bắt buộc"}
[{"id":1,"title":"Học Docker","body":"multi-stage build","created_at":"2026-09-26T10:16:31Z"},{"id":2,"title":"Học Compose","body":"","created_at":"2026-09-26T10:16:31Z"}]
{"error":"không tìm thấy ghi chú"}
```

Sau khoảng 10 giây, `docker ps` hiện trạng thái `Up 14 seconds (healthy)`.

**Deploy "phiên bản mới"**: dừng, xóa container, chạy lại - dữ liệu phải còn:

```bash
time docker stop notes
docker logs notes
```

```text
notes

real	0m0.216s
```

```text
{"time":"2026-09-26T10:16:28.989746603Z","level":"INFO","msg":"đã mở database","service":"notes-api","version":"1.0.0","driver":"sqlite","path":"/data/notes.db"}
{"time":"2026-09-26T10:16:28.989978344Z","level":"INFO","msg":"server khởi động","service":"notes-api","version":"1.0.0","addr":":8080"}
{"time":"2026-09-26T10:16:31.019415377Z","level":"INFO","msg":"http request","service":"notes-api","version":"1.0.0","method":"POST","path":"/v1/notes","status":201,"duration_ms":1}
{"time":"2026-09-26T10:16:31.026348373Z","level":"INFO","msg":"http request","service":"notes-api","version":"1.0.0","method":"POST","path":"/v1/notes","status":201,"duration_ms":0}
{"time":"2026-09-26T10:16:31.03314133Z","level":"INFO","msg":"http request","service":"notes-api","version":"1.0.0","method":"POST","path":"/v1/notes","status":400,"duration_ms":0}
{"time":"2026-09-26T10:16:31.039870416Z","level":"INFO","msg":"http request","service":"notes-api","version":"1.0.0","method":"GET","path":"/v1/notes","status":200,"duration_ms":0}
{"time":"2026-09-26T10:16:31.046526587Z","level":"INFO","msg":"http request","service":"notes-api","version":"1.0.0","method":"GET","path":"/v1/notes/99","status":404,"duration_ms":0}
{"time":"2026-09-26T10:16:43.106458174Z","level":"INFO","msg":"nhận tín hiệu dừng, bắt đầu graceful shutdown","service":"notes-api","version":"1.0.0"}
{"time":"2026-09-26T10:16:43.10669951Z","level":"INFO","msg":"đã dừng an toàn","service":"notes-api","version":"1.0.0"}
```

Để ý: health check chạy mỗi 10 giây nhưng **không làm rác log** (chỉ ghi ở mức `debug`). Mỗi dòng log là JSON có `service`, `version` - hệ thống như Loki, Elasticsearch, CloudWatch lọc được ngay.

```bash
docker rm notes
docker run -d --name notes -p 8080:8080 -v notes-data:/data notes-api:1.0.0
curl localhost:8080/v1/notes
```

```text
[{"id":1,"title":"Học Docker","body":"multi-stage build","created_at":"2026-09-26T10:16:31Z"},{"id":2,"title":"Học Compose","body":"","created_at":"2026-09-26T10:16:31Z"}]
```

✅ Dữ liệu còn nguyên sau khi thay container.

**Kiến thức sử dụng**: multi-stage (mục 6), `CGO_ENABLED=0` + driver thuần Go, `-ldflags -X` (6.3), cache mount (5.2), `distroless:nonroot` (7, 8.1), `COPY --chown` cho volume (10.3), `HEALTHCHECK` bằng chính binary (4.5), graceful shutdown (8.2), `ARG GO_VERSION` + `--platform=$BUILDPLATFORM` (13).

### Ứng dụng 2: Stack Compose Go API + PostgreSQL, migration khi khởi động

**Bài toán**: Chuyển Notes API sang **PostgreSQL**. Yêu cầu: `docker compose up` là chạy được cả stack; **tự chạy migration** khi API khởi động (an toàn kể cả khi chạy nhiều bản sao); dữ liệu **bền vững** qua `down`/`up`; API **tự thử kết nối lại** khi DB chưa sẵn sàng.

**Cấu trúc**:

```text
notes-pg/
├── .dockerignore          ← giống Ứng dụng 1
├── .env                   ← KHÔNG commit (xem .env.example)
├── .env.example
├── compose.yaml           ← đã giải thích ở mục 12.2
├── Dockerfile
├── go.mod
├── go.sum
├── main.go                ← GIỐNG HỆT Ứng dụng 1, không sửa dòng nào!
├── migrate.go             ← chạy migration nhúng bằng embed
├── store.go               ← thay SQLite bằng PostgreSQL (pgx)
└── migrations/
    ├── 001_create_notes.sql
    └── 002_notes_created_at_index.sql
```

```bash
cp -r notes-api notes-pg && cd notes-pg
go get github.com/jackc/pgx/v5@v5.8.0   # Bản mới nhất còn hỗ trợ Go 1.24 (v5.9+ cần Go 1.25)
go mod tidy                             # Tự bỏ modernc.org/sqlite vì không còn import
```

`go.mod` sau đó chỉ còn `require github.com/jackc/pgx/v5 v5.8.0` cùng vài gói `indirect` (`pgpassfile`, `pgservicefile`, `puddle/v2`, `x/sync v0.17.0`, `x/text v0.29.0`).

> 💡 Nhờ `main.go` chỉ phụ thuộc vào các phương thức `openStore`, `Create`, `Get`, `List`, `Ping`, `Close`, ta đổi cả hệ quản trị database mà **không sửa một dòng** HTTP handler - đúng tinh thần "hướng phụ thuộc" ở [Bài 16](./16-production-ready.md). (Ở Bài 16 bạn làm việc này "chuẩn" hơn bằng interface `bookmark.Repository`.)

📄 **`migrations/001_create_notes.sql`**

```sql
CREATE TABLE notes (
    id         BIGSERIAL PRIMARY KEY,
    title      TEXT        NOT NULL,
    body       TEXT        NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

📄 **`migrations/002_notes_created_at_index.sql`**

```sql
CREATE INDEX idx_notes_created_at ON notes (created_at DESC);
```

📄 **`migrate.go`** - migration runner (ý tưởng từ [Bài 13](./13-database-sql.md), mục 10) + **khóa advisory** để nhiều bản sao API không chạy migration cùng lúc:

```go
package main

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"io/fs"
	"log/slog"
	"sort"
	"strings"
)

// Các file .sql được NHÚNG vào binary → image không cần copy thư mục migrations
//
//go:embed migrations/*.sql
var migrationFS embed.FS

// Khóa "advisory" của PostgreSQL: nếu chạy 3 bản sao API cùng lúc,
// chỉ MỘT bản chạy migration, các bản còn lại chờ.
const migrationLockID = 727_001

func migrate(ctx context.Context, logger *slog.Logger, db *sql.DB) error {
	// Advisory lock gắn với MỘT kết nối → giữ riêng một conn trong suốt quá trình
	conn, err := db.Conn(ctx)
	if err != nil {
		return fmt.Errorf("migration: lấy kết nối: %w", err)
	}
	defer conn.Close()

	if _, err := conn.ExecContext(ctx, `SELECT pg_advisory_lock($1)`, migrationLockID); err != nil {
		return fmt.Errorf("migration: lấy khóa: %w", err)
	}
	defer conn.ExecContext(context.Background(), `SELECT pg_advisory_unlock($1)`, migrationLockID)

	if _, err := conn.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (
		version    TEXT PRIMARY KEY,
		applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
	)`); err != nil {
		return fmt.Errorf("migration: tạo bảng schema_migrations: %w", err)
	}

	files, err := fs.Glob(migrationFS, "migrations/*.sql")
	if err != nil {
		return err
	}
	sort.Strings(files) // 001_..., 002_... chạy đúng thứ tự

	applied := 0
	for _, file := range files {
		version := strings.TrimSuffix(strings.TrimPrefix(file, "migrations/"), ".sql")

		var exists bool
		if err := conn.QueryRowContext(ctx,
			`SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = $1)`, version).
			Scan(&exists); err != nil {
			return fmt.Errorf("migration %s: %w", version, err)
		}
		if exists {
			continue // Đã chạy rồi → bỏ qua
		}

		query, err := migrationFS.ReadFile(file)
		if err != nil {
			return err
		}
		// Mỗi migration trong MỘT transaction: lỗi giữa chừng → không để lại schema "dở dang"
		tx, err := conn.BeginTx(ctx, nil)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, string(query)); err != nil {
			tx.Rollback()
			return fmt.Errorf("migration %s: %w", version, err)
		}
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO schema_migrations (version) VALUES ($1)`, version); err != nil {
			tx.Rollback()
			return fmt.Errorf("migration %s: ghi version: %w", version, err)
		}
		if err := tx.Commit(); err != nil {
			return fmt.Errorf("migration %s: commit: %w", version, err)
		}
		logger.Info("đã chạy migration", "migration", version)
		applied++
	}
	logger.Info("migration hoàn tất", "applied", applied, "total", len(files))
	return nil
}
```

📄 **`store.go`** (PostgreSQL) - phần khác với Ứng dụng 1:

```go
package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib" // Đăng ký driver "pgx" cho database/sql
)

var ErrNotFound = errors.New("not found")

type Note struct {
	ID        int64     `json:"id"`
	Title     string    `json:"title"`
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"created_at"`
}

type Store struct{ db *sql.DB }

// openStore kết nối PostgreSQL (thử lại nếu DB chưa sẵn sàng) rồi chạy migration.
func openStore(ctx context.Context, logger *slog.Logger, dsn string) (*Store, error) {
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, fmt.Errorf("mở database: %w", err)
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(30 * time.Minute)

	if err := waitForDB(ctx, logger, db, 30*time.Second); err != nil {
		db.Close()
		return nil, err
	}
	if err := migrate(ctx, logger, db); err != nil {
		db.Close()
		return nil, err
	}
	return &Store{db: db}, nil
}

// waitForDB ping database với backoff tăng dần: 0.5s, 1s, 2s, 4s (tối đa 5s/lần).
// Container DB có thể "running" nhưng chưa nhận kết nối - đừng crash ngay!
func waitForDB(ctx context.Context, logger *slog.Logger, db *sql.DB, maxWait time.Duration) error {
	ctx, cancel := context.WithTimeout(ctx, maxWait)
	defer cancel()

	delay := 500 * time.Millisecond
	for attempt := 1; ; attempt++ {
		pingCtx, pingCancel := context.WithTimeout(ctx, 2*time.Second)
		err := db.PingContext(pingCtx)
		pingCancel()
		if err == nil {
			logger.Info("đã kết nối database", "attempt", attempt)
			return nil
		}
		logger.Warn("database chưa sẵn sàng, thử lại", "attempt", attempt, "retry_in", delay.String(), "err", err)
		select {
		case <-ctx.Done():
			return fmt.Errorf("không kết nối được database sau %s: %w", maxWait, err)
		case <-time.After(delay):
		}
		delay = min(delay*2, 5*time.Second)
	}
}

func (s *Store) Close() error                   { return s.db.Close() }
func (s *Store) Ping(ctx context.Context) error { return s.db.PingContext(ctx) }

func (s *Store) Create(ctx context.Context, title, body string) (Note, error) {
	n := Note{Title: title, Body: body}
	// PostgreSQL dùng $1, $2... và RETURNING để lấy id + giá trị mặc định
	err := s.db.QueryRowContext(ctx,
		`INSERT INTO notes (title, body) VALUES ($1, $2) RETURNING id, created_at`,
		title, body).Scan(&n.ID, &n.CreatedAt)
	if err != nil {
		return Note{}, fmt.Errorf("thêm ghi chú: %w", err)
	}
	return n, nil
}

// Get và List: GIỐNG HỆT bản SQLite ở Ứng dụng 1, chỉ khác 2 điểm:
//   1. Placeholder "$1" thay cho "?"   →  ... FROM notes WHERE id = $1
//   2. pgx trả cột TIMESTAMPTZ thành time.Time → Scan thẳng vào &n.CreatedAt,
//      không cần biến trung gian "created string" và time.Parse nữa
```

📄 **`Dockerfile`** - giống Ứng dụng 1, **bỏ** phần thư mục `/data` (dữ liệu giờ nằm trong Postgres):

```diff
       -o /out/notes-api . \
- && mkdir -p /out/data
+      -o /out/notes-api .
...
-COPY --from=build --chown=nonroot:nonroot /out/data /data
-
-ENV NOTES_ADDR=:8080 \
-    NOTES_DB_DSN=/data/notes.db
+ENV NOTES_ADDR=:8080
...
-VOLUME ["/data"]
```

(Thư mục `migrations/` **không cần** `COPY` riêng vào image runtime: `//go:embed` đã nhúng các file `.sql` vào binary lúc build.)

`compose.yaml` và `.env`: dùng đúng hai file ở **mục 12.2**. Commit thêm `.env.example` (nội dung như `.env` nhưng mật khẩu giả) để người khác `cp .env.example .env`; bản thân `.env` thì đưa vào `.gitignore`.

**Chạy lần đầu**:

```bash
docker compose up -d --build
docker compose logs api
```

```text
api-1  | {"time":"2026-09-26T10:18:32.859008766Z","level":"INFO","msg":"đã kết nối database","service":"notes-api","version":"1.0.0","attempt":1}
api-1  | {"time":"2026-09-26T10:18:32.872708756Z","level":"INFO","msg":"đã chạy migration","service":"notes-api","version":"1.0.0","migration":"001_create_notes"}
api-1  | {"time":"2026-09-26T10:18:32.875187462Z","level":"INFO","msg":"đã chạy migration","service":"notes-api","version":"1.0.0","migration":"002_notes_created_at_index"}
api-1  | {"time":"2026-09-26T10:18:32.875257695Z","level":"INFO","msg":"migration hoàn tất","service":"notes-api","version":"1.0.0","applied":2,"total":2}
api-1  | {"time":"2026-09-26T10:18:32.875686406Z","level":"INFO","msg":"server khởi động","service":"notes-api","version":"1.0.0","addr":":8080"}
```

```bash
curl localhost:8080/readyz
curl -X POST localhost:8080/v1/notes -d '{"title":"Ghi chú trong Postgres","body":"chạy bằng docker compose"}'
curl localhost:8080/v1/notes
```

```text
{"status":"ready"}
{"id":1,"title":"Ghi chú trong Postgres","body":"chạy bằng docker compose","created_at":"2026-09-26T10:18:40.54274Z"}
[{"id":1,"title":"Ghi chú trong Postgres","body":"chạy bằng docker compose","created_at":"2026-09-26T10:18:40.54274Z"}]
```

**Nhìn vào database**:

```bash
docker compose exec db psql -U notes -d notes -c 'SELECT * FROM schema_migrations;' -c '\dt'
```

```text
          version           |          applied_at
----------------------------+-------------------------------
 001_create_notes           | 2026-09-26 10:18:32.868054+00
 002_notes_created_at_index | 2026-09-26 10:18:32.873236+00
(2 rows)

             List of relations
 Schema |       Name        | Type  | Owner
--------+-------------------+-------+-------
 public | notes             | table | notes
 public | schema_migrations | table | notes
(2 rows)
```

Hoặc mở Adminer: `docker compose --profile tools up -d` → vào `http://localhost:8081`, chọn **System: PostgreSQL**, server `db`, user/password/database theo `.env`.

**Dữ liệu bền vững qua `down` / `up`**:

```bash
docker compose down        # Xóa container + network, GIỮ volume
docker compose up -d
docker compose logs api | grep migration
curl localhost:8080/v1/notes
```

```text
# (rút gọn trường "time")
api-1  | {"level":"INFO","msg":"migration hoàn tất","service":"notes-api","version":"1.0.0","applied":0,"total":2}
[{"id":1,"title":"Ghi chú trong Postgres","body":"chạy bằng docker compose","created_at":"2026-09-26T10:18:40.54274Z"}]
```

`applied: 0` - migration đã chạy rồi thì **bỏ qua**; ghi chú vẫn còn.

**Database gặp sự cố thì sao?** Dừng riêng `db` trong khi API đang chạy:

```bash
docker compose stop db
curl -w ' %{http_code}\n' localhost:8080/healthz
curl -w ' %{http_code}\n' localhost:8080/readyz
curl -w ' %{http_code}\n' localhost:8080/v1/notes
docker compose start db
curl -w ' %{http_code}\n' localhost:8080/readyz
```

```text
{"status":"ok","version":"1.0.0"} 200
{"status":"db unavailable"} 503
{"error":"lỗi hệ thống"} 500
 Container notes-db-1 Starting
 Container notes-db-1 Started
{"status":"ready"} 200
```

- `/healthz` vẫn **200** → Kubernetes/Docker **không** restart API vô ích (DB lỗi thì restart API cũng không giúp gì)
- `/readyz` **503** → load balancer tạm ngừng gửi traffic
- Client chỉ thấy `"lỗi hệ thống"`, còn chi tiết nằm trong log (không lộ thông tin nội bộ; rút gọn trường `time`):

```text
{"level":"ERROR","msg":"http request","service":"notes-api","version":"1.0.0","method":"GET","path":"/v1/notes","status":500,"duration_ms":7,"err":"liệt kê ghi chú: failed to connect to `user=notes database=notes`: hostname resolving error: lookup db on 127.0.0.11:53: no such host"}
```

- DB bật lại → API **tự phục hồi**, không cần restart (connection pool của `database/sql` tự tạo kết nối mới)

**Làm lại từ đầu** (xóa sạch dữ liệu):

```bash
docker compose down -v                              # ... Volume notes_pgdata Removed
docker compose up -d && curl localhost:8080/v1/notes
# []     ← database mới tinh, migration 001 + 002 chạy lại
```

### Ứng dụng 3: Môi trường dev "một lệnh" cho cả team

**Bài toán**: Nhân viên mới vào team. Mục tiêu: **clone repo → một lệnh → có đủ API + DB chạy được**, sửa code thấy kết quả ngay, không cần nhớ lệnh Docker dài dòng.

**Bước 1 - Makefile gom lệnh** (đặt trong `notes-pg/`):

📄 **`Makefile`** (⚠️ các dòng lệnh thụt vào bằng **Tab**)

```makefile
# Makefile cho môi trường dev - cả team chỉ cần nhớ "make up", "make logs"...
# ⚠️ Dòng lệnh phải thụt vào bằng TAB
COMPOSE ?= docker compose
-include .env          # Đọc biến từ .env (nếu có) để dùng trong Makefile
export

.PHONY: help up down restart logs ps watch psql db-reset tools test

help: ## Liệt kê các lệnh
	@grep -hE '^[a-z-]+:.*## ' Makefile | awk -F':.*## ' '{printf "  %-9s %s\n", $$1, $$2}'

up: ## Build và chạy API + Postgres ở chế độ nền
	$(COMPOSE) up -d --build

down: ## Dừng và xóa container (GIỮ dữ liệu)
	$(COMPOSE) --profile tools down

restart: ## Build lại và chạy lại riêng API
	$(COMPOSE) up -d --build api

logs: ## Xem log API (Ctrl+C để thoát)
	$(COMPOSE) logs -f api

ps: ## Trạng thái các service
	$(COMPOSE) ps

watch: ## Tự build lại khi sửa code (hot reload)
	$(COMPOSE) watch

psql: ## Mở psql vào database
	$(COMPOSE) exec db psql -U $(POSTGRES_USER) -d $(POSTGRES_DB)

db-reset: ## ⚠️ XÓA SẠCH dữ liệu rồi chạy lại từ đầu
	$(COMPOSE) --profile tools down -v
	$(COMPOSE) up -d --build

tools: ## Bật Adminer tại http://localhost:8081
	$(COMPOSE) --profile tools up -d adminer

test: ## Chạy unit test trên máy (không cần Docker)
	go test -race -count=1 ./...
```

```bash
make help
```

```text
  help      Liệt kê các lệnh
  up        Build và chạy API + Postgres ở chế độ nền
  down      Dừng và xóa container (GIỮ dữ liệu)
  restart   Build lại và chạy lại riêng API
  logs      Xem log API (Ctrl+C để thoát)
  ps        Trạng thái các service
  watch     Tự build lại khi sửa code (hot reload)
  psql      Mở psql vào database
  db-reset  ⚠️ XÓA SẠCH dữ liệu rồi chạy lại từ đầu
  tools     Bật Adminer tại http://localhost:8081
  test      Chạy unit test trên máy (không cần Docker)
```

`make db-reset` in ra từng lệnh nó chạy (`docker compose --profile tools down -v` rồi `docker compose up -d --build`) - người mới nhìn log cũng học được lệnh Docker thật.

```bash
echo 'SELECT count(*) AS so_ghi_chu FROM notes;' | make psql
```

```text
docker compose exec db psql -U notes -d notes
 so_ghi_chu
------------
          0
(1 row)
```

> 💡 `COMPOSE ?= docker compose` cho phép ghi đè khi cần, ví dụ dùng thêm file cấu hình: `make up COMPOSE="docker compose -f compose.yaml -f compose.dev.yaml"`.

**Bước 2 - Hot reload bằng `docker compose watch`** (đã khai báo `develop.watch` trong `compose.yaml`):

```bash
make watch
```

Sửa `main.go` (ví dụ thêm `"mode": "hot-reload"` vào response `/healthz`) rồi lưu file. Terminal hiện:

```text
Watch enabled
Rebuilding service(s) ["api"] after changes were detected...
 Image notes-api-pg:1.0.0 Building
 Image notes-api-pg:1.0.0 Built
service(s) ["api"] successfully built
 Container notes-db-1 Running
 Container notes-api-1 Recreate
 Container notes-api-1 Recreated
 Container notes-api-1 Starting
 Container notes-api-1 Started
```

```bash
curl localhost:8080/healthz
# {"mode":"hot-reload","status":"ok","version":"1.0.0"}
```

Không cần gõ lệnh nào - image được build lại (nhanh nhờ cache mount) và container được thay thế.

**Bước 3 (tùy chọn) - Hot reload nhanh hơn với air**:

📄 **`Dockerfile.dev`** - image **chỉ dùng khi dev**, có Go toolchain:

```dockerfile
# Image CHỈ dùng cho dev: có Go toolchain + air để tự build lại khi sửa code
FROM golang:1.24-alpine
RUN go install github.com/air-verse/air@v1.62.0
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
CMD ["air", "-c", ".air.toml"]
```

📄 **`.air.toml`**

```toml
# Cấu hình air tối giản
root = "."
tmp_dir = "tmp"

[build]
  cmd = "go build -o ./tmp/notes-api ."
  bin = "./tmp/notes-api"
  include_ext = ["go", "sql"]
  exclude_dir = ["tmp"]
  delay = 500            # ms chờ sau khi phát hiện thay đổi
  poll = true            # Docker Desktop (Windows/macOS) đôi khi không nhận sự kiện file → dùng polling
  poll_interval = 500
```

📄 **`compose.dev.yaml`** - **ghi đè** một phần `compose.yaml` (Compose tự gộp các file theo thứ tự `-f`):

```yaml
# Ghi đè compose.yaml cho môi trường dev dùng air:
#   docker compose -f compose.yaml -f compose.dev.yaml up --build
services:
  api:
    build:
      dockerfile: Dockerfile.dev
    image: notes-api-pg:dev
    volumes:
      - .:/app                  # Bind mount code → air thấy thay đổi ngay
      - gocache:/root/.cache/go-build
    environment:
      NOTES_LOG_LEVEL: debug

volumes:
  gocache:
```

```bash
docker compose -f compose.yaml -f compose.dev.yaml up -d --build
docker compose logs -f api
```

```text
/_/--\ |_| |_| \_ v1.62.0, built with Go go1.24.13
watching .
watching migrations
!exclude tmp
building...
running...
{"time":"2026-09-26T10:23:14.69931154Z","level":"INFO","msg":"server khởi động","service":"notes-api","version":"dev","addr":":8080"}
```

Sửa `main.go` và lưu:

```text
main.go has changed
building...
running...
{"time":"2026-09-26T10:23:46.737857694Z","level":"INFO","msg":"server khởi động","service":"notes-api","version":"dev","addr":":8080"}
```

Thay đổi có hiệu lực sau **khoảng 2 giây**.

> ⚠️ air v1.62.0 là bản mới nhất còn hỗ trợ Go 1.24 (từ v1.63 cần Go 1.25). Trên Linux, file trong `tmp/` do container (root) tạo ra sẽ thuộc về root - thêm `tmp/` vào `.gitignore`, xóa bằng `sudo rm -rf tmp` hoặc chạy container dev với `user: "${UID}:${GID}"`.

**Bước 4 - README cho người mới** (đoạn quan trọng nhất!):

```markdown
## Chạy local

Yêu cầu: Docker Desktop (hoặc Docker Engine + Compose plugin), make

    cp .env.example .env
    make up          # API: http://localhost:8080  (lần đầu ~1 phút để tải image)
    make logs        # xem log
    make tools       # Adminer: http://localhost:8081
    make watch       # tự build lại khi sửa code
    make db-reset    # xóa sạch dữ liệu, chạy lại migration
```

Thời gian onboard từ "cả ngày cài đặt" xuống **5 phút** - và mọi người trong team chạy **đúng cùng một phiên bản** Postgres, cùng cấu hình.

**Kiến thức sử dụng**: Compose override file, `develop.watch`, bind mount + named volume cho Go build cache, `profiles`, Makefile + `.env`.

## ⚠️ Lỗi thường gặp

### Lỗi 1: `exec /app: no such file or directory` dù file có trong image

```text
exec /hello-api: no such file or directory
```

Binary được link **động** (cgo bật vì image build có gcc) nhưng image runtime là `scratch`/`distroless/static` không có thư viện C. ✅ `CGO_ENABLED=0` khi build (mục 6.2). Kiểm tra nhanh trên máy: `file app` phải có chữ `statically linked`.

### Lỗi 2: `exec format error`

```text
exec /notes-api: exec format error
```

Image **sai kiến trúc CPU** (build trên Mac M1 → arm64, chạy trên server amd64). ✅ Build đa nền tảng với `docker buildx build --platform linux/amd64,linux/arm64` (mục 13.2), hoặc chỉ định `--platform linux/amd64` khi build cho server.

### Lỗi 3: Sửa một dòng code mà build lại mất cả phút

```dockerfile
COPY . .                  # ❌ Code nằm TRƯỚC go mod download
RUN go mod download
```

✅ `COPY go.mod go.sum ./` → `RUN go mod download` → `COPY . .`, thêm cache mount (mục 5). Đo được: 26.7s → 2.6s.

### Lỗi 4: `COPY go.mod go.sum ./` báo `"/go.sum": not found`

```text
ERROR: failed to build: failed to solve: failed to compute cache key: failed to calculate checksum of ref ...: "/go.sum": not found
```

Project **chưa có dependency ngoài** nên chưa có file `go.sum`. ✅ Chỉ `COPY go.mod ./` (như `hello-api`), hoặc chạy `go mod tidy` để tạo `go.sum` khi đã có dependency. Nhớ **không** đưa `go.sum` vào `.dockerignore`.

### Lỗi 5: `docker stop` luôn mất đúng 10 giây, exit code 137

App không nhận được SIGTERM: dùng **shell form** / script thiếu `exec` / app không bắt tín hiệu (mục 8.3). ✅ `ENTRYPOINT ["/app"]` (exec form), `exec` trong script, `signal.NotifyContext(ctx, os.Interrupt, syscall.SIGTERM)` trong Go.

### Lỗi 6: App chạy nhưng `curl` từ máy thật bị `Connection reset by peer`

App lắng nghe `127.0.0.1:8080` **bên trong** container. ✅ Lắng nghe `":8080"` (tức `0.0.0.0`); muốn giới hạn thì dùng `-p 127.0.0.1:8080:8080` (mục 11.3).

### Lỗi 7: `open /data/...: permission denied`

Thư mục volume thuộc về root, app chạy non-root (mục 10.3). ✅ `COPY --chown=65532:65532` thư mục dữ liệu trong image (named volume); `--user "$(id -u):$(id -g)"` hoặc `chown` (bind mount). ❌ Không "sửa" bằng cách bỏ `USER nonroot`.

### Lỗi 8: `x509: certificate signed by unknown authority` / `unknown time zone`

Dùng `scratch` mà thiếu chứng chỉ CA / dữ liệu múi giờ (mục 7.2). ✅ `COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/` và `import _ "time/tzdata"` (hoặc `-tags timetzdata`) - hoặc dùng `distroless/static`.

### Lỗi 9: `docker compose down -v` "lỡ tay" xóa database

`-v` xóa **cả named volume**. ✅ Chỉ dùng `down` (không `-v`) hằng ngày; đặt lệnh xóa dữ liệu vào target riêng có tên rõ ràng (`make db-reset`); sao lưu volume định kỳ (mục 10.2). Ở production, database nên dùng dịch vụ có backup tự động (RDS, Cloud SQL...) thay vì container tự quản.

### Lỗi 10: API khởi động trước database rồi crash

`depends_on: [db]` (dạng ngắn) chỉ chờ container **start**, không chờ Postgres **sẵn sàng nhận kết nối**. ✅ `condition: service_healthy` + `healthcheck` cho `db`, **và** retry có backoff trong code Go (mục 12.4) - vì ngoài Compose không có `depends_on`.

### Lỗi 11: Image chứa bí mật

```dockerfile
ARG GITHUB_TOKEN                     # ❌ Hiện trong docker history
ENV DB_PASSWORD=super-secret         # ❌ Hiện trong docker inspect, nằm vĩnh viễn trong image
COPY . .                             # ❌ Không có .dockerignore → .env lọt vào image
```

✅ `RUN --mount=type=secret` cho bí mật lúc build; biến môi trường/secret manager lúc chạy; luôn có `.dockerignore`. Image đã push là **đã lộ** - phải đổi mật khẩu/thu hồi token ngay.

## 🏋️ Bài tập

### Bài tập 1: Đóng gói CLI tool (⭐ Dễ)

Lấy một chương trình CLI bạn đã viết ở [Bài 11](./11-files-json-cli.md) (ví dụ công cụ đọc CSV). Viết Dockerfile multi-stage dùng `scratch`, `ENTRYPOINT` là binary, sao cho chạy được:

```bash
docker run --rm -v "$(pwd)":/work -w /work mycli:1.0 --input data.csv
```

Yêu cầu: image dưới 5 MB, chạy bằng user không phải root, có `-version` in ra version nhúng bằng `-ldflags -X`. Ghi lại kích thước image khi dùng `golang`, `alpine`, `scratch`.

### Bài tập 2: Tìm lỗi Dockerfile (⭐ Dễ)

Dockerfile sau có **ít nhất 7 vấn đề**. Tìm và sửa tất cả, giải thích vì sao:

```dockerfile
FROM golang:latest
COPY . .
RUN go mod download
ENV DB_PASSWORD=admin123
RUN go build -o app .
RUN rm -rf /root/.cache
EXPOSE 8080
CMD ./app
```

<details>
<summary>💡 Gợi ý</summary>

`latest`, không multi-stage, thứ tự COPY phá cache, bí mật trong ENV, thiếu `CGO_ENABLED=0`/`-ldflags`, `rm` ở layer riêng không làm nhỏ image, shell form `CMD`, chạy bằng root, không `WORKDIR`, không `.dockerignore`...
</details>

### Bài tập 3: Container hóa Bookmark API của Bài 16 (⭐⭐ Trung bình)

- Viết `compose.yaml` cho Bookmark API ([Bài 16](./16-production-ready.md)) với named volume cho SQLite, `healthcheck` dùng chế độ `-healthcheck` (tự thêm vào `main.go`), `restart: unless-stopped`
- Cổng admin `:6060` (pprof, expvar) **chỉ** publish trên `127.0.0.1`
- `stop_grace_period: 20s` và kiểm tra bằng log rằng shutdown hoàn tất trước khi hết hạn
- Viết script sao lưu volume ra file `.tar.gz` có ngày giờ trong tên, và script khôi phục

### Bài tập 4: Thêm Redis cache vào stack Notes (⭐⭐ Trung bình)

- Thêm service `redis:8-alpine` vào `compose.yaml` với `healthcheck` (`redis-cli ping`), API `depends_on` Redis `service_healthy`
- `GET /v1/notes/{id}` đọc từ Redis trước (TTL 60 giây), không có mới đọc Postgres (dùng `github.com/redis/go-redis/v9` - chọn phiên bản còn hỗ trợ Go 1.24)
- `/readyz` kiểm tra cả Redis; khi Redis chết, API vẫn phục vụ được (chỉ chậm hơn) - chứng minh bằng `docker compose stop redis`
- Thêm header `X-Cache: HIT|MISS` để kiểm tra

### Bài tập 5: Pipeline phát hành hoàn chỉnh (⭐⭐⭐ Khó)

Trên một repo GitHub của bạn:
- Workflow CI (Bài 16) chạy test; workflow `docker.yml` (mục 13.4) chỉ chạy khi CI thành công
- Thêm bước quét Trivy cho image vừa build: **fail** nếu có lỗ hổng `CRITICAL`, xuất kết quả SARIF lên tab *Security* của GitHub
- Tag `v1.0.0` → image `ghcr.io/<bạn>/notes-api:1.0.0` và `:1.0` có cả amd64 + arm64. Kiểm tra bằng `docker buildx imagetools inspect`
- Build với Go bản mới nhất qua `--build-arg GO_VERSION=...` và so sánh số lỗ hổng trước/sau

### Bài tập 6: Zero-downtime deploy với reverse proxy (⭐⭐⭐ Khó)

- Thêm **Caddy** (hoặc Nginx) làm reverse proxy phía trước 2 bản sao API: `docker compose up -d --scale api=2` (bỏ `ports` của `api`, chỉ proxy publish cổng)
- Viết script deploy: build image mới → thay **từng** container một → chờ `/readyz` = 200 rồi mới thay container tiếp theo
- Viết chương trình Go gửi request liên tục (errgroup, [Bài 14](./14-advanced-concurrency.md)) trong lúc deploy và chứng minh **không có request nào lỗi**
- Kiểm tra khóa advisory: cả 2 bản sao khởi động cùng lúc, log cho thấy migration chỉ chạy **một lần**

## ✅ Checklist hoàn thành

- [ ] Giải thích được container khác VM thế nào; image, container, layer, registry là gì
- [ ] Cài Docker, chạy được `docker run hello-world`
- [ ] Dùng thành thạo `run` (`-d`, `-p`, `-e`, `--name`, `--rm`, `-v`), `ps`, `logs -f`, `exec -it`, `stop`, `rm`, `images`, `rmi`, `inspect`, `system prune`
- [ ] Viết Dockerfile hiểu từng lệnh; phân biệt `ARG`/`ENV`, `COPY`/`ADD`, `ENTRYPOINT`/`CMD`, exec form/shell form
- [ ] Viết `.dockerignore`, sắp xếp lệnh để tận dụng layer cache, dùng cache mount
- [ ] Viết multi-stage build với `CGO_ENABLED=0`, `-trimpath`, `-ldflags="-s -w -X main.version=..."`
- [ ] Chọn được base image phù hợp và biết 3 cái bẫy của `scratch` (CA, tzdata, user)
- [ ] Chạy container bằng user non-root, thêm `HEALTHCHECK` bằng chính binary Go
- [ ] App Go xử lý SIGTERM, `docker stop` tắt an toàn; hiểu vấn đề PID 1
- [ ] Dùng named volume, bind mount; sửa được lỗi `permission denied`; sao lưu volume
- [ ] Tạo network, gọi container khác bằng tên; hiểu bẫy `127.0.0.1` và `localhost` trong container
- [ ] Viết `compose.yaml` với `depends_on` + `healthcheck`, `.env`, volumes, networks, profiles
- [ ] Thiết lập hot reload bằng `docker compose watch` hoặc air
- [ ] Build image đa nền tảng với buildx; tag và push lên Docker Hub/GHCR
- [ ] Viết workflow GitHub Actions build & push image; quét lỗ hổng bằng Trivy/Scout
- [ ] Hoàn thành 3 ứng dụng thực tế và ít nhất 3 bài tập

## 🚀 Tiếp theo

Bạn đã có thể đóng gói bất kỳ service Go nào thành image nhỏ gọn, an toàn và chạy cả stack chỉ bằng một lệnh. Khi hệ thống lớn dần thành **nhiều service** (notes, users, notifications...) chạy trong các container riêng, câu hỏi tiếp theo là: **các service nói chuyện với nhau thế nào cho nhanh và chặt chẽ?** REST + JSON không còn là lựa chọn duy nhất:

- **Protocol Buffers**: định nghĩa API một lần, sinh code Go tự động, dữ liệu nhị phân nhỏ gọn
- **gRPC**: gọi hàm từ xa có kiểu chặt chẽ, streaming hai chiều, deadline và cancel xuyên service
- Interceptor (middleware của gRPC), health check chuẩn gRPC - và tất nhiên, đóng gói gRPC server vào Docker như bài này

**Bài tiếp theo**: [Bài 18: gRPC với Go](./18-grpc.md)

---

💡 **Tips ghi nhớ**:

- **Multi-stage + `CGO_ENABLED=0` + distroless** - công thức chuẩn cho image Go: vài MB, không shell, non-root
- **Ít thay đổi ở trên, hay thay đổi ở dưới** - `go.mod`/`go.sum` → `go mod download` → `COPY . .` → `go build`
- **Exec form + bắt SIGTERM** - `docker stop` phải tắt app trong vài trăm mili giây, không phải 10 giây
- **App lắng nghe `0.0.0.0`**, giới hạn truy cập ở `-p`
- **Dữ liệu vào volume**, cấu hình vào biến môi trường, bí mật không bao giờ vào image
- **Tên service là hostname** trong Compose; `depends_on` + `healthcheck` + retry trong code
- **Không `latest`** cho base image và cho deploy; build bằng Go còn được hỗ trợ; quét image định kỳ
