# 📚 Bài 13: Làm việc với Database

## 🎯 Mục tiêu bài học

- Hiểu **database quan hệ** là gì và tại sao cần nó thay vì lưu file JSON
- Viết được **SQL cơ bản**: `CREATE TABLE`, `INSERT`, `SELECT`, `UPDATE`, `DELETE`, `GROUP BY`, `JOIN`, `INDEX`
- Kết nối database từ Go với **`database/sql`** và driver SQLite thuần Go (không cần cgo)
- Hiểu **connection pool** và cấu hình nó đúng cách
- Dùng thành thạo `ExecContext`, `QueryRowContext`, `QueryContext` - và **không bao giờ quên** `rows.Close()`, `rows.Err()`
- Xử lý `sql.ErrNoRows` và giá trị **NULL**
- Dùng **transaction** để đảm bảo "hoặc tất cả, hoặc không gì cả"
- Phòng chống **SQL injection** bằng placeholder
- Tổ chức code theo **repository pattern**, quản lý schema bằng **migration**, viết **test với database tạm**
- Biết khi nào dùng **sqlx**, **sqlc**, **GORM**, **pgx/PostgreSQL**
- Xây dựng **hệ thống quản lý đơn hàng** (transaction trừ tồn kho) và **báo cáo doanh thu theo tháng**

## 📖 1. Database là gì? Tại sao không lưu file JSON?

Ở [Bài 10](./10-final-project.md) và [Bài 12](./12-http-apis.md), dữ liệu nằm trong `map` → tắt server là **mất sạch**. Bạn có thể nghĩ: "Ghi ra file JSON là xong!" ([Bài 11](./11-files-json-cli.md)). Nhưng khi ứng dụng lớn lên, file JSON gặp rất nhiều vấn đề:

| Vấn đề | File JSON | Database |
|--------|-----------|----------|
| 1 triệu đơn hàng, tìm đơn của khách X | Đọc **cả file** vào RAM rồi lọc | Dùng **index**, trả kết quả trong vài mili giây |
| 100 request cùng ghi một lúc | Ghi đè lẫn nhau, **mất dữ liệu** | Có cơ chế khóa, **an toàn** |
| Mất điện giữa lúc ghi | File **hỏng** | **Transaction** + nhật ký → không mất, không hỏng |
| "Doanh thu theo tháng của từng thành phố" | Tự viết code lặp, gom nhóm | Một câu **SQL** |
| Đơn hàng trỏ tới khách hàng đã bị xóa | Không ai ngăn | **Khóa ngoại** (foreign key) ngăn lại |

> 💡 **Ví von**: File JSON giống **cuốn sổ tay** - tiện khi ghi vài dòng. Database giống **thư viện có thủ thư**: sách được xếp theo hệ thống, có **mục lục** (index) tra cứu nhanh, thủ thư đảm bảo không ai lấy nhầm sách của người khác (concurrency) và mọi thay đổi đều được ghi sổ (transaction log).

### Database quan hệ (Relational Database)

Dữ liệu được tổ chức thành các **bảng** (table), giống sheet Excel:

```text
Bảng customers                          Bảng orders
┌────┬──────┬───────────────┬────────┐   ┌────┬─────────────┬─────────┬─────────┐
│ id │ name │ email         │ city   │   │ id │ customer_id │ total   │ status  │
├────┼──────┼───────────────┼────────┤   ├────┼─────────────┼─────────┼─────────┤
│ 1  │ An   │ an@mail.com   │ Hà Nội │◄──┤ 1  │ 1           │ 500000  │ paid    │
│ 2  │ Bình │ binh@mail.com │ TP.HCM │◄┐ │ 2  │ 1           │ 1200000 │ paid    │
└────┴──────┴───────────────┴────────┘ └─┤ 3  │ 2           │ 300000  │ pending │
                                          └────┴─────────────┴─────────┴─────────┘
```

- **Hàng** (row) = một bản ghi (một khách hàng). **Cột** (column) = một thuộc tính, có **kiểu** cố định
- **Khóa chính** (primary key, `id`): định danh **duy nhất** cho mỗi hàng
- **Khóa ngoại** (foreign key, `customer_id`): trỏ tới khóa chính của bảng khác → tạo **quan hệ** giữa các bảng
- **SQL** (Structured Query Language): ngôn ngữ để "hỏi" và thay đổi dữ liệu

### Các hệ quản trị database phổ biến

| Database | Đặc điểm | Dùng khi |
|----------|----------|----------|
| **SQLite** | Cả database là **một file**, không cần cài server | Học tập, app desktop/mobile, CLI, web nhỏ-vừa, test |
| **PostgreSQL** | Mạnh, chuẩn, nhiều tính năng (JSON, full-text search...) | **Lựa chọn mặc định** cho web backend |
| **MySQL/MariaDB** | Phổ biến, nhiều hosting hỗ trợ | Hệ thống có sẵn, WordPress... |

Bài này dùng **SQLite** vì bạn không phải cài gì cả - nhưng 95% kiến thức (SQL, `database/sql`, transaction, pattern) dùng y hệt cho PostgreSQL/MySQL. Mục 12 sẽ chỉ ra những điểm khác biệt.

## 📖 2. Chuẩn bị: SQLite driver thuần Go

### Kiến trúc `database/sql`

Go tách làm hai phần:

- **`database/sql`** (thư viện chuẩn): API **chung** cho mọi database - `Open`, `Query`, `Exec`, transaction, connection pool
- **Driver** (thư viện bên ngoài): "phiên dịch viên" cho **một loại** database cụ thể

> 💡 **Ví von**: `database/sql` là **ổ cắm điện chuẩn** trên tường. Driver là **phích cắm** của từng thiết bị. Đổi từ SQLite sang PostgreSQL chỉ cần **đổi phích cắm** (driver + chuỗi kết nối), phần lớn code giữ nguyên.

Ta dùng driver **`modernc.org/sqlite`** - SQLite được chuyển nguyên sang Go, **không cần cgo** (không cần cài trình biên dịch C như driver `mattn/go-sqlite3`), build chéo cho Windows/Linux/macOS dễ dàng.

### Tạo project

```bash
mkdir shop && cd shop
go mod init shop
go get modernc.org/sqlite
```

> ⚠️ **Lưu ý phiên bản**: Các bản `modernc.org/sqlite` mới nhất yêu cầu Go 1.25+. Nếu bạn dùng Go 1.24 và đặt `GOTOOLCHAIN=local`, hãy ghim phiên bản tương thích: `go get modernc.org/sqlite@v1.46.1`. (Với thiết lập mặc định `GOTOOLCHAIN=auto`, lệnh `go` sẽ tự tải toolchain mới hơn khi cần.) Toàn bộ ví dụ trong bài đã được kiểm tra với Go 1.24 + `modernc.org/sqlite v1.46.1`.

### Kết nối đầu tiên

```go
package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite" // Import "trống" (_): chỉ để driver TỰ ĐĂNG KÝ tên "sqlite" với database/sql
)

func main() {
	dir, _ := os.MkdirTemp("", "bai13-*")
	defer os.RemoveAll(dir)
	path := filepath.Join(dir, "shop.db")

	// Chuỗi kết nối (DSN) + các tùy chọn quan trọng cho SQLite:
	//   foreign_keys(1)  : BẬT kiểm tra khóa ngoại (SQLite mặc định TẮT!)
	//   busy_timeout(5000): khi DB đang bị khóa, chờ tối đa 5 giây thay vì báo lỗi ngay
	//   _time_format=sqlite: lưu time.Time theo định dạng SQLite hiểu được
	dsn := "file:" + path + "?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)&_time_format=sqlite"

	db, err := sql.Open("sqlite", dsn) // ⚠️ Open CHƯA kết nối - chỉ kiểm tra tham số
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil { // Ping mới THẬT SỰ kết nối
		log.Fatal("không kết nối được database:", err)
	}
	fmt.Println("✅ Kết nối thành công!")

	var version string
	db.QueryRowContext(ctx, "SELECT sqlite_version()").Scan(&version)
	fmt.Println("SQLite phiên bản:", version)

	info, _ := os.Stat(path)
	fmt.Println("File database đã được tạo:", info.Name())
}

// Output:
// ✅ Kết nối thành công!
// SQLite phiên bản: 3.51.2
// File database đã được tạo: shop.db
```

(Phiên bản SQLite phụ thuộc phiên bản driver bạn cài.)

**Những điều cần nhớ**:

- **`import _ "modernc.org/sqlite"`**: dấu `_` nghĩa là "import chỉ để chạy hàm `init()` của package". Hàm `init` đó gọi `sql.Register("sqlite", ...)`. Thiếu dòng này → lỗi `sql: unknown driver "sqlite"`
- **`sql.Open` không kết nối**, nó chỉ chuẩn bị. Lỗi sai mật khẩu, sai địa chỉ chỉ lộ ra khi `Ping` hoặc query đầu tiên → luôn `PingContext` lúc khởi động để "fail fast"
- **`*sql.DB` không phải một kết nối** mà là một **bể kết nối** (pool) - xem mục 4

## 📖 3. SQL cơ bản cho người mới ⭐

Phần này dạy SQL "thuần". Ở cuối mục có chương trình Go chạy **toàn bộ** các câu lệnh để bạn tự thử - đừng lo nếu chưa hiểu code Go của nó, mục 4 sẽ giải thích chi tiết.

### 3.1. `CREATE TABLE` - Tạo bảng

```sql
CREATE TABLE customers (
    id    INTEGER PRIMARY KEY,   -- Khóa chính, SQLite tự tăng 1, 2, 3...
    name  TEXT NOT NULL,         -- NOT NULL: bắt buộc có giá trị
    email TEXT NOT NULL UNIQUE,  -- UNIQUE: không được trùng
    city  TEXT                   -- Cho phép NULL (không có giá trị)
);

CREATE TABLE orders (
    id          INTEGER PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id), -- Khóa ngoại
    total       INTEGER NOT NULL CHECK (total >= 0),       -- CHECK: ràng buộc tự định nghĩa
    status      TEXT NOT NULL DEFAULT 'pending',           -- Giá trị mặc định
    created_at  TEXT NOT NULL
);
```

**Ràng buộc (constraint)** là "luật" database **tự động** bảo vệ: bạn có viết code sai thì database vẫn không cho dữ liệu sai lọt vào. Đây là lớp phòng thủ cuối cùng.

### 3.2. `INSERT` - Thêm dữ liệu

```sql
INSERT INTO customers (name, email, city) VALUES
    ('An',   'an@mail.com',   'Hà Nội'),
    ('Bình', 'binh@mail.com', 'TP.HCM'),
    ('Chi',  'chi@mail.com',  NULL);

INSERT INTO orders (customer_id, total, status, created_at) VALUES
    (1, 500000,  'paid',      '2026-09-01'),
    (1, 1200000, 'paid',      '2026-09-15'),
    (2, 300000,  'pending',   '2026-09-20'),
    (2, 90000,   'cancelled', '2026-09-21');
```

### 3.3. `SELECT` - Đọc dữ liệu

```sql
SELECT * FROM customers;   -- * = mọi cột
```

```text
id  name  email          city
1   An    an@mail.com    Hà Nội
2   Bình  binh@mail.com  TP.HCM
3   Chi   chi@mail.com   NULL
```

```sql
-- WHERE: lọc | ORDER BY: sắp xếp (DESC = giảm dần) | Kiểm tra NULL phải dùng IS NULL / IS NOT NULL
SELECT name, city FROM customers WHERE city IS NOT NULL ORDER BY name DESC;
```

```text
name  city
Bình  TP.HCM
An    Hà Nội
```

```sql
-- Kết hợp điều kiện AND/OR, LIMIT: lấy tối đa N dòng
SELECT id, total FROM orders
WHERE total >= 300000 AND status <> 'cancelled'
ORDER BY total DESC LIMIT 2;
```

```text
id  total
2   1200000
1   500000
```

### 3.4. `UPDATE` và `DELETE` - Sửa và xóa

```sql
UPDATE orders SET status = 'paid' WHERE id = 3;         -- 1 dòng bị ảnh hưởng
DELETE FROM orders WHERE status = 'cancelled';          -- 1 dòng bị ảnh hưởng
```

> ⚠️ **CỰC KỲ QUAN TRỌNG**: `UPDATE` và `DELETE` **không có `WHERE`** sẽ tác động lên **TOÀN BỘ** bảng! `DELETE FROM orders;` xóa sạch mọi đơn hàng. Rất nhiều sự cố "mất dữ liệu" trong lịch sử đến từ việc quên `WHERE`. Mẹo: viết `SELECT ... WHERE ...` trước, kiểm tra kết quả đúng rồi mới đổi thành `DELETE`.

### 3.5. Hàm tổng hợp và `GROUP BY`

```sql
-- COUNT, SUM, AVG, MIN, MAX; GROUP BY: gom nhóm theo cột
SELECT status, COUNT(*) AS so_don, SUM(total) AS doanh_thu
FROM orders GROUP BY status;
```

```text
status  so_don  doanh_thu
paid    3       2000000
```

### 3.6. `JOIN` - Kết hợp nhiều bảng

`JOIN` ghép các hàng của hai bảng dựa trên điều kiện (thường là khóa ngoại = khóa chính):

```sql
-- INNER JOIN (viết tắt JOIN): chỉ lấy các hàng CÓ cặp ở cả hai bảng
SELECT c.name, o.id AS order_id, o.total
FROM orders o
JOIN customers c ON c.id = o.customer_id
ORDER BY o.id;
```

```text
name  order_id  total
An    1         500000
An    2         1200000
Bình  3         300000
```

```sql
-- LEFT JOIN: lấy MỌI hàng của bảng trái, bên phải không có thì là NULL
-- COALESCE(x, 0): nếu x là NULL thì dùng 0
SELECT c.name, COUNT(o.id) AS so_don, COALESCE(SUM(o.total), 0) AS tong_chi
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id
ORDER BY tong_chi DESC;
```

```text
name  so_don  tong_chi
An    2       1700000
Bình  1       300000
Chi   0       0
```

> 💡 **Ví von JOIN**: Bạn có danh sách **học sinh** và danh sách **bài kiểm tra**. `INNER JOIN` = "cho tôi xem những học sinh **đã làm** bài". `LEFT JOIN` = "cho tôi xem **tất cả** học sinh, ai chưa làm bài thì để trống" - rất hữu ích để tìm "khách hàng chưa mua gì", "sản phẩm chưa bán được".

### 3.7. `INDEX` - Mục lục để tìm nhanh

Không có index, để tìm `WHERE customer_id = 1`, database phải **quét toàn bộ bảng** (`SCAN`). Với 10 triệu đơn hàng, việc này rất chậm. **Index** giống **mục lục** cuối sách: tra "customer 1" → biết ngay nằm ở những dòng nào.

```sql
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE customer_id = 1;
-- SCAN orders                             ← Quét cả bảng 😰

CREATE INDEX idx_orders_customer ON orders(customer_id);

EXPLAIN QUERY PLAN SELECT * FROM orders WHERE customer_id = 1;
-- SEARCH orders USING INDEX idx_orders_customer (customer_id=?)   ← Dùng mục lục 🚀
```

**Khi nào tạo index?**

- ✅ Cột hay xuất hiện trong `WHERE`, `JOIN ... ON`, `ORDER BY` (đặc biệt là **khóa ngoại**)
- ✅ Cột `UNIQUE` và `PRIMARY KEY` **tự động** có index
- ⚠️ Index không miễn phí: tốn dung lượng và làm `INSERT`/`UPDATE` **chậm hơn** (phải cập nhật cả mục lục). Đừng index mọi cột

### 3.8. Chạy thử toàn bộ bằng Go - "SQL playground"

Chương trình dưới đây chạy lần lượt mọi câu lệnh ở trên (trên database trong bộ nhớ) và in kết quả dạng bảng. Hãy sửa `script` để tự thử các câu SQL khác!

```go
package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"
	"text/tabwriter"

	_ "modernc.org/sqlite"
)

var script = []string{
	`CREATE TABLE customers (
		id    INTEGER PRIMARY KEY,
		name  TEXT NOT NULL,
		email TEXT NOT NULL UNIQUE,
		city  TEXT
	)`,
	`CREATE TABLE orders (
		id          INTEGER PRIMARY KEY,
		customer_id INTEGER NOT NULL REFERENCES customers(id),
		total       INTEGER NOT NULL CHECK (total >= 0),
		status      TEXT NOT NULL DEFAULT 'pending',
		created_at  TEXT NOT NULL
	)`,
	`INSERT INTO customers (name, email, city) VALUES
		('An', 'an@mail.com', 'Hà Nội'), ('Bình', 'binh@mail.com', 'TP.HCM'), ('Chi', 'chi@mail.com', NULL)`,
	`INSERT INTO orders (customer_id, total, status, created_at) VALUES
		(1, 500000, 'paid', '2026-09-01'), (1, 1200000, 'paid', '2026-09-15'),
		(2, 300000, 'pending', '2026-09-20'), (2, 90000, 'cancelled', '2026-09-21')`,
	`UPDATE orders SET status = 'paid' WHERE id = 3`,
	`DELETE FROM orders WHERE status = 'cancelled'`,
	`SELECT c.name, COUNT(o.id) AS so_don, COALESCE(SUM(o.total), 0) AS tong_chi
		FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
		GROUP BY c.id ORDER BY tong_chi DESC`,
	`EXPLAIN QUERY PLAN SELECT * FROM orders WHERE customer_id = 1`,
	`CREATE INDEX idx_orders_customer ON orders(customer_id)`,
	`EXPLAIN QUERY PLAN SELECT * FROM orders WHERE customer_id = 1`,
	`INSERT INTO customers (name, email) VALUES ('Dũng', 'an@mail.com')`,                  // Trùng email → lỗi UNIQUE
	`INSERT INTO orders (customer_id, total, created_at) VALUES (99, 1000, '2026-09-25')`, // Khách 99 không tồn tại
	`INSERT INTO orders (customer_id, total, created_at) VALUES (1, -5, '2026-09-25')`,    // Vi phạm CHECK
}

func main() {
	// ":memory:" = database nằm trong RAM, mất khi tắt chương trình - rất tiện để thử nghiệm
	db, err := sql.Open("sqlite", ":memory:?_pragma=foreign_keys(1)")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1) // Với ":memory:", MỖI kết nối là một DB riêng → chỉ dùng 1 kết nối

	for _, q := range script {
		oneLine := []rune(strings.Join(strings.Fields(q), " ")) // Gộp về một dòng, cắt theo rune (không cắt đôi chữ có dấu)
		fmt.Println("sql>", string(oneLine[:min(len(oneLine), 45)])+"...")
		if err := run(db, q); err != nil {
			fmt.Println("❌", err)
		}
	}
}

// run thực thi một câu lệnh; nếu là SELECT/EXPLAIN thì in kết quả dạng bảng
func run(db *sql.DB, q string) error {
	switch strings.ToUpper(strings.Fields(q)[0]) {
	case "SELECT", "EXPLAIN":
	case "INSERT", "UPDATE", "DELETE":
		res, err := db.Exec(q)
		if err != nil {
			return err
		}
		n, _ := res.RowsAffected()
		fmt.Printf("OK, %d dòng bị ảnh hưởng\n", n)
		return nil
	default: // CREATE, DROP...
		_, err := db.Exec(q)
		if err == nil {
			fmt.Println("OK")
		}
		return err
	}

	rows, err := db.Query(q)
	if err != nil {
		return err
	}
	defer rows.Close()

	cols, err := rows.Columns() // Tên các cột - biết được lúc chạy
	if err != nil {
		return err
	}
	explain := cols[len(cols)-1] == "detail" // EXPLAIN: chỉ in cột "detail" cho gọn
	tw := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	if !explain {
		fmt.Fprintln(tw, strings.Join(cols, "\t"))
	}
	vals := make([]any, len(cols)) // Không biết trước kiểu → quét vào []any
	ptrs := make([]any, len(cols))
	for i := range vals {
		ptrs[i] = &vals[i]
	}
	for rows.Next() {
		if err := rows.Scan(ptrs...); err != nil {
			return err
		}
		if explain {
			fmt.Fprintln(tw, "  ", vals[len(vals)-1])
			continue
		}
		cells := make([]string, len(vals))
		for i, v := range vals {
			cells[i] = fmt.Sprint(v)
			if v == nil {
				cells[i] = "NULL"
			}
		}
		fmt.Fprintln(tw, strings.Join(cells, "\t"))
	}
	tw.Flush()
	return rows.Err()
}

// Output:
// sql> CREATE TABLE customers ( id INTEGER PRIMARY K...
// OK
// sql> CREATE TABLE orders ( id INTEGER PRIMARY KEY,...
// OK
// sql> INSERT INTO customers (name, email, city) VAL...
// OK, 3 dòng bị ảnh hưởng
// sql> INSERT INTO orders (customer_id, total, statu...
// OK, 4 dòng bị ảnh hưởng
// sql> UPDATE orders SET status = 'paid' WHERE id = ...
// OK, 1 dòng bị ảnh hưởng
// sql> DELETE FROM orders WHERE status = 'cancelled'...
// OK, 1 dòng bị ảnh hưởng
// sql> SELECT c.name, COUNT(o.id) AS so_don, COALESC...
// name  so_don  tong_chi
// An    2       1700000
// Bình  1       300000
// Chi   0       0
// sql> EXPLAIN QUERY PLAN SELECT * FROM orders WHERE...
//    SCAN orders
// sql> CREATE INDEX idx_orders_customer ON orders(cu...
// OK
// sql> EXPLAIN QUERY PLAN SELECT * FROM orders WHERE...
//    SEARCH orders USING INDEX idx_orders_customer (customer_id=?)
// sql> INSERT INTO customers (name, email) VALUES ('...
// ❌ constraint failed: UNIQUE constraint failed: customers.email (2067)
// sql> INSERT INTO orders (customer_id, total, creat...
// ❌ constraint failed: FOREIGN KEY constraint failed (787)
// sql> INSERT INTO orders (customer_id, total, creat...
// ❌ constraint failed: CHECK constraint failed: total >= 0 (275)
```

Ba dòng cuối cho thấy **ràng buộc** hoạt động: database từ chối dữ liệu sai dù code có lỗi.

## 📖 4. `database/sql` - Các thao tác cốt lõi ⭐

### 4.1. `*sql.DB` là một connection pool

> 💡 **Ví von**: `*sql.DB` giống **quầy thuê xe đạp** có sẵn N chiếc xe (kết nối). Mỗi query **mượn** một chiếc, chạy xong **trả lại** quầy. Mở kết nối mới tới database tốn thời gian (bắt tay mạng, xác thực), nên dùng lại xe cũ nhanh hơn nhiều.

Hệ quả quan trọng:

- ✅ Tạo `*sql.DB` **một lần** khi khởi động, dùng chung cho toàn bộ ứng dụng (an toàn cho nhiều goroutine)
- ❌ **Không** `sql.Open` + `db.Close()` trong mỗi request/hàm
- ⚠️ Mỗi `rows` chưa `Close()` là một chiếc xe **chưa trả** → hết xe → mọi query khác phải **chờ mãi mãi**

Cấu hình pool (quan trọng với PostgreSQL/MySQL):

```go
db.SetMaxOpenConns(25)                  // Tối đa 25 kết nối cùng lúc (mặc định: không giới hạn!)
db.SetMaxIdleConns(25)                  // Giữ tối đa 25 kết nối rảnh để dùng lại (mặc định chỉ 2)
db.SetConnMaxLifetime(30 * time.Minute) // Làm mới kết nối định kỳ (hợp với load balancer, failover)
db.SetConnMaxIdleTime(5 * time.Minute)  // Đóng kết nối rảnh quá lâu

stats := db.Stats() // Theo dõi: stats.InUse, stats.Idle, stats.WaitCount...
```

> 💡 **Với SQLite**: chỉ **một** thao tác ghi được thực hiện tại một thời điểm. Ứng dụng đơn giản nên đặt `db.SetMaxOpenConns(1)` cho an toàn. PostgreSQL thì cho phép nhiều kết nối ghi song song.

### 4.2. Ba "động từ" chính

| Hàm | Dùng cho | Trả về |
|-----|----------|--------|
| `ExecContext` | `INSERT`, `UPDATE`, `DELETE`, `CREATE`... (không lấy dữ liệu về) | `sql.Result` (`LastInsertId`, `RowsAffected`) |
| `QueryRowContext` | `SELECT` trả về **tối đa 1 dòng** | `*sql.Row` → `.Scan(...)` |
| `QueryContext` | `SELECT` trả về **nhiều dòng** | `*sql.Rows` → lặp `Next()` + `Scan()` |

Luôn dùng phiên bản `...Context` và truyền `ctx` (thường là `r.Context()` của HTTP request) → khi người dùng hủy request hoặc hết timeout, query cũng được **hủy theo**, không chạy vô ích.

```go
package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"

	_ "modernc.org/sqlite"
)

type Product struct {
	ID    int64
	Name  string
	Price int64 // Tiền: luôn dùng số nguyên (đồng)
	Stock int
}

// listInStock đọc NHIỀU dòng - mẫu chuẩn với QueryContext
func listInStock(ctx context.Context, db *sql.DB) ([]Product, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT id, name, price, stock FROM products WHERE stock > ? ORDER BY price DESC`, 0)
	if err != nil {
		return nil, err
	}
	defer rows.Close() // ❗ 1. LUÔN đóng rows - trả kết nối về pool

	var out []Product
	for rows.Next() { // 2. Lặp từng dòng
		var p Product
		// Scan theo ĐÚNG THỨ TỰ cột trong SELECT
		if err := rows.Scan(&p.ID, &p.Name, &p.Price, &p.Stock); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err() // ❗ 3. LUÔN kiểm tra lỗi xảy ra TRONG LÚC lặp
}

func main() {
	ctx := context.Background()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)

	// ===== ExecContext: tạo bảng =====
	_, err = db.ExecContext(ctx, `CREATE TABLE products (
		id    INTEGER PRIMARY KEY,
		name  TEXT NOT NULL,
		price INTEGER NOT NULL CHECK (price >= 0),
		stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0)
	)`)
	if err != nil {
		log.Fatal(err)
	}

	// ===== ExecContext: INSERT với placeholder ? =====
	var lastID int64
	for _, p := range []Product{
		{Name: "Bàn phím", Price: 1_250_000, Stock: 10},
		{Name: "Chuột", Price: 350_000, Stock: 25},
		{Name: "Tai nghe", Price: 890_000, Stock: 0},
	} {
		res, err := db.ExecContext(ctx,
			`INSERT INTO products (name, price, stock) VALUES (?, ?, ?)`, p.Name, p.Price, p.Stock)
		if err != nil {
			log.Fatal(err)
		}
		lastID, _ = res.LastInsertId() // id vừa được tạo
	}
	fmt.Println("id cuối cùng vừa thêm:", lastID)

	// ===== QueryRowContext: đọc 1 dòng =====
	var p Product
	err = db.QueryRowContext(ctx, `SELECT id, name, price, stock FROM products WHERE id = ?`, 1).
		Scan(&p.ID, &p.Name, &p.Price, &p.Stock)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Sản phẩm 1: %+v\n", p)

	// ===== sql.ErrNoRows: không tìm thấy KHÔNG phải lỗi hệ thống =====
	var name string
	err = db.QueryRowContext(ctx, `SELECT name FROM products WHERE id = ?`, 999).Scan(&name)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		fmt.Println("Không có sản phẩm id=999")
	case err != nil:
		log.Fatal(err) // Lỗi thật (mất kết nối, sai SQL...)
	}

	// ===== QueryContext: đọc nhiều dòng =====
	products, err := listInStock(ctx, db)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("Còn hàng:")
	for _, p := range products {
		fmt.Printf("  #%d %-10s %9d đ  (kho: %d)\n", p.ID, p.Name, p.Price, p.Stock)
	}

	// ===== UPDATE + RowsAffected =====
	res, err := db.ExecContext(ctx, `UPDATE products SET price = price * 90 / 100 WHERE stock > ?`, 5)
	if err != nil {
		log.Fatal(err)
	}
	n, _ := res.RowsAffected() // Số dòng bị thay đổi
	fmt.Println("Giảm giá 10% cho", n, "sản phẩm")

	// ===== DELETE =====
	res, _ = db.ExecContext(ctx, `DELETE FROM products WHERE stock = 0`)
	n, _ = res.RowsAffected()
	fmt.Println("Đã xóa", n, "sản phẩm hết hàng")

	// ===== Giá trị tổng hợp =====
	var count int
	var total int64
	db.QueryRowContext(ctx, `SELECT COUNT(*), SUM(price * stock) FROM products`).Scan(&count, &total)
	fmt.Printf("Còn %d sản phẩm, giá trị tồn kho: %d đ\n", count, total)
}

// Output:
// id cuối cùng vừa thêm: 3
// Sản phẩm 1: {ID:1 Name:Bàn phím Price:1250000 Stock:10}
// Không có sản phẩm id=999
// Còn hàng:
//   #1 Bàn phím     1250000 đ  (kho: 10)
//   #2 Chuột         350000 đ  (kho: 25)
// Giảm giá 10% cho 2 sản phẩm
// Đã xóa 1 sản phẩm hết hàng
// Còn 2 sản phẩm, giá trị tồn kho: 19125000 đ
```

**Ba quy tắc vàng với `rows`** (hãy thuộc lòng):

1. `defer rows.Close()` **ngay** sau khi kiểm tra `err` của `QueryContext`
2. Lặp bằng `for rows.Next()`
3. Kiểm tra `rows.Err()` sau vòng lặp - `Next()` trả `false` có thể do **lỗi** (mất kết nối giữa chừng), không chỉ do hết dữ liệu

> 💡 Với `QueryRowContext`, bạn **không cần** `Close` - `Scan` tự đóng. Lỗi của câu query (nếu có) cũng được trả về ở `Scan`.

### 4.3. Placeholder: `?` hay `$1`?

Mỗi database dùng ký hiệu placeholder khác nhau - `database/sql` **không** tự chuyển đổi:

| Database | Placeholder |
|----------|-------------|
| SQLite, MySQL | `?` |
| PostgreSQL | `$1`, `$2`, `$3`... |
| SQL Server | `@p1` hoặc `@name` |

## 📖 5. Xử lý NULL

`NULL` trong SQL nghĩa là "**không có giá trị**" - khác với chuỗi rỗng `""` hay số `0`. Ví dụ: khách hàng **chưa cung cấp** số điện thoại (NULL) khác với khách **cố tình để trống** (`""`).

Vấn đề: kiểu `string` của Go **không thể** chứa NULL. `Scan` một NULL vào `string` sẽ báo lỗi:

```go
package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "modernc.org/sqlite"
)

func main() {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)

	db.Exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, phone TEXT, age INTEGER)`)
	db.Exec(`INSERT INTO users (name, phone, age) VALUES (?, ?, ?)`, "An", "0901234567", 25)
	// Ghi NULL: truyền nil (hoặc sql.NullString{Valid: false})
	db.Exec(`INSERT INTO users (name, phone, age) VALUES (?, ?, ?)`, "Bình", nil, sql.NullInt64{})

	// ❌ Cách 1: Scan NULL vào string → lỗi
	var phone string
	err = db.QueryRow(`SELECT phone FROM users WHERE id = 2`).Scan(&phone)
	fmt.Println("Scan vào string:", err)

	// ✅ Cách 2: sql.NullString / sql.NullInt64 - có field Valid cho biết có giá trị hay không
	var ns sql.NullString
	db.QueryRow(`SELECT phone FROM users WHERE id = 2`).Scan(&ns)
	fmt.Printf("NullString: Valid=%v String=%q\n", ns.Valid, ns.String)

	// ✅ Cách 3: sql.Null[T] (Go 1.22+) - generic, dùng cho mọi kiểu
	var age sql.Null[int]
	db.QueryRow(`SELECT age FROM users WHERE id = 1`).Scan(&age)
	fmt.Printf("Null[int]: Valid=%v V=%d\n", age.Valid, age.V)

	// ✅ Cách 4: Con trỏ - nil nghĩa là NULL. Rất tiện khi xuất JSON (nil → null)
	var phonePtr *string
	db.QueryRow(`SELECT phone FROM users WHERE id = 2`).Scan(&phonePtr)
	fmt.Println("Con trỏ là nil:", phonePtr == nil)

	// ✅ Cách 5: Xử lý ngay trong SQL bằng COALESCE
	rows, _ := db.Query(`SELECT name, COALESCE(phone, 'chưa có'), COALESCE(age, 0) FROM users ORDER BY id`)
	defer rows.Close()
	for rows.Next() {
		var name, p string
		var a int
		rows.Scan(&name, &p, &a)
		fmt.Printf("%s | %s | %d\n", name, p, a)
	}
}

// Output:
// Scan vào string: sql: Scan error on column index 0, name "phone": converting NULL to string is unsupported
// NullString: Valid=false String=""
// Null[int]: Valid=true V=25
// Con trỏ là nil: true
// An | 0901234567 | 25
// Bình | chưa có | 0
```

**Chọn cách nào?**

- Thiết kế bảng với `NOT NULL` + `DEFAULT` **nhiều nhất có thể** → đỡ phải xử lý NULL
- Cột thật sự có thể trống → `sql.Null[T]` hoặc con trỏ (con trỏ tiện hơn khi trả JSON)
- Chỉ cần hiển thị → `COALESCE` trong SQL

## 📖 6. Prepared Statements

**Prepared statement** là câu SQL được database **phân tích và lên kế hoạch một lần**, sau đó chạy nhiều lần với tham số khác nhau.

> 💡 **Ví von**: Giống **khuôn bánh**. Làm khuôn một lần (Prepare), sau đó chỉ việc đổ bột (tham số) vào để ra bánh - không cần làm khuôn lại cho mỗi cái bánh.

Thực ra mọi query có placeholder (`?`) trong `database/sql` **đã tự động** được prepare ngầm. Tự gọi `PrepareContext` có ích khi bạn chạy **cùng một câu lệnh rất nhiều lần**, ví dụ nhập hàng nghìn dòng:

```go
package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

const n = 500

func insertOneByOne(ctx context.Context, db *sql.DB) error {
	for i := range n {
		// Mỗi lệnh là MỘT transaction riêng → mỗi lần SQLite phải ghi chắc chắn xuống đĩa
		if _, err := db.ExecContext(ctx, `INSERT INTO logs (msg) VALUES (?)`, fmt.Sprint("log ", i)); err != nil {
			return err
		}
	}
	return nil
}

func insertBatch(ctx context.Context, db *sql.DB) error {
	tx, err := db.BeginTx(ctx, nil) // Gom tất cả vào MỘT transaction (mục 7)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, `INSERT INTO logs (msg) VALUES (?)`) // Làm "khuôn" một lần
	if err != nil {
		return err
	}
	defer stmt.Close() // ❗ Statement cũng giữ tài nguyên → phải đóng

	for i := range n {
		if _, err := stmt.ExecContext(ctx, fmt.Sprint("log ", i)); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func main() {
	dir, _ := os.MkdirTemp("", "bai13-*")
	defer os.RemoveAll(dir)
	db, err := sql.Open("sqlite", "file:"+filepath.Join(dir, "bench.db"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)
	ctx := context.Background()
	db.ExecContext(ctx, `CREATE TABLE logs (id INTEGER PRIMARY KEY, msg TEXT NOT NULL)`)

	start := time.Now()
	if err := insertOneByOne(ctx, db); err != nil {
		log.Fatal(err)
	}
	slow := time.Since(start)

	start = time.Now()
	if err := insertBatch(ctx, db); err != nil {
		log.Fatal(err)
	}
	fast := time.Since(start)

	var count int
	db.QueryRowContext(ctx, `SELECT COUNT(*) FROM logs`).Scan(&count)
	fmt.Println("Tổng số dòng:", count)
	fmt.Println("Transaction + prepared nhanh hơn:", fast < slow)
	// Bỏ comment để xem thời gian trên máy bạn:
	// fmt.Printf("Từng lệnh: %v | Gom batch: %v (nhanh hơn %.0f lần)\n", slow, fast, float64(slow)/float64(fast))
}

// Output:
// Tổng số dòng: 1000
// Transaction + prepared nhanh hơn: true
```

Trên máy thông thường, cách gom batch nhanh hơn **hàng chục đến hàng trăm lần**. Lý do chính không phải prepare, mà là **transaction**: SQLite phải đảm bảo dữ liệu nằm chắc trên đĩa sau **mỗi** transaction - 500 transaction = 500 lần chờ ổ đĩa, 1 transaction = 1 lần.

## 📖 7. Transaction - "Hoặc tất cả, hoặc không gì cả" ⭐

### Vấn đề

Chuyển 300.000đ từ tài khoản An sang Bình cần **2 bước**:

1. Trừ 300.000đ của An
2. Cộng 300.000đ cho Bình

Nếu server **sập** (hoặc gặp lỗi) giữa bước 1 và 2 → tiền của An **biến mất** mà Bình không nhận được! 😱

> 💡 **Ví von ATM**: Rút tiền ở ATM gồm "trừ số dư" và "nhả tiền". Nếu máy kẹt tiền không nhả được, ngân hàng phải **hoàn lại** số dư như chưa có gì xảy ra. Transaction chính là cơ chế "**hoàn tác toàn bộ**" đó.

**Transaction** gom nhiều câu lệnh thành **một khối**: hoặc **tất cả** thành công (`COMMIT`), hoặc **tất cả** bị hủy như chưa từng chạy (`ROLLBACK`). Đây là chữ **A** (Atomicity) trong **ACID**:

| | Tính chất | Ý nghĩa |
|-|-----------|---------|
| **A** | Atomicity (nguyên tử) | Tất cả hoặc không gì cả |
| **C** | Consistency (nhất quán) | Dữ liệu luôn thỏa mọi ràng buộc (`CHECK`, `FOREIGN KEY`...) |
| **I** | Isolation (cô lập) | Các transaction chạy đồng thời không "nhìn thấy" trạng thái dở dang của nhau |
| **D** | Durability (bền vững) | Đã `COMMIT` là còn, kể cả mất điện ngay sau đó |

### Mẫu chuẩn trong Go

```go
tx, err := db.BeginTx(ctx, nil)
if err != nil {
	return err
}
defer tx.Rollback() // ⭐ An toàn: nếu đã Commit thì Rollback không làm gì cả

// ... các lệnh dùng tx.ExecContext / tx.QueryRowContext (KHÔNG dùng db.) ...
if err != nil {
	return err // → defer Rollback hủy mọi thay đổi
}

return tx.Commit()
```

```go
package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"

	_ "modernc.org/sqlite"
)

var ErrAccountNotFound = errors.New("tài khoản không tồn tại")

func transfer(ctx context.Context, db *sql.DB, from, to, amount int64) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Bước 1: trừ tiền. CHECK (balance >= 0) sẽ báo lỗi nếu không đủ tiền
	res, err := tx.ExecContext(ctx, `UPDATE accounts SET balance = balance - ? WHERE id = ?`, amount, from)
	if err != nil {
		return fmt.Errorf("trừ tiền: %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return fmt.Errorf("người gửi #%d: %w", from, ErrAccountNotFound)
	}

	// Bước 2: cộng tiền
	res, err = tx.ExecContext(ctx, `UPDATE accounts SET balance = balance + ? WHERE id = ?`, amount, to)
	if err != nil {
		return fmt.Errorf("cộng tiền: %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		// Bước 1 ĐÃ trừ tiền rồi! Nhờ transaction, return lỗi → Rollback → tiền được hoàn lại
		return fmt.Errorf("người nhận #%d: %w", to, ErrAccountNotFound)
	}

	// Bước 3: ghi lịch sử
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO transfers (from_id, to_id, amount) VALUES (?, ?, ?)`, from, to, amount); err != nil {
		return err
	}
	return tx.Commit()
}

func printBalances(db *sql.DB) {
	rows, err := db.Query(`SELECT name, balance FROM accounts ORDER BY id`)
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()
	for rows.Next() {
		var name string
		var bal int64
		rows.Scan(&name, &bal)
		fmt.Printf("   %s: %d đ\n", name, bal)
	}
}

func main() {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)
	ctx := context.Background()

	db.ExecContext(ctx, `
		CREATE TABLE accounts (
			id      INTEGER PRIMARY KEY,
			name    TEXT NOT NULL,
			balance INTEGER NOT NULL CHECK (balance >= 0)
		);
		CREATE TABLE transfers (
			id      INTEGER PRIMARY KEY,
			from_id INTEGER NOT NULL,
			to_id   INTEGER NOT NULL,
			amount  INTEGER NOT NULL CHECK (amount > 0)
		);
		INSERT INTO accounts (name, balance) VALUES ('An', 1000000), ('Bình', 200000);`)

	cases := []struct {
		desc           string
		from, to, amnt int64
	}{
		{"An chuyển Bình 300.000đ", 1, 2, 300_000},
		{"An chuyển Bình 5.000.000đ (không đủ tiền)", 1, 2, 5_000_000},
		{"An chuyển tài khoản #99 (không tồn tại)", 1, 99, 100_000},
	}
	for _, c := range cases {
		err := transfer(ctx, db, c.from, c.to, c.amnt)
		if err != nil {
			fmt.Printf("❌ %s\n   lỗi: %v\n", c.desc, err)
		} else {
			fmt.Printf("✅ %s\n", c.desc)
		}
		printBalances(db)
	}

	var count int
	db.QueryRowContext(ctx, `SELECT COUNT(*) FROM transfers`).Scan(&count)
	fmt.Println("Số giao dịch được ghi nhận:", count)
}

// Output:
// ✅ An chuyển Bình 300.000đ
//    An: 700000 đ
//    Bình: 500000 đ
// ❌ An chuyển Bình 5.000.000đ (không đủ tiền)
//    lỗi: trừ tiền: constraint failed: CHECK constraint failed: balance >= 0 (275)
//    An: 700000 đ
//    Bình: 500000 đ
// ❌ An chuyển tài khoản #99 (không tồn tại)
//    lỗi: người nhận #99: tài khoản không tồn tại
//    An: 700000 đ
//    Bình: 500000 đ
// Số giao dịch được ghi nhận: 1
```

Nhìn trường hợp 3: câu lệnh trừ tiền của An **đã chạy thành công**, nhưng vì người nhận không tồn tại nên transaction bị rollback → An vẫn còn **nguyên 700.000đ**. Không có transaction, An sẽ mất 100.000đ vào hư không!

### Hàm tiện ích `withTx`

Để không phải lặp lại `BeginTx`/`Rollback`/`Commit` ở khắp nơi:

```go
// withTx chạy fn trong một transaction: fn trả lỗi → rollback, không lỗi → commit
func withTx(ctx context.Context, db *sql.DB, fn func(tx *sql.Tx) error) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit()
}

// Dùng:
err := withTx(ctx, db, func(tx *sql.Tx) error {
	if _, err := tx.ExecContext(ctx, `UPDATE ...`); err != nil {
		return err
	}
	_, err := tx.ExecContext(ctx, `INSERT ...`)
	return err
})
```

Bạn sẽ thấy `withTx` được dùng trong Ứng dụng 1.

## 📖 8. SQL Injection - Lỗ hổng bảo mật số 1 ⚠️

### Tấn công như thế nào?

Nếu bạn **nối chuỗi** dữ liệu người dùng vào câu SQL, kẻ tấn công có thể "chèn" thêm lệnh SQL của họ:

```go
package main

import (
	"database/sql"
	"fmt"
	"log"
	"strings"

	_ "modernc.org/sqlite"
)

func main() {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)
	db.Exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, email TEXT, is_admin INTEGER)`)
	db.Exec(`INSERT INTO users (username, email, is_admin) VALUES
		('an', 'an@mail.com', 0), ('binh', 'binh@mail.com', 0), ('admin', 'boss@shop.vn', 1)`)

	// Người dùng nhập ô tìm kiếm - kẻ tấn công nhập chuỗi "ma thuật" này:
	input := "x' OR '1'='1"

	// ❌ NGUY HIỂM: nối chuỗi
	query := fmt.Sprintf("SELECT username, email FROM users WHERE username = '%s'", input)
	fmt.Println("SQL thực sự chạy:", query)
	printRows(db.Query(query))

	// ✅ AN TOÀN: placeholder - input luôn được coi là DỮ LIỆU, không bao giờ là lệnh SQL
	fmt.Println("Dùng placeholder:")
	printRows(db.Query("SELECT username, email FROM users WHERE username = ?", input))

	// ✅ Mệnh đề IN với số lượng tham số thay đổi: tự tạo "?, ?, ?"
	names := []string{"an", "admin"}
	placeholders := strings.TrimSuffix(strings.Repeat("?, ", len(names)), ", ")
	args := make([]any, len(names))
	for i, n := range names {
		args[i] = n
	}
	fmt.Println("IN (" + placeholders + "):")
	printRows(db.Query("SELECT username, email FROM users WHERE username IN ("+placeholders+") ORDER BY id", args...))

	// ✅ ORDER BY không dùng được placeholder → dùng DANH SÁCH TRẮNG (whitelist)
	sortInput := "email; DROP TABLE users" // Kẻ tấn công thử chèn vào tham số sắp xếp
	allowed := map[string]string{"name": "username", "email": "email"}
	col, ok := allowed[sortInput]
	if !ok {
		col = "id" // Không hợp lệ → dùng mặc định, KHÔNG BAO GIỜ đưa input vào SQL
	}
	fmt.Println("ORDER BY", col, ":")
	printRows(db.Query("SELECT username, email FROM users ORDER BY " + col + " LIMIT 1"))
}

func printRows(rows *sql.Rows, err error) {
	if err != nil {
		fmt.Println("   lỗi:", err)
		return
	}
	defer rows.Close()
	found := 0
	for rows.Next() {
		var u, e string
		rows.Scan(&u, &e)
		fmt.Printf("   %s <%s>\n", u, e)
		found++
	}
	if found == 0 {
		fmt.Println("   (không có kết quả)")
	}
}

// Output:
// SQL thực sự chạy: SELECT username, email FROM users WHERE username = 'x' OR '1'='1'
//    an <an@mail.com>
//    binh <binh@mail.com>
//    admin <boss@shop.vn>
// Dùng placeholder:
//    (không có kết quả)
// IN (?, ?):
//    an <an@mail.com>
//    admin <boss@shop.vn>
// ORDER BY id :
//    an <an@mail.com>
```

**Chuyện gì đã xảy ra?** Input `x' OR '1'='1` "đóng" dấu nháy của chuỗi và thêm điều kiện `OR '1'='1'` (luôn đúng) → câu lệnh trả về **toàn bộ** user, kể cả email của admin. Với form đăng nhập, kẻ tấn công có thể đăng nhập không cần mật khẩu; tệ hơn, có thể xóa cả database.

> ⚠️ **Quy tắc tuyệt đối**: **KHÔNG BAO GIỜ** dùng `fmt.Sprintf` hay `+` để đưa **dữ liệu** vào câu SQL. Luôn dùng placeholder `?` / `$1`. Phần duy nhất được ghép động là **tên cột/bảng**, và chỉ khi lấy từ **danh sách trắng** do bạn định nghĩa.

## 📖 9. Repository Pattern - Tổ chức code truy cập dữ liệu

### Vấn đề

Nếu câu SQL nằm rải rác trong HTTP handler, code sẽ:
- Khó test (test handler phải có database thật)
- Khó đổi database (SQLite → PostgreSQL phải sửa khắp nơi)
- Trộn lẫn "logic nghiệp vụ" với "chi tiết lưu trữ"

**Repository** là một lớp **chuyên** lo việc lưu/đọc dữ liệu, cung cấp các method có ý nghĩa nghiệp vụ (`GetByID`, `ListInStock`) và **giấu** SQL bên trong.

> 💡 **Ví von**: Repository là **thủ kho**. Nhân viên bán hàng (service/handler) chỉ nói "cho tôi 3 cái bàn phím" - không cần biết kho xếp hàng thế nào, ở kệ nào. Đổi kho mới (PostgreSQL) chỉ cần đổi thủ kho, nhân viên bán hàng vẫn làm việc như cũ.

```text
HTTP Handler  →  Service (nghiệp vụ)  →  Repository (interface)
                                              ↑ implement
                                   ┌──────────┴──────────┐
                           SQLiteProductRepo      MemoryProductRepo (cho test)
```

```go
package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"strings"

	_ "modernc.org/sqlite"
)

// ================= Domain: không biết gì về SQL =================

var (
	ErrNotFound  = errors.New("không tìm thấy")
	ErrDuplicate = errors.New("đã tồn tại")
)

type Product struct {
	ID    int64
	SKU   string
	Name  string
	Price int64
	Stock int
}

// ProductRepository là "hợp đồng" - service chỉ phụ thuộc vào interface này
type ProductRepository interface {
	Create(ctx context.Context, p *Product) error
	GetByID(ctx context.Context, id int64) (Product, error)
	List(ctx context.Context, limit, offset int) ([]Product, error)
	AdjustStock(ctx context.Context, id int64, delta int) error
}

// ================= Cài đặt bằng SQLite =================

const schema = `
CREATE TABLE IF NOT EXISTS products (
	id    INTEGER PRIMARY KEY,
	sku   TEXT NOT NULL UNIQUE,
	name  TEXT NOT NULL,
	price INTEGER NOT NULL CHECK (price >= 0),
	stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0)
);`

// OpenDB mở database, cấu hình và tạo bảng. Dùng chung cho main và test
func OpenDB(ctx context.Context, dsn string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, err
	}
	if _, err := db.ExecContext(ctx, schema); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

type SQLiteProductRepo struct {
	db *sql.DB
}

func NewSQLiteProductRepo(db *sql.DB) *SQLiteProductRepo {
	return &SQLiteProductRepo{db: db}
}

func (r *SQLiteProductRepo) Create(ctx context.Context, p *Product) error {
	res, err := r.db.ExecContext(ctx,
		`INSERT INTO products (sku, name, price, stock) VALUES (?, ?, ?, ?)`,
		p.SKU, p.Name, p.Price, p.Stock)
	if err != nil {
		if isUniqueViolation(err) {
			return fmt.Errorf("sku %q: %w", p.SKU, ErrDuplicate) // Dịch lỗi DB → lỗi domain
		}
		return err
	}
	p.ID, err = res.LastInsertId()
	return err
}

func (r *SQLiteProductRepo) GetByID(ctx context.Context, id int64) (Product, error) {
	var p Product
	err := r.db.QueryRowContext(ctx,
		`SELECT id, sku, name, price, stock FROM products WHERE id = ?`, id).
		Scan(&p.ID, &p.SKU, &p.Name, &p.Price, &p.Stock)
	if errors.Is(err, sql.ErrNoRows) {
		return Product{}, fmt.Errorf("sản phẩm #%d: %w", id, ErrNotFound) // Không để sql.ErrNoRows "rò" ra ngoài
	}
	return p, err
}

func (r *SQLiteProductRepo) List(ctx context.Context, limit, offset int) ([]Product, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, sku, name, price, stock FROM products ORDER BY id LIMIT ? OFFSET ?`, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Product{}
	for rows.Next() {
		var p Product
		if err := rows.Scan(&p.ID, &p.SKU, &p.Name, &p.Price, &p.Stock); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *SQLiteProductRepo) AdjustStock(ctx context.Context, id int64, delta int) error {
	res, err := r.db.ExecContext(ctx, `UPDATE products SET stock = stock + ? WHERE id = ?`, delta, id)
	if err != nil {
		return err // Vi phạm CHECK (stock >= 0) sẽ rơi vào đây
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return fmt.Errorf("sản phẩm #%d: %w", id, ErrNotFound)
	}
	return nil
}

// isUniqueViolation: mỗi driver báo lỗi khác nhau; cách đơn giản là kiểm tra thông điệp
// (driver modernc có kiểu *sqlite.Error với Code() để kiểm tra chính xác hơn)
func isUniqueViolation(err error) bool {
	return err != nil && strings.Contains(err.Error(), "UNIQUE constraint failed")
}

// ================= Service: chỉ biết interface =================

type InventoryService struct {
	repo ProductRepository
}

func (s *InventoryService) Restock(ctx context.Context, id int64, qty int) (Product, error) {
	if qty <= 0 {
		return Product{}, errors.New("số lượng nhập phải > 0")
	}
	if err := s.repo.AdjustStock(ctx, id, qty); err != nil {
		return Product{}, err
	}
	return s.repo.GetByID(ctx, id)
}

func main() {
	ctx := context.Background()
	db, err := OpenDB(ctx, ":memory:")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	repo := NewSQLiteProductRepo(db)
	svc := &InventoryService{repo: repo}

	for _, p := range []*Product{
		{SKU: "KB01", Name: "Bàn phím", Price: 1_250_000, Stock: 3},
		{SKU: "MS02", Name: "Chuột", Price: 350_000, Stock: 10},
		{SKU: "KB01", Name: "Bàn phím nhái", Price: 1, Stock: 1},
	} {
		if err := repo.Create(ctx, p); err != nil {
			fmt.Println("❌ Tạo:", err, "| là ErrDuplicate:", errors.Is(err, ErrDuplicate))
			continue
		}
		fmt.Printf("✅ Tạo #%d %s\n", p.ID, p.Name)
	}

	p, _ := svc.Restock(ctx, 1, 5)
	fmt.Printf("Nhập thêm hàng: %s còn %d\n", p.Name, p.Stock)

	_, err = repo.GetByID(ctx, 42)
	fmt.Println("Tìm #42:", err, "| là ErrNotFound:", errors.Is(err, ErrNotFound))

	err = repo.AdjustStock(ctx, 2, -100)
	fmt.Println("Xuất 100 cái chuột:", err)

	list, _ := repo.List(ctx, 10, 0)
	fmt.Println("Số sản phẩm:", len(list))
}

// Output:
// ✅ Tạo #1 Bàn phím
// ✅ Tạo #2 Chuột
// ❌ Tạo: sku "KB01": đã tồn tại | là ErrDuplicate: true
// Nhập thêm hàng: Bàn phím còn 8
// Tìm #42: sản phẩm #42: không tìm thấy | là ErrNotFound: true
// Xuất 100 cái chuột: constraint failed: CHECK constraint failed: stock >= 0 (275)
// Số sản phẩm: 2
```

**Điểm mấu chốt**:

- Tầng trên (service, handler) **không** import `database/sql`, chỉ làm việc với `ProductRepository` và lỗi domain (`ErrNotFound`, `ErrDuplicate`)
- Repository **dịch** lỗi của database sang lỗi domain → handler dễ dàng map `ErrNotFound` → HTTP 404, `ErrDuplicate` → 409 ([Bài 12](./12-http-apis.md))
- Test service có thể dùng một `MemoryProductRepo` giả (map + mutex) - nhanh, không cần database

> 💡 **Interface nhỏ, định nghĩa ở nơi dùng**: Nếu service chỉ cần `GetByID` và `AdjustStock`, nó có thể tự định nghĩa interface 2 method đó ([Bài 6](./06-structs-methods-interfaces.md)).

## 📖 10. Migration - Quản lý thay đổi schema

### Vấn đề

Ứng dụng phát triển → cấu trúc bảng thay đổi: thêm cột `sku`, thêm bảng `orders`, thêm index... Làm sao để database trên máy bạn, máy đồng nghiệp, server staging, server production đều có **cùng cấu trúc**, và nâng cấp **tự động** khi deploy?

**Migration** là các file SQL được **đánh số thứ tự**, mỗi file mô tả **một bước thay đổi**. Database lưu lại bảng `schema_migrations` ghi nhớ "đã chạy tới bước nào". Khi khởi động, ứng dụng chạy các bước **chưa chạy**.

> 💡 **Ví von**: Migration giống **Git cho cấu trúc database**. Mỗi file là một "commit". Máy nào đang ở commit 2 thì chỉ cần chạy tiếp commit 3, 4 để bắt kịp.

### Migration runner tự viết với `embed`

Cấu trúc thư mục:

```text
migrate-demo/
├── go.mod
├── main.go
├── migrate.go
└── migrations/
    ├── 001_create_products.sql
    ├── 002_create_orders.sql
    └── 003_add_product_category.sql
```

**`migrations/001_create_products.sql`**:

```sql
CREATE TABLE products (
    id    INTEGER PRIMARY KEY,
    name  TEXT NOT NULL,
    price INTEGER NOT NULL CHECK (price >= 0)
);
```

**`migrations/002_create_orders.sql`**:

```sql
CREATE TABLE orders (
    id         INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id),
    qty        INTEGER NOT NULL CHECK (qty > 0)
);
CREATE INDEX idx_orders_product ON orders(product_id);
```

**`migrations/003_add_product_category.sql`**:

```sql
ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT 'khác';
```

**`migrate.go`**:

```go
package main

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"io/fs"
	"strconv"
	"strings"
)

// Nhúng mọi file .sql vào trong file binary lúc build → deploy chỉ cần MỘT file chạy
//
//go:embed migrations/*.sql
var migrationFS embed.FS

// Migrate chạy các migration chưa được áp dụng, theo thứ tự tên file
func Migrate(ctx context.Context, db *sql.DB) ([]string, error) {
	_, err := db.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (
		version    INTEGER PRIMARY KEY,
		name       TEXT NOT NULL,
		applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
	)`)
	if err != nil {
		return nil, err
	}

	entries, err := fs.ReadDir(migrationFS, "migrations") // Đã sắp xếp theo tên: 001, 002, 003...
	if err != nil {
		return nil, err
	}

	var applied []string
	for _, e := range entries {
		name := e.Name()
		prefix, _, _ := strings.Cut(name, "_")
		version, err := strconv.Atoi(prefix)
		if err != nil {
			return applied, fmt.Errorf("tên migration sai định dạng %q (cần NNN_mo_ta.sql)", name)
		}

		var done bool
		err = db.QueryRowContext(ctx,
			`SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = ?)`, version).Scan(&done)
		if err != nil {
			return applied, err
		}
		if done {
			continue // Đã chạy từ trước → bỏ qua
		}

		script, err := migrationFS.ReadFile("migrations/" + name)
		if err != nil {
			return applied, err
		}

		// Mỗi migration chạy trong MỘT transaction: lỗi giữa chừng → không để lại schema "dở dang"
		tx, err := db.BeginTx(ctx, nil)
		if err != nil {
			return applied, err
		}
		if _, err := tx.ExecContext(ctx, string(script)); err != nil {
			tx.Rollback()
			return applied, fmt.Errorf("migration %s: %w", name, err)
		}
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO schema_migrations (version, name) VALUES (?, ?)`, version, name); err != nil {
			tx.Rollback()
			return applied, err
		}
		if err := tx.Commit(); err != nil {
			return applied, err
		}
		applied = append(applied, name)
	}
	return applied, nil
}
```

**`main.go`**:

```go
package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

func main() {
	dir, _ := os.MkdirTemp("", "migrate-*")
	defer os.RemoveAll(dir)
	ctx := context.Background()

	db, err := sql.Open("sqlite", "file:"+filepath.Join(dir, "app.db")+"?_pragma=foreign_keys(1)")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)

	for run := 1; run <= 2; run++ { // Chạy 2 lần để thấy lần 2 không làm gì
		applied, err := Migrate(ctx, db)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Printf("Lần chạy %d: áp dụng %d migration %v\n", run, len(applied), applied)
	}

	// Kiểm tra: cột category từ migration 003 đã có với giá trị mặc định
	db.ExecContext(ctx, `INSERT INTO products (name, price) VALUES ('Bàn phím', 1250000)`)
	var category string
	db.QueryRowContext(ctx, `SELECT category FROM products WHERE id = 1`).Scan(&category)
	fmt.Println("Category mặc định:", category)

	var version int
	db.QueryRowContext(ctx, `SELECT MAX(version) FROM schema_migrations`).Scan(&version)
	fmt.Println("Schema đang ở phiên bản:", version)
}
```

```bash
$ go run .
Lần chạy 1: áp dụng 3 migration [001_create_products.sql 002_create_orders.sql 003_add_product_category.sql]
Lần chạy 2: áp dụng 0 migration []
Category mặc định: khác
Schema đang ở phiên bản: 3
```

**Quy tắc vàng của migration**:

- ✅ Migration đã chạy trên production thì **không bao giờ sửa** - muốn thay đổi, tạo file **mới** (`004_...`)
- ✅ Mỗi migration nhỏ, làm một việc, có thể review dễ dàng
- ✅ Commit file migration vào Git cùng với code dùng nó
- ⚠️ Cẩn thận với migration trên bảng lớn (thêm index cho bảng 100 triệu dòng có thể khóa bảng vài phút)

> 💡 **Công cụ có sẵn**: Trong dự án thật, bạn có thể dùng [`golang-migrate/migrate`](https://github.com/golang-migrate/migrate), [`pressly/goose`](https://github.com/pressly/goose) hoặc [Atlas](https://atlasgo.io) - hỗ trợ migration **down** (quay lui), khóa khi nhiều server cùng khởi động, CLI... Nhưng ý tưởng cốt lõi y hệt runner 80 dòng ở trên.

## 📖 11. Test với database tạm

Test repository **nên dùng database thật** (không mock SQL) - vì lỗi thường nằm chính ở câu SQL! Với SQLite, việc này cực dễ: mỗi test tạo **một file database mới** trong thư mục tạm `t.TempDir()` (Go tự xóa khi test xong).

File `repo_test.go` cho repository ở mục 9:

```go
package main

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
)

// newTestRepo tạo database MỚI, SẠCH cho mỗi test → các test độc lập, chạy song song được
func newTestRepo(t *testing.T) *SQLiteProductRepo {
	t.Helper()
	dsn := "file:" + filepath.Join(t.TempDir(), "test.db") // t.TempDir tự dọn dẹp
	db, err := OpenDB(context.Background(), dsn)
	if err != nil {
		t.Fatalf("mở DB: %v", err)
	}
	t.Cleanup(func() { db.Close() }) // Đóng DB khi test kết thúc
	return NewSQLiteProductRepo(db)
}

func TestCreateAndGet(t *testing.T) {
	t.Parallel()
	repo := newTestRepo(t)
	ctx := context.Background()

	p := &Product{SKU: "KB01", Name: "Bàn phím", Price: 1_250_000, Stock: 3}
	if err := repo.Create(ctx, p); err != nil {
		t.Fatal(err)
	}
	if p.ID == 0 {
		t.Fatal("ID phải được gán sau khi Create")
	}

	got, err := repo.GetByID(ctx, p.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got != *p {
		t.Errorf("GetByID = %+v; want %+v", got, *p)
	}
}

func TestErrors(t *testing.T) {
	t.Parallel()
	repo := newTestRepo(t)
	ctx := context.Background()
	repo.Create(ctx, &Product{SKU: "A1", Name: "A", Price: 100, Stock: 1})

	if err := repo.Create(ctx, &Product{SKU: "A1", Name: "B", Price: 1}); !errors.Is(err, ErrDuplicate) {
		t.Errorf("tạo trùng SKU: err = %v; want ErrDuplicate", err)
	}
	if _, err := repo.GetByID(ctx, 999); !errors.Is(err, ErrNotFound) {
		t.Errorf("GetByID(999): err = %v; want ErrNotFound", err)
	}
	if err := repo.AdjustStock(ctx, 999, 1); !errors.Is(err, ErrNotFound) {
		t.Errorf("AdjustStock(999): err = %v; want ErrNotFound", err)
	}
	if err := repo.AdjustStock(ctx, 1, -2); err == nil {
		t.Error("xuất quá tồn kho phải báo lỗi")
	}
}

func TestListPagination(t *testing.T) {
	t.Parallel()
	repo := newTestRepo(t)
	ctx := context.Background()
	for i := range 25 {
		repo.Create(ctx, &Product{SKU: string(rune('A'+i)) + "X", Name: "SP", Price: 1})
	}

	tests := []struct {
		limit, offset, want int
	}{
		{10, 0, 10},
		{10, 20, 5},
		{10, 30, 0},
	}
	for _, tt := range tests {
		got, err := repo.List(ctx, tt.limit, tt.offset)
		if err != nil {
			t.Fatal(err)
		}
		if len(got) != tt.want {
			t.Errorf("List(%d, %d) trả %d sản phẩm; want %d", tt.limit, tt.offset, len(got), tt.want)
		}
	}
}
```

```bash
$ go test -v ./...
=== RUN   TestCreateAndGet
=== PAUSE TestCreateAndGet
=== RUN   TestErrors
=== PAUSE TestErrors
=== RUN   TestListPagination
=== PAUSE TestListPagination
=== CONT  TestCreateAndGet
=== CONT  TestListPagination
=== CONT  TestErrors
--- PASS: TestErrors (0.01s)
--- PASS: TestCreateAndGet (0.01s)
--- PASS: TestListPagination (0.02s)
PASS
ok  	shop	0.045s
```

> 💡 **Với PostgreSQL**: dùng [testcontainers-go](https://golang.testcontainers.org) để tự động chạy PostgreSQL trong Docker cho mỗi lần test, hoặc chạy mỗi test trong một transaction rồi rollback ở cuối.

## 📖 12. sqlx, sqlc, GORM, PostgreSQL - Khi nào dùng gì?

Viết `rows.Scan(&p.ID, &p.SKU, &p.Name, ...)` cho mọi query khá dài dòng. Cộng đồng Go có vài công cụ giúp bớt việc:

| Công cụ | Ý tưởng | Ưu điểm | Nhược điểm |
|---------|---------|---------|------------|
| **`database/sql`** | Thư viện chuẩn | Không phụ thuộc, hiểu rõ mọi thứ | Dài dòng khi Scan |
| **[sqlx](https://github.com/jmoiron/sqlx)** | Mở rộng `database/sql`: scan thẳng vào struct theo tag `db:"..."` | Học 10 phút là dùng, vẫn viết SQL | Lỗi sai tên cột chỉ phát hiện khi chạy |
| **[sqlc](https://sqlc.dev)** | Bạn viết SQL → nó **sinh code Go** type-safe | Sai SQL/kiểu bị phát hiện lúc **build**, hiệu năng như viết tay | Thêm bước generate; query động khó |
| **[GORM](https://gorm.io)** | ORM: thao tác bằng struct, ít viết SQL | Nhanh cho CRUD, có association, hook | "Phép thuật" ẩn, khó tối ưu, dễ sinh N+1 query |
| **[pgx](https://github.com/jackc/pgx)** | Driver PostgreSQL hiệu năng cao | Nhanh nhất, hỗ trợ đầy đủ kiểu của Postgres | Chỉ dành cho PostgreSQL |

**sqlx** - scan thẳng vào struct:

```go
type Product struct {
	ID    int64  `db:"id"`
	Name  string `db:"name"`
	Price int64  `db:"price"`
}

var products []Product
err := db.SelectContext(ctx, &products, `SELECT id, name, price FROM products WHERE price > ?`, 100000)

var p Product
err = db.GetContext(ctx, &p, `SELECT id, name, price FROM products WHERE id = ?`, 1)
```

**sqlc** - viết SQL có chú thích, chạy `sqlc generate`:

```sql
-- name: GetProduct :one
SELECT id, name, price FROM products WHERE id = ?;

-- name: ListProducts :many
SELECT id, name, price FROM products ORDER BY id LIMIT ? OFFSET ?;
```

```go
// Code được sinh tự động - bạn chỉ việc gọi:
p, err := queries.GetProduct(ctx, 1)
list, err := queries.ListProducts(ctx, db.ListProductsParams{Limit: 10, Offset: 0})
```

**GORM** - ORM:

```go
db.AutoMigrate(&Product{})
db.Create(&Product{Name: "Bàn phím", Price: 1250000})
var p Product
db.Where("price > ?", 100000).First(&p)
```

**PostgreSQL với pgx** - những điểm khác SQLite:

```go
import "github.com/jackc/pgx/v5/pgxpool"

pool, err := pgxpool.New(ctx, os.Getenv("DATABASE_URL")) // postgres://user:pass@localhost:5432/shop
defer pool.Close()

// Placeholder là $1, $2... và dùng RETURNING để lấy id (Postgres KHÔNG hỗ trợ LastInsertId)
var id int64
err = pool.QueryRow(ctx,
	`INSERT INTO products (name, price) VALUES ($1, $2) RETURNING id`, "Bàn phím", 1250000).Scan(&id)
```

Chạy PostgreSQL trên máy bằng Docker:

```bash
docker run -d --name pg -e POSTGRES_PASSWORD=secret -e POSTGRES_DB=shop -p 5432:5432 postgres:17
```

**Lời khuyên chọn công cụ**:

- 🎓 **Đang học**: `database/sql` thuần - hiểu gốc rễ trước
- 🚀 **Dự án mới, dùng PostgreSQL**: `pgx` + `sqlc` - combo được cộng đồng Go ưa chuộng nhất hiện nay
- 🛠️ **Muốn gọn nhưng vẫn viết SQL**: `sqlx`
- 📋 **App CRUD đơn giản, team quen ORM**: GORM - nhưng hãy học SQL trước để hiểu GORM đang làm gì

## 🌍 Ứng dụng thực tế

### Ứng dụng 1: Hệ thống quản lý đơn hàng (transaction trừ tồn kho)

**Bài toán**: Cửa hàng online nhận đơn gồm **nhiều sản phẩm**. Khi đặt hàng phải:
1. Kiểm tra **từng** sản phẩm còn đủ hàng không
2. **Trừ tồn kho** từng sản phẩm
3. Tạo **đơn hàng** + các **dòng chi tiết** (order_items) với giá **tại thời điểm mua**
4. Tính tổng tiền

Nếu **bất kỳ** sản phẩm nào không đủ hàng → **cả đơn** bị hủy, tồn kho các sản phẩm khác **không bị trừ**. Và khi 10 khách cùng tranh mua 5 chiếc cuối cùng → **đúng 5** người mua được, không được bán âm kho (*overselling*).

**Thiết kế**:
- Trừ kho bằng **UPDATE có điều kiện**: `UPDATE ... SET stock = stock - ? WHERE id = ? AND stock >= ?` rồi kiểm tra `RowsAffected`. Việc kiểm tra và trừ diễn ra trong **một câu lệnh** → không có khe hở cho tranh chấp (race condition) giữa "đọc tồn kho" và "ghi tồn kho"
- Toàn bộ trong `withTx` → lỗi ở đâu cũng rollback sạch sẽ
- `order_items.unit_price` lưu giá lúc mua (giá sản phẩm sau này có đổi, hóa đơn cũ vẫn đúng)
- Hủy đơn → hoàn lại tồn kho, cũng trong transaction

```go
package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"

	_ "modernc.org/sqlite"
)

// ================= Schema =================

const schema = `
CREATE TABLE products (
	id    INTEGER PRIMARY KEY,
	sku   TEXT NOT NULL UNIQUE,
	name  TEXT NOT NULL,
	price INTEGER NOT NULL CHECK (price >= 0),
	stock INTEGER NOT NULL CHECK (stock >= 0)
);
CREATE TABLE orders (
	id         INTEGER PRIMARY KEY,
	customer   TEXT NOT NULL,
	status     TEXT NOT NULL CHECK (status IN ('placed', 'cancelled')),
	total      INTEGER NOT NULL DEFAULT 0,
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE order_items (
	order_id   INTEGER NOT NULL REFERENCES orders(id),
	product_id INTEGER NOT NULL REFERENCES products(id),
	qty        INTEGER NOT NULL CHECK (qty > 0),
	unit_price INTEGER NOT NULL,
	PRIMARY KEY (order_id, product_id)
);
CREATE INDEX idx_items_product ON order_items(product_id);`

// ================= Lỗi nghiệp vụ =================

var (
	ErrProductNotFound = errors.New("sản phẩm không tồn tại")
	ErrOrderNotFound   = errors.New("đơn hàng không tồn tại")
	ErrEmptyOrder      = errors.New("đơn hàng trống")
	ErrAlreadyCanceled = errors.New("đơn đã bị hủy trước đó")
)

type OutOfStockError struct {
	SKU       string
	Want, Has int
}

func (e *OutOfStockError) Error() string {
	return fmt.Sprintf("%s không đủ hàng (cần %d, còn %d)", e.SKU, e.Want, e.Has)
}

// ================= Store =================

type Item struct {
	SKU string
	Qty int
}

type Store struct{ db *sql.DB }

func withTx(ctx context.Context, db *sql.DB, fn func(tx *sql.Tx) error) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit()
}

// PlaceOrder đặt hàng: tất cả sản phẩm đủ hàng thì mới tạo đơn
func (s *Store) PlaceOrder(ctx context.Context, customer string, items []Item) (orderID, total int64, err error) {
	if len(items) == 0 {
		return 0, 0, ErrEmptyOrder
	}
	err = withTx(ctx, s.db, func(tx *sql.Tx) error {
		res, err := tx.ExecContext(ctx,
			`INSERT INTO orders (customer, status) VALUES (?, 'placed')`, customer)
		if err != nil {
			return err
		}
		if orderID, err = res.LastInsertId(); err != nil {
			return err
		}

		for _, it := range items {
			// ❗ Dùng tx.QueryRowContext, KHÔNG dùng s.db - nếu không sẽ chạy NGOÀI transaction
			// (và với MaxOpenConns(1) còn bị treo vĩnh viễn vì kết nối duy nhất đang bận!)
			var pid, price int64
			var stock int
			err := tx.QueryRowContext(ctx,
				`SELECT id, price, stock FROM products WHERE sku = ?`, it.SKU).Scan(&pid, &price, &stock)
			if errors.Is(err, sql.ErrNoRows) {
				return fmt.Errorf("%s: %w", it.SKU, ErrProductNotFound)
			}
			if err != nil {
				return err
			}

			// Kiểm tra + trừ kho trong MỘT câu lệnh
			res, err := tx.ExecContext(ctx,
				`UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?`, it.Qty, pid, it.Qty)
			if err != nil {
				return err
			}
			if n, _ := res.RowsAffected(); n == 0 {
				return &OutOfStockError{SKU: it.SKU, Want: it.Qty, Has: stock}
			}

			if _, err := tx.ExecContext(ctx,
				`INSERT INTO order_items (order_id, product_id, qty, unit_price) VALUES (?, ?, ?, ?)`,
				orderID, pid, it.Qty, price); err != nil {
				return err
			}
			total += price * int64(it.Qty)
		}

		_, err = tx.ExecContext(ctx, `UPDATE orders SET total = ? WHERE id = ?`, total, orderID)
		return err
	})
	if err != nil {
		return 0, 0, err
	}
	return orderID, total, nil
}

// CancelOrder hủy đơn và hoàn lại tồn kho
func (s *Store) CancelOrder(ctx context.Context, orderID int64) error {
	return withTx(ctx, s.db, func(tx *sql.Tx) error {
		// Chỉ đổi trạng thái nếu đơn đang 'placed' → chống hủy 2 lần (hoàn kho 2 lần!)
		res, err := tx.ExecContext(ctx,
			`UPDATE orders SET status = 'cancelled' WHERE id = ? AND status = 'placed'`, orderID)
		if err != nil {
			return err
		}
		if n, _ := res.RowsAffected(); n == 0 {
			var exists bool
			tx.QueryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM orders WHERE id = ?)`, orderID).Scan(&exists)
			if !exists {
				return ErrOrderNotFound
			}
			return ErrAlreadyCanceled
		}
		// Hoàn kho cho mọi sản phẩm trong đơn bằng MỘT câu lệnh (subquery)
		_, err = tx.ExecContext(ctx, `
			UPDATE products
			SET stock = stock + (SELECT qty FROM order_items WHERE order_id = ? AND product_id = products.id)
			WHERE id IN (SELECT product_id FROM order_items WHERE order_id = ?)`, orderID, orderID)
		return err
	})
}

func (s *Store) PrintStock(ctx context.Context) {
	rows, err := s.db.QueryContext(ctx, `SELECT sku, stock FROM products ORDER BY id`)
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()
	fmt.Print("   📦 Tồn kho:")
	for rows.Next() {
		var sku string
		var stock int
		rows.Scan(&sku, &stock)
		fmt.Printf(" %s=%d", sku, stock)
	}
	fmt.Println()
}

func (s *Store) PrintOrder(ctx context.Context, id int64) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT o.customer, o.status, p.name, i.qty, i.unit_price, i.qty * i.unit_price
		FROM orders o
		JOIN order_items i ON i.order_id = o.id
		JOIN products p    ON p.id = i.product_id
		WHERE o.id = ?
		ORDER BY p.id`, id)
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()
	for first := true; rows.Next(); first = false {
		var customer, status, name string
		var qty int
		var unit, line int64
		rows.Scan(&customer, &status, &name, &qty, &unit, &line)
		if first {
			fmt.Printf("   🧾 Đơn #%d của %s [%s]\n", id, customer, status)
		}
		fmt.Printf("      %-10s %d x %9d = %10d\n", name, qty, unit, line)
	}
}

// ================= main =================

func main() {
	ctx := context.Background()
	dir, _ := os.MkdirTemp("", "orders-*")
	defer os.RemoveAll(dir)
	dsn := "file:" + filepath.Join(dir, "shop.db") + "?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)"
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1) // SQLite: một "người ghi" tại một thời điểm → transaction xếp hàng lần lượt

	if _, err := db.ExecContext(ctx, schema); err != nil {
		log.Fatal(err)
	}
	db.ExecContext(ctx, `INSERT INTO products (sku, name, price, stock) VALUES
		('KB01', 'Bàn phím', 1250000, 10),
		('MS02', 'Chuột', 350000, 3),
		('HP03', 'Tai nghe', 890000, 5)`)

	store := &Store{db: db}
	store.PrintStock(ctx)

	fmt.Println("\n1️⃣  An mua 2 bàn phím + 1 chuột")
	id1, total, err := store.PlaceOrder(ctx, "An", []Item{{"KB01", 2}, {"MS02", 1}})
	fmt.Printf("   ✅ Đơn #%d, tổng %d đ (lỗi: %v)\n", id1, total, err)
	store.PrintOrder(ctx, id1)
	store.PrintStock(ctx)

	fmt.Println("\n2️⃣  Bình mua 1 bàn phím + 5 chuột (chuột chỉ còn 2)")
	_, _, err = store.PlaceOrder(ctx, "Bình", []Item{{"KB01", 1}, {"MS02", 5}})
	var oos *OutOfStockError
	if errors.As(err, &oos) {
		fmt.Println("   ❌", err)
	}
	store.PrintStock(ctx) // KB01 vẫn là 8 - không bị trừ oan!

	fmt.Println("\n3️⃣  Chi mua sản phẩm không tồn tại")
	_, _, err = store.PlaceOrder(ctx, "Chi", []Item{{"XX99", 1}})
	fmt.Println("   ❌", err, "| ErrProductNotFound:", errors.Is(err, ErrProductNotFound))

	fmt.Println("\n4️⃣  An hủy đơn #1, rồi hủy lần nữa")
	fmt.Println("   Hủy lần 1:", store.CancelOrder(ctx, id1))
	fmt.Println("   Hủy lần 2:", store.CancelOrder(ctx, id1))
	store.PrintStock(ctx)

	fmt.Println("\n5️⃣  Flash sale: 10 khách cùng lúc tranh 5 tai nghe")
	var wg sync.WaitGroup
	var mu sync.Mutex
	success, failed := 0, 0
	for i := range 10 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, _, err := store.PlaceOrder(ctx, fmt.Sprintf("khách-%d", i), []Item{{"HP03", 1}})
			mu.Lock()
			defer mu.Unlock()
			var stockErr *OutOfStockError
			if err == nil {
				success++
			} else if errors.As(err, &stockErr) {
				failed++
			} else {
				log.Println("lỗi lạ:", err)
			}
		}()
	}
	wg.Wait()
	fmt.Printf("   Thành công: %d, hết hàng: %d\n", success, failed)
	store.PrintStock(ctx)

	var placed, cancelled int
	db.QueryRowContext(ctx, `SELECT
		COUNT(*) FILTER (WHERE status = 'placed'),
		COUNT(*) FILTER (WHERE status = 'cancelled') FROM orders`).Scan(&placed, &cancelled)
	fmt.Printf("\n📊 Đơn hợp lệ: %d, đã hủy: %d\n", placed, cancelled)
}

// Output:
//    📦 Tồn kho: KB01=10 MS02=3 HP03=5
//
// 1️⃣  An mua 2 bàn phím + 1 chuột
//    ✅ Đơn #1, tổng 2850000 đ (lỗi: <nil>)
//    🧾 Đơn #1 của An [placed]
//       Bàn phím   2 x   1250000 =    2500000
//       Chuột      1 x    350000 =     350000
//    📦 Tồn kho: KB01=8 MS02=2 HP03=5
//
// 2️⃣  Bình mua 1 bàn phím + 5 chuột (chuột chỉ còn 2)
//    ❌ MS02 không đủ hàng (cần 5, còn 2)
//    📦 Tồn kho: KB01=8 MS02=2 HP03=5
//
// 3️⃣  Chi mua sản phẩm không tồn tại
//    ❌ XX99: sản phẩm không tồn tại | ErrProductNotFound: true
//
// 4️⃣  An hủy đơn #1, rồi hủy lần nữa
//    Hủy lần 1: <nil>
//    Hủy lần 2: đơn đã bị hủy trước đó
//    📦 Tồn kho: KB01=10 MS02=3 HP03=5
//
// 5️⃣  Flash sale: 10 khách cùng lúc tranh 5 tai nghe
//    Thành công: 5, hết hàng: 5
//    📦 Tồn kho: KB01=10 MS02=3 HP03=0
//
// 📊 Đơn hợp lệ: 5, đã hủy: 1
```

**Phân tích**:

- **Tình huống 2**: Bàn phím đã được trừ (dòng đầu tiên trong vòng lặp) trước khi phát hiện chuột thiếu. Nhờ transaction, rollback trả bàn phím về **8** - khách không bị "giữ hàng oan"
- **Tình huống 4**: `WHERE status = 'placed'` khiến lần hủy thứ hai không làm gì → không hoàn kho hai lần. Đây là kỹ thuật **cập nhật có điều kiện** - rất quan trọng trong hệ thống thật (người dùng bấm nút 2 lần, request bị retry...)
- **Tình huống 5**: 10 goroutine đặt hàng đồng thời, nhưng `UPDATE ... WHERE stock >= ?` đảm bảo **đúng 5** đơn thành công, tồn kho **không bao giờ âm**. Ràng buộc `CHECK (stock >= 0)` là lớp bảo vệ thứ hai
- Đơn hàng bị rollback **không để lại dấu vết** - kể cả dòng `orders` đã INSERT ở đầu transaction. (ID tự tăng có thể "nhảy cóc", điều đó bình thường)

> 💡 **Với PostgreSQL**: code gần như y hệt (đổi `?` → `$1`, `LastInsertId` → `RETURNING id`). PostgreSQL cho phép nhiều transaction chạy **song song thật sự**; `UPDATE ... WHERE stock >= ?` vẫn an toàn vì Postgres khóa dòng đang được cập nhật. Nếu cần đọc rồi mới quyết định (logic phức tạp hơn), dùng `SELECT ... FOR UPDATE` để khóa dòng.

### Ứng dụng 2: Thống kê doanh thu theo tháng

**Bài toán**: Sếp cần báo cáo 6 tháng đầu năm: doanh thu **mỗi tháng**, số đơn, giá trị đơn trung bình, **tăng trưởng** so với tháng trước, và **top sản phẩm** bán chạy nhất. Chỉ tính đơn đã thanh toán.

**Thiết kế**:
- Để database làm việc nặng: `GROUP BY strftime('%Y-%m', created_at)`, `SUM`, `COUNT`, `AVG`, `JOIN`
- Go chỉ tính phần khó viết bằng SQL (tăng trưởng %) và định dạng hiển thị
- Dữ liệu mẫu sinh bằng bộ sinh số ngẫu nhiên **có seed cố định** → kết quả luôn giống nhau
- Index trên `(status, created_at)` giúp truy vấn theo khoảng thời gian nhanh khi dữ liệu lớn

```go
package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"math/rand/v2"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

const schema = `
CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, price INTEGER NOT NULL);
CREATE TABLE orders (
	id         INTEGER PRIMARY KEY,
	status     TEXT NOT NULL,
	created_at DATETIME NOT NULL
);
CREATE TABLE order_items (
	order_id   INTEGER NOT NULL REFERENCES orders(id),
	product_id INTEGER NOT NULL REFERENCES products(id),
	qty        INTEGER NOT NULL,
	unit_price INTEGER NOT NULL
);
CREATE INDEX idx_orders_status_created ON orders(status, created_at);
CREATE INDEX idx_items_order ON order_items(order_id);`

// seed sinh ~1.500 đơn hàng trong 6 tháng, trong 1 transaction cho nhanh
func seed(ctx context.Context, db *sql.DB) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	products := []struct {
		name  string
		price int64
	}{
		{"Bàn phím", 1_250_000}, {"Chuột", 350_000}, {"Tai nghe", 890_000},
		{"Màn hình", 4_990_000}, {"Lót chuột", 90_000},
	}
	for _, p := range products {
		if _, err := tx.ExecContext(ctx, `INSERT INTO products (name, price) VALUES (?, ?)`, p.name, p.price); err != nil {
			return err
		}
	}

	insOrder, err := tx.PrepareContext(ctx, `INSERT INTO orders (status, created_at) VALUES (?, ?)`)
	if err != nil {
		return err
	}
	defer insOrder.Close()
	insItem, err := tx.PrepareContext(ctx,
		`INSERT INTO order_items (order_id, product_id, qty, unit_price) VALUES (?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer insItem.Close()

	r := rand.New(rand.NewPCG(2026, 1)) // Seed cố định → dữ liệu giống nhau mỗi lần chạy
	start := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	for day := range 181 { // 1/1 → 30/6
		date := start.AddDate(0, 0, day)
		ordersToday := 5 + r.IntN(4) + int(date.Month()) // Cửa hàng tăng trưởng dần theo tháng
		for range ordersToday {
			status := "paid"
			if r.IntN(10) == 0 {
				status = "cancelled" // ~10% đơn bị hủy - không tính doanh thu
			}
			at := date.Add(time.Duration(r.IntN(24*60)) * time.Minute)
			res, err := insOrder.ExecContext(ctx, status, at)
			if err != nil {
				return err
			}
			orderID, _ := res.LastInsertId()
			for range 1 + r.IntN(3) { // 1-3 sản phẩm mỗi đơn
				pi := r.IntN(len(products))
				if _, err := insItem.ExecContext(ctx, orderID, pi+1, 1+r.IntN(2), products[pi].price); err != nil {
					return err
				}
			}
		}
	}
	return tx.Commit()
}

type MonthStat struct {
	Month   string
	Orders  int
	Revenue int64
	AvgSize float64
}

func monthlyRevenue(ctx context.Context, db *sql.DB, from, to time.Time) ([]MonthStat, error) {
	rows, err := db.QueryContext(ctx, `
		WITH order_totals AS (               -- CTE: bảng tạm "tổng tiền mỗi đơn"
			SELECT o.id, o.created_at, SUM(i.qty * i.unit_price) AS total
			FROM orders o
			JOIN order_items i ON i.order_id = o.id
			WHERE o.status = 'paid' AND o.created_at >= ? AND o.created_at < ?
			GROUP BY o.id
		)
		SELECT strftime('%Y-%m', created_at) AS month,
		       COUNT(*)                       AS orders,
		       SUM(total)                     AS revenue,
		       AVG(total)                     AS avg_size
		FROM order_totals
		GROUP BY month
		ORDER BY month`, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []MonthStat
	for rows.Next() {
		var m MonthStat
		if err := rows.Scan(&m.Month, &m.Orders, &m.Revenue, &m.AvgSize); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

type ProductStat struct {
	Name    string
	Qty     int
	Revenue int64
}

func topProducts(ctx context.Context, db *sql.DB, from, to time.Time, limit int) ([]ProductStat, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT p.name, SUM(i.qty), SUM(i.qty * i.unit_price) AS revenue
		FROM order_items i
		JOIN orders o   ON o.id = i.order_id
		JOIN products p ON p.id = i.product_id
		WHERE o.status = 'paid' AND o.created_at >= ? AND o.created_at < ?
		GROUP BY p.id
		ORDER BY revenue DESC
		LIMIT ?`, from, to, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []ProductStat
	for rows.Next() {
		var p ProductStat
		if err := rows.Scan(&p.Name, &p.Qty, &p.Revenue); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// vnd định dạng 1234567 → "1.234.567"
func vnd(n int64) string {
	s := fmt.Sprint(n)
	var b strings.Builder
	for i, c := range s {
		if i > 0 && (len(s)-i)%3 == 0 {
			b.WriteByte('.')
		}
		b.WriteRune(c)
	}
	return b.String()
}

func main() {
	ctx := context.Background()
	// _time_format=sqlite: lưu time.Time dạng "2026-01-05 10:30:00+00:00" để strftime() hiểu được
	db, err := sql.Open("sqlite", ":memory:?_pragma=foreign_keys(1)&_time_format=sqlite")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)

	if _, err := db.ExecContext(ctx, schema); err != nil {
		log.Fatal(err)
	}
	if err := seed(ctx, db); err != nil {
		log.Fatal(err)
	}

	from := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	to := from.AddDate(0, 6, 0) // Nửa khoảng [from, to): chuẩn mực khi lọc theo thời gian

	months, err := monthlyRevenue(ctx, db, from, to)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("📈 DOANH THU 6 THÁNG ĐẦU NĂM 2026")
	fmt.Printf("%-8s %5s %15s %12s %8s\n", "Tháng", "Đơn", "Doanh thu (đ)", "TB/đơn", "Tăng")
	var sum int64
	for i, m := range months {
		growth := "-"
		if i > 0 {
			prev := months[i-1].Revenue
			growth = fmt.Sprintf("%+.1f%%", float64(m.Revenue-prev)*100/float64(prev))
		}
		fmt.Printf("%-8s %5d %15s %12s %8s\n", m.Month, m.Orders, vnd(m.Revenue), vnd(int64(m.AvgSize)), growth)
		sum += m.Revenue
	}
	fmt.Printf("%-8s %5s %15s\n", "TỔNG", "", vnd(sum))

	fmt.Println("\n🏆 TOP 3 SẢN PHẨM")
	top, err := topProducts(ctx, db, from, to, 3)
	if err != nil {
		log.Fatal(err)
	}
	for i, p := range top {
		share := float64(p.Revenue) * 100 / float64(sum)
		bar := strings.Repeat("█", int(share/2))
		fmt.Printf("%d. %-10s %5d cái %15s đ %5.1f%% %s\n", i+1, p.Name, p.Qty, vnd(p.Revenue), share, bar)
	}
}

// Output:
// 📈 DOANH THU 6 THÁNG ĐẦU NĂM 2026
// Tháng      Đơn   Doanh thu (đ)       TB/đơn     Tăng
// 2026-01    221   1.060.890.000    4.800.407        -
// 2026-02    213     970.820.000    4.557.840    -8.5%
// 2026-03    270   1.248.820.000    4.625.259   +28.6%
// 2026-04    288   1.296.000.000    4.500.000    +3.8%
// 2026-05    318   1.509.750.000    4.747.641   +16.5%
// 2026-06    347   1.553.720.000    4.477.579    +2.9%
// TỔNG             7.640.000.000
//
// 🏆 TOP 3 SẢN PHẨM
// 1. Màn hình    1002 cái   4.999.980.000 đ  65.4% ████████████████████████████████
// 2. Bàn phím    1048 cái   1.310.000.000 đ  17.1% ████████
// 3. Tai nghe     997 cái     887.330.000 đ  11.6% █████
```

> 💡 Nhìn báo cáo là thấy: doanh thu tháng 2 giảm (tháng 2 chỉ có 28 ngày), từ tháng 3 tăng đều; **Màn hình** chiếm tới 65% doanh thu dù số lượng bán không nhiều hơn các sản phẩm khác - vì giá cao. Đó là loại insight mà sếp cần!

**Những kỹ thuật SQL đáng học trong ví dụ này**:

- **CTE** (`WITH ... AS (...)`): đặt tên cho một truy vấn con để dùng tiếp - giống khai báo biến trung gian, giúp SQL dễ đọc hơn nhiều
- **Hai tầng tổng hợp**: tầng 1 tính tổng **mỗi đơn**, tầng 2 gom **theo tháng** → mới tính đúng `AVG` giá trị đơn (nếu `AVG` trực tiếp trên `order_items` sẽ ra trung bình **mỗi dòng sản phẩm** - sai!)
- **Khoảng nửa mở** `>= from AND < to`: không bỏ sót đơn lúc 23:59:59.5 ngày cuối tháng như khi dùng `BETWEEN ... AND '...23:59:59'`
- **Index `(status, created_at)`**: khớp đúng điều kiện `WHERE status = ? AND created_at >= ?` → database nhảy thẳng tới vùng dữ liệu cần thiết

## ⚠️ Lỗi thường gặp

### Lỗi 1: Quên `rows.Close()` → cạn connection pool

```go
rows, _ := db.QueryContext(ctx, "SELECT ...")
for rows.Next() {
	if cond {
		return result // ❌ rows không được đóng → kết nối bị "giữ" mãi
	}
}
```

Sau vài trăm request, mọi query **treo cứng**. ✅ Luôn `defer rows.Close()` ngay sau khi kiểm tra `err`.

### Lỗi 2: Không kiểm tra `rows.Err()`

Mất kết nối giữa chừng → `Next()` trả `false` → bạn tưởng đã đọc hết, trả về kết quả **thiếu** mà không báo lỗi. ✅ `return out, rows.Err()`.

### Lỗi 3: Coi `sql.ErrNoRows` là lỗi hệ thống

```go
if err != nil {
	http.Error(w, "lỗi server", 500) // ❌ Không tìm thấy mà báo 500
}
```

✅ `errors.Is(err, sql.ErrNoRows)` → 404. Tốt hơn nữa: repository dịch sang `ErrNotFound` của domain.

### Lỗi 4: Dùng `db` thay vì `tx` bên trong transaction

```go
tx, _ := db.BeginTx(ctx, nil)
tx.ExecContext(ctx, "UPDATE accounts ...")
db.QueryRowContext(ctx, "SELECT balance ...") // ❌ Chạy NGOÀI transaction, không thấy thay đổi chưa commit
                                               //    Với SetMaxOpenConns(1): TREO VĨNH VIỄN (deadlock)
```

✅ Mọi lệnh trong transaction đều phải qua `tx`.

### Lỗi 5: Nối chuỗi tạo câu SQL

```go
db.Query("SELECT * FROM users WHERE name = '" + name + "'") // ❌ SQL injection!
db.Query("SELECT * FROM users WHERE name = ?", name)        // ✅
```

### Lỗi 6: `":memory:"` + nhiều kết nối = nhiều database khác nhau

```go
db, _ := sql.Open("sqlite", ":memory:")
db.Exec("CREATE TABLE t (...)") // Chạy trên kết nối A
db.Query("SELECT * FROM t")     // Có thể chạy trên kết nối B → "no such table: t" 😵 (lúc có lúc không!)
```

✅ `db.SetMaxOpenConns(1)` khi dùng `:memory:`, hoặc dùng file tạm.

### Lỗi 7: Quên bật khóa ngoại trong SQLite

SQLite mặc định **không kiểm tra** `REFERENCES`! Đơn hàng trỏ tới khách không tồn tại vẫn được lưu. ✅ Thêm `_pragma=foreign_keys(1)` vào DSN.

### Lỗi 8: Lưu tiền bằng `REAL`/`float64`

```sql
price REAL  -- ❌ 0.1 + 0.2 = 0.30000000000000004
price INTEGER -- ✅ Lưu số đồng (hoặc số cent)
```

PostgreSQL có kiểu `NUMERIC(12,2)` chính xác tuyệt đối - dùng khi cần số thập phân.

### Lỗi 9: Mở/đóng `*sql.DB` trong mỗi request

```go
func handler(w http.ResponseWriter, r *http.Request) {
	db, _ := sql.Open("postgres", dsn) // ❌ Mỗi request tạo pool mới, bắt tay kết nối mới
	defer db.Close()
}
```

✅ Mở **một lần** trong `main`, truyền vào các struct cần dùng.

### Lỗi 10: Thời gian lưu sai định dạng trong SQLite

Driver `modernc.org/sqlite` mặc định lưu `time.Time` dạng `2026-09-25 10:00:00 +0000 UTC` - hàm `strftime()` của SQLite **không hiểu** định dạng này và trả về `NULL` → báo cáo theo tháng ra rỗng mà không báo lỗi. ✅ Thêm `_time_format=sqlite` vào DSN, và khai báo cột là `DATETIME` để `Scan` được vào `time.Time`.

## 🏋️ Bài tập

### Bài tập 1: Sổ liên lạc (⭐ Dễ)

Viết CLI ([Bài 11](./11-files-json-cli.md)) quản lý danh bạ lưu trong file SQLite `contacts.db`:
- `contacts add -name An -phone 0901234567 [-email an@mail.com]` (email có thể NULL)
- `contacts list [-q từ_khóa]` tìm theo tên hoặc số điện thoại bằng `LIKE ?`
- `contacts delete <id>` - báo lỗi rõ ràng nếu id không tồn tại (dùng `RowsAffected`)

### Bài tập 2: Viết SQL (⭐ Dễ)

Với schema ở Ứng dụng 2, viết các câu SQL (chạy thử bằng "SQL playground" ở mục 3.8):
- Ngày trong tuần nào có doanh thu cao nhất? (gợi ý: `strftime('%w', created_at)`)
- Sản phẩm nào có tỉ lệ nằm trong đơn bị hủy cao nhất?
- 5 đơn hàng giá trị lớn nhất kèm danh sách sản phẩm (gợi ý: `GROUP_CONCAT`)

### Bài tập 3: Repository cho đơn hàng + test (⭐⭐ Trung bình)

Tách Ứng dụng 1 theo repository pattern: `OrderRepository` với `PlaceOrder`, `Cancel`, `GetByID` (trả về `Order` kèm `[]OrderItem`), `ListByCustomer(ctx, customer, limit, offset)`. Viết test với `t.TempDir()` cho: đặt hàng thành công, hết hàng không trừ kho, hủy 2 lần, và test flash sale đồng thời (chạy với `-race`).

### Bài tập 4: Migration nâng cao (⭐⭐ Trung bình)

Mở rộng migration runner ở mục 10:
- Hỗ trợ file `NNN_ten.down.sql` và lệnh `migrate down` để quay lui migration mới nhất
- Lưu **checksum SHA-256** của mỗi file đã chạy; khi khởi động, nếu phát hiện file cũ bị **sửa** → báo lỗi và dừng
- Viết test đảm bảo chạy up → down → up cho cùng một schema

### Bài tập 5: REST API + Database (⭐⭐⭐ Nâng cao)

Nâng cấp Todo API của [Bài 10](./10-final-project.md) hoặc URL shortener của [Bài 12](./12-http-apis.md) để lưu vào SQLite:
- Định nghĩa interface `Store`, giữ bản in-memory cho test và thêm bản SQLite
- Dùng `r.Context()` cho mọi query; phân trang bằng `LIMIT ? OFFSET ?`
- Chạy migration khi khởi động; map `ErrNotFound` → 404, `ErrDuplicate` → 409
- (Tùy chọn) Chuyển sang PostgreSQL chạy bằng Docker với `pgx`

### Bài tập 6: Báo cáo nâng cao với sqlc (⭐⭐⭐ Nâng cao)

Cài [sqlc](https://sqlc.dev), viết lại các query ở Ứng dụng 2 thành file `.sql` có chú thích `-- name: ...`, sinh code Go, và thêm báo cáo:
- Doanh thu theo **tuần** kèm đường trung bình động 4 tuần (gợi ý: window function `AVG(...) OVER (ORDER BY week ROWS 3 PRECEDING)`)
- Xuất báo cáo ra CSV ([Bài 11](./11-files-json-cli.md))

## ✅ Checklist hoàn thành

- [ ] Giải thích được vì sao cần database thay vì file JSON
- [ ] Viết được `CREATE TABLE` với `PRIMARY KEY`, `NOT NULL`, `UNIQUE`, `CHECK`, `REFERENCES`
- [ ] Viết được `INSERT`, `SELECT ... WHERE ... ORDER BY ... LIMIT`, `UPDATE`, `DELETE` (luôn có `WHERE`!)
- [ ] Dùng `COUNT`/`SUM`/`AVG` với `GROUP BY`, phân biệt `JOIN` và `LEFT JOIN`
- [ ] Hiểu index là gì, xem được `EXPLAIN QUERY PLAN`
- [ ] Kết nối SQLite với `modernc.org/sqlite`, hiểu import `_` và `PingContext`
- [ ] Hiểu `*sql.DB` là connection pool và cấu hình được nó
- [ ] Dùng `ExecContext`, `QueryRowContext`, `QueryContext` đúng chỗ
- [ ] Thuộc 3 quy tắc với `rows`: `defer Close`, `Next`, `Err`
- [ ] Xử lý `sql.ErrNoRows` và NULL (`sql.Null[T]`, con trỏ, `COALESCE`)
- [ ] Dùng transaction với `defer tx.Rollback()` + `Commit()`, viết được `withTx`
- [ ] Luôn dùng placeholder, dùng whitelist cho tên cột động
- [ ] Tổ chức code theo repository pattern, dịch lỗi DB sang lỗi domain
- [ ] Viết migration runner với `embed` và hiểu quy tắc "không sửa migration cũ"
- [ ] Viết test repository với database tạm (`t.TempDir()`)
- [ ] Biết khi nào dùng sqlx, sqlc, GORM, pgx
- [ ] Chạy thành công hệ thống đơn hàng và báo cáo doanh thu
- [ ] Hoàn thành ít nhất 4 bài tập

## 🚀 Tiếp theo

Bạn đã biết cách lưu trữ dữ liệu bền vững và an toàn. Ở Ứng dụng 1, bạn cũng đã thấy 10 goroutine cùng tranh một tài nguyên. Bài tiếp theo sẽ đi sâu vào **concurrency nâng cao** để xây dựng những hệ thống chịu tải lớn:

- Pipeline có thể hủy giữa chừng, fan-out/fan-in
- Giới hạn số việc song song với semaphore và **`errgroup`**
- Bộ công cụ `sync` nâng cao (`Once`, `Pool`, `atomic`...), rate limiting, graceful shutdown cho worker
- Phát hiện goroutine leak

**Bài tiếp theo**: [Concurrency Patterns nâng cao](./14-advanced-concurrency.md)

---

💡 **Tips ghi nhớ**:

- **`*sql.DB` là pool** - mở một lần, dùng chung, không đóng trong mỗi request
- **Rows: `defer Close` → `Next` → `Err`** - thiếu một bước là có bug
- **Placeholder luôn luôn** - không bao giờ nối chuỗi dữ liệu vào SQL
- **Nhiều bước ghi = transaction** - `defer tx.Rollback()` rồi `Commit()`
- **Kiểm tra và cập nhật trong một câu lệnh**: `UPDATE ... WHERE stock >= ?` + `RowsAffected`
- **Ràng buộc trong database** là lớp bảo vệ cuối cùng - `NOT NULL`, `CHECK`, `UNIQUE`, `FOREIGN KEY`
- **Tiền là INTEGER**, thời gian dùng nửa khoảng `[from, to)`
