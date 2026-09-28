# 📚 Bài 6: Database Internals & Hiệu năng

## 🎯 Mục tiêu bài học

Ở [Bài 5](./05-relational-database-design.md) bạn đã học cách **thiết kế** schema. Bài này đi xuống "tầng hầm": database **thật sự** lưu dữ liệu thế nào, vì sao cùng một câu SQL lúc chạy 0.05ms lúc chạy 30 giây, và làm sao để database **không sập** khi hệ thống lớn lên.

Sau bài này bạn sẽ:

- Hiểu database lưu dữ liệu trên đĩa ra sao: **page**, **heap**, **buffer pool**, **WAL**
- Hiểu **B+tree index** hoạt động thế nào và **tại sao** nó nhanh
- Dùng đúng: **composite index** (quy tắc *leftmost prefix*), **covering index**, **partial index**, **expression index**
- Biết khi nào index **vô dụng** hoặc **gây hại** (selectivity, chi phí ghi)
- **Đọc được `EXPLAIN ANALYZE`** của PostgreSQL - kỹ năng số 1 khi tối ưu query
- Phát hiện và sửa **N+1 query** (Go & Python)
- Nắm chắc **ACID**, **isolation level** và 5 anomaly: *dirty read, non-repeatable read, phantom, lost update, write skew* - có demo thật với 2 session
- Dùng **`SELECT ... FOR UPDATE`**, **optimistic locking** (cột `version`), xử lý **deadlock**
- Hiểu **MVCC** - vì sao Postgres "đọc không chặn ghi"
- Cấu hình **connection pool**, hiểu **replication**, **partitioning**, **sharding**
- **Backup/restore** và **migration không downtime** (expand/contract)

!!! note "Mọi con số trong bài là số đo thật"
    Toàn bộ output trong bài được chạy thật trên **PostgreSQL 17.11** (Docker `postgres:17-alpine`), bảng `orders` **1 triệu dòng**, máy laptop/VM thông thường. Máy bạn sẽ ra số khác một chút, nhưng **tỷ lệ** (nhanh hơn bao nhiêu lần) sẽ tương tự.

## 🧪 0. Chuẩn bị môi trường thí nghiệm

Bài này là bài "thực hành trong phòng lab". Hãy chạy theo, đừng chỉ đọc.

```bash
# 1. Chạy PostgreSQL 17 bằng Docker
docker run -d --name pg-lesson -e POSTGRES_PASSWORD=pass -p 5432:5432 postgres:17-alpine

# 2. Mở psql bên trong container
docker exec -it pg-lesson psql -U postgres
```

Tạo database `shop` với **100.000 khách hàng** và **1.000.000 đơn hàng** bằng `generate_series` (hàm sinh dãy số của Postgres - tạo dữ liệu giả cực nhanh):

```sql
CREATE DATABASE shop;
\c shop

CREATE TABLE customers (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email       text NOT NULL,
  full_name   text NOT NULL,
  city        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
INSERT INTO customers (email, full_name, city, created_at)
SELECT 'user' || g || '@example.com',
       'Khach hang ' || g,
       (ARRAY['Ha Noi','TP.HCM','Da Nang','Hai Phong','Can Tho'])[1 + g % 5],
       now() - (g % 1000) * interval '1 day'
FROM generate_series(1, 100000) g;

CREATE TABLE orders (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id  bigint NOT NULL REFERENCES customers(id),
  status       text   NOT NULL,
  total        numeric(12,0) NOT NULL,
  created_at   timestamptz NOT NULL
);
-- 90% delivered, 7% cancelled, 3% pending - giống thực tế một shop TMĐT
INSERT INTO orders (customer_id, status, total, created_at)
SELECT 1 + (random() * 99999)::int,
       CASE WHEN r < 0.90 THEN 'delivered'
            WHEN r < 0.97 THEN 'cancelled'
            ELSE 'pending' END,
       (10 + random() * 5000)::int * 1000,
       timestamptz '2024-01-01' + random() * interval '730 days'
FROM (SELECT random() AS r FROM generate_series(1, 1000000)) s;

ANALYZE customers; ANALYZE orders;   -- cập nhật thống kê cho query planner
```

Trong psql, bật `\timing on` để xem thời gian mỗi lệnh. Việc chèn 1 triệu dòng mất khoảng 30 giây.

## 📖 1. Database lưu dữ liệu thế nào?

### 1.1 Page - "trang giấy" 8KB

Database **không** đọc/ghi từng dòng lẻ lên đĩa. Nó chia file dữ liệu thành các khối cố định gọi là **page** (hay *block*). PostgreSQL dùng page **8KB**, MySQL InnoDB dùng **16KB**.

> 💡 **Ví von**: Bảng `orders` giống một **cuốn sổ bán hàng**. Mỗi **trang sổ** (page) chứa được khoảng 100 dòng. Muốn xem 1 dòng, thủ kho phải **lật nguyên trang** ra - không thể chỉ rút 1 dòng. Vì vậy, số **trang phải lật** (I/O) chứ không phải số dòng mới là thước đo chi phí thật.

```sql
SELECT pg_size_pretty(pg_relation_size('orders')) AS heap,
       pg_size_pretty(pg_indexes_size('orders'))  AS idx,
       pg_relation_size('orders')/8192            AS pages;
SELECT current_setting('block_size');
```

```text
 heap  |  idx  | pages
-------+-------+-------
 72 MB | 21 MB |  9216

 current_setting
-----------------
 8192
```

1 triệu đơn hàng = **9.216 trang** × 8KB = 72MB. Index khóa chính (`orders_pkey`) chiếm thêm 21MB.

### 1.2 Heap - dữ liệu nằm "lộn xộn"

Trong Postgres, bảng được lưu dưới dạng **heap** ("đống"): dòng mới được đặt vào **chỗ trống bất kỳ**, không theo thứ tự nào cả. Mỗi dòng có một địa chỉ vật lý gọi là **`ctid` = (số trang, vị trí trong trang)**:

```sql
SELECT ctid, id, customer_id, status FROM orders ORDER BY id LIMIT 5;
```

```text
 ctid  | id | customer_id |  status
-------+----+-------------+-----------
 (0,1) |  1 |       98058 | delivered
 (0,2) |  2 |       52034 | pending
 (0,3) |  3 |       78980 | delivered
 (0,4) |  4 |       30805 | delivered
 (0,5) |  5 |       76130 | delivered
```

`(0,1)` nghĩa là "trang 0, ô số 1". Index thực chất là một cuốn **mục lục** lưu `giá trị → ctid`.

```mermaid
flowchart LR
    subgraph PAGE["Page 8KB (trang số 0)"]
        direction TB
        H["Page header<br/>(LSN, free space...)"]
        LP["Line pointers<br/>ô 1 → offset 8150<br/>ô 2 → offset 8100<br/>..."]
        FREE["... khoảng trống ..."]
        T["Tuples (dòng dữ liệu)<br/>ghi từ CUỐI trang ngược lên"]
        H --> LP --> FREE --> T
    end
    IDX["Index: customer_id=4242 → ctid (512,7)"] -.->|"trỏ tới"| PAGE
```

!!! note "InnoDB (MySQL) khác Postgres"
    MySQL InnoDB dùng **clustered index**: dữ liệu bảng **được sắp xếp theo khóa chính** và nằm ngay trong lá của B+tree khóa chính. Index phụ (secondary index) lưu `giá trị → khóa chính` (không phải địa chỉ vật lý). Hệ quả: ở MySQL, khóa chính **ngẫu nhiên** (UUIDv4) làm chèn chậm và phân mảnh; nên dùng khóa tăng dần (auto-increment, UUIDv7, ULID).

### 1.3 Buffer pool - RAM làm "bàn làm việc"

Đọc đĩa chậm hơn đọc RAM hàng trăm đến hàng nghìn lần. Database giữ các page hay dùng trong RAM gọi là **buffer pool** (Postgres: `shared_buffers`, mặc định 128MB).

```mermaid
flowchart TB
    Q["Query cần page 512"] --> BP{"Page 512 có trong<br/>shared_buffers?"}
    BP -->|"Có (shared hit)"| RAM["Đọc từ RAM<br/>~100 ns"]
    BP -->|"Không (read)"| OS{"Có trong<br/>OS page cache?"}
    OS -->|"Có"| OSC["Copy từ cache của OS<br/>~vài µs"]
    OS -->|"Không"| DISK["Đọc SSD<br/>~100 µs"]
    DISK --> LOAD["Nạp vào buffer pool<br/>(đẩy page ít dùng ra - LRU/clock)"]
    OSC --> LOAD
```

Khi xem `EXPLAIN (ANALYZE, BUFFERS)` bạn sẽ thấy `shared hit=16 read=3`: 16 page lấy từ RAM, 3 page phải đọc từ ngoài. Lần chạy thứ 2 thường nhanh hơn vì page đã "nóng".

### 1.4 WAL - nhật ký ghi trước

Câu hỏi: nếu mất điện đúng lúc database đang ghi page xuống đĩa thì sao? Page ghi dở → hỏng dữ liệu.

Giải pháp: **WAL (Write-Ahead Log)** - *ghi nhật ký trước, ghi dữ liệu sau*:

1. Transaction thay đổi dữ liệu → thay đổi page **trong RAM** (page "bẩn" - dirty page)
2. Ghi một bản ghi **mô tả thay đổi** vào WAL (file tuần tự, chỉ nối thêm - *append-only*)
3. Khi `COMMIT`: **fsync WAL** xuống đĩa → trả "OK" cho client. Page dữ liệu **chưa cần** ghi xuống!
4. Định kỳ, tiến trình **checkpoint** mới ghi các dirty page xuống file dữ liệu
5. Nếu sập: khởi động lại → đọc WAL từ checkpoint cuối và **"phát lại" (replay)** → dữ liệu đầy đủ

```mermaid
sequenceDiagram
    participant C as Client
    participant PG as PostgreSQL
    participant BUF as Buffer pool (RAM)
    participant WAL as WAL (đĩa, tuần tự)
    participant DATA as Data files (đĩa)
    C->>PG: UPDATE ... ; COMMIT
    PG->>BUF: Sửa page trong RAM (dirty)
    PG->>WAL: Ghi bản ghi WAL + fsync
    PG-->>C: COMMIT OK
    Note over BUF,DATA: Vài phút sau...
    PG->>DATA: Checkpoint: ghi dirty pages xuống
    Note over PG,DATA: Nếu sập trước checkpoint:<br/>khởi động lại → replay WAL
```

> 💡 **Ví von**: Thủ quỹ cửa hàng không kịp cập nhật sổ cái sau mỗi giao dịch. Cô ghi nhanh vào **sổ nháp** theo thứ tự thời gian ("10h05: bán 1 iPhone, thu 25tr"). Cuối ngày mới chép vào sổ cái. Nếu sổ cái bị đổ nước, lấy sổ nháp ra **chép lại** là xong. Sổ nháp chính là WAL.

Tại sao WAL nhanh? Vì ghi **tuần tự** (nối vào cuối file) nhanh hơn nhiều so với ghi **ngẫu nhiên** vào hàng nghìn page rải rác. Đo thử lượng WAL sinh ra khi chèn 10.000 dòng:

```sql
CREATE TABLE wal_demo (id int PRIMARY KEY, v int);
SELECT pg_current_wal_lsn() AS before \gset
INSERT INTO wal_demo SELECT g, g FROM generate_series(1, 10000) g;
SELECT pg_current_wal_lsn() AS after,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), :'before')) AS wal_written;
```

```text
   after    | wal_written
------------+-------------
 0/5EE50338 | 1274 kB
```

`LSN` (Log Sequence Number) là "số trang" của nhật ký. WAL còn là nền tảng của **replication** (mục 11) và **point-in-time recovery** (mục 13): replica chỉ cần nhận WAL và phát lại.

## 📖 2. Index - "mục lục" của database

### 2.1 Không có index: đọc cả cuốn sổ

Tìm đơn hàng của khách `4242`:

```sql
EXPLAIN ANALYZE SELECT * FROM orders WHERE customer_id = 4242;
```

```text
 Gather  (cost=1000.00..15425.43 rows=11 width=39) (actual time=13.475..36.836 rows=13 loops=1)
   Workers Planned: 2
   Workers Launched: 2
   ->  Parallel Seq Scan on orders  (cost=0.00..14424.33 rows=5 width=39) (actual time=6.259..26.363 rows=4 loops=3)
         Filter: (customer_id = 4242)
         Rows Removed by Filter: 333329
 Planning Time: 0.142 ms
 Execution Time: 36.884 ms
```

**Seq Scan** = quét tuần tự **toàn bộ 1 triệu dòng** (3 tiến trình chia nhau, mỗi tiến trình loại bỏ 333.329 dòng) để tìm **13 dòng**. 37ms nghe có vẻ nhanh, nhưng nếu API này được gọi 500 lần/giây → 500 × 37ms = **18,5 giây CPU mỗi giây** → server sập.

### 2.2 Thêm index: nhanh hơn ~650 lần

```sql
CREATE INDEX idx_orders_customer ON orders (customer_id);   -- mất 409ms
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM orders WHERE customer_id = 4242;
```

```text
 Bitmap Heap Scan on orders  (cost=4.51..47.51 rows=11 width=39) (actual time=0.018..0.029 rows=13 loops=1)
   Recheck Cond: (customer_id = 4242)
   Heap Blocks: exact=13
   Buffers: shared hit=16
   ->  Bitmap Index Scan on idx_orders_customer  (cost=0.00..4.51 rows=11 width=0) (actual time=0.013..0.013 rows=13 loops=1)
         Index Cond: (customer_id = 4242)
         Buffers: shared hit=3
 Planning Time: 0.069 ms
 Execution Time: 0.056 ms
```

| | Không index | Có index |
|---|---|---|
| Thời gian | 36.884 ms | **0.056 ms** (~650× nhanh hơn) |
| Số page phải đọc | ~9.216 (toàn bảng) | **16** (3 page index + 13 page dữ liệu) |
| Kích thước index | - | 9 MB |

Chỉ cần đọc **16 page** thay vì **9.216 page**. Đó là toàn bộ bí mật của index: **giảm số page phải đọc**.

### 2.3 B-tree / B+tree - cấu trúc bên trong index

Index mặc định trong Postgres, MySQL, SQL Server, Oracle... là **B+tree** (Postgres gọi là `btree`, thực chất là biến thể B+tree Lehman-Yao).

Bạn đã biết **cây nhị phân tìm kiếm (BST)** ở [Bài 9 thuật toán](../algorithms/09-trees-bst.md): mỗi nút có 2 con. B+tree là BST "béo": **mỗi nút là 1 page 8KB** chứa **hàng trăm khóa** và hàng trăm con trỏ.

```mermaid
graph TD
    R["Root page<br/>[ 30000 | 60000 ]"]
    I1["Internal page<br/>[ 10000 | 20000 ]"]
    I2["Internal page<br/>[ 40000 | 50000 ]"]
    I3["Internal page<br/>[ 70000 | 85000 ]"]
    L1["Leaf: 1..9999<br/>key → ctid"]
    L2["Leaf: 10000..19999"]
    L3["Leaf: 20000..29999"]
    L4["Leaf: 30000..39999"]
    L5["Leaf: ... "]
    L6["Leaf: 85000..99999"]
    R -->|"key nhỏ hơn 30000"| I1
    R -->|"30000 đến 59999"| I2
    R -->|"từ 60000"| I3
    I1 --> L1
    I1 --> L2
    I1 --> L3
    I2 --> L4
    I2 --> L5
    I3 --> L6
    L1 -.->|"con trỏ sang lá kế"| L2
    L2 -.-> L3
    L3 -.-> L4
    L4 -.-> L5
    L5 -.-> L6
```

Đặc điểm quan trọng của **B+tree**:

1. **Cây rất thấp và rộng**: mỗi page chứa ~300-500 khóa → cây 3 tầng chứa được 500³ = **125 triệu** khóa, 4 tầng = hàng chục tỷ. Tìm 1 khóa trong 100 triệu dòng chỉ cần đọc **3-4 page**!
2. **Dữ liệu (con trỏ tới dòng) chỉ nằm ở lá**. Nút trong chỉ để "chỉ đường".
3. **Các lá nối với nhau thành danh sách liên kết** (có thứ tự) → truy vấn khoảng `BETWEEN`, `>`, `<`, `ORDER BY` rất nhanh: tìm điểm đầu rồi **đi ngang** trên lá.
4. **Luôn cân bằng**: mọi lá cùng độ sâu → hiệu năng ổn định, O(log n).

> 💡 **Ví von**: Danh bạ điện thoại in giấy. Mở trang đầu thấy "A-F trang 1-200, G-M trang 201-400...", lật tới đúng phần, rồi tới đúng trang. Muốn tìm tất cả tên bắt đầu bằng "Ng" → tìm trang đầu tiên rồi **lật tiếp các trang kế** (lá nối nhau).

B+tree là cây nhiều nhánh, nhưng ý tưởng "so sánh rồi rẽ trái/phải" giống hệt BST. Bấm ▶ để xem tìm kiếm trên BST - B+tree làm y hệt, chỉ khác mỗi nút có hàng trăm nhánh thay vì 2:

<div class="algo-viz" data-viz="tree" data-algo="bst-search" data-input="50,30,70,20,40,60,80,35,45" data-target="45" data-title="Tìm khóa 45 - mỗi bước loại bỏ một nửa cây"></div>

**Vì sao không dùng BST hay hash table cho index trên đĩa?**

| Cấu trúc | Vấn đề khi làm index trên đĩa |
|---|---|
| BST / AVL / Red-Black | Mỗi nút 1 khóa → cây cao ~20 tầng với 1 triệu khóa → **20 lần đọc đĩa** |
| Hash table | Chỉ hỗ trợ `=`, **không** hỗ trợ `<`, `>`, `BETWEEN`, `ORDER BY`, `LIKE 'abc%'` |
| **B+tree** | Cây 3-4 tầng, hỗ trợ cả `=` lẫn khoảng, có thứ tự sẵn |

### 2.4 Hash index

Postgres có `USING hash` - chỉ phục vụ phép `=`:

```sql
CREATE INDEX idx_customers_email_hash ON customers USING hash (email);
EXPLAIN ANALYZE SELECT * FROM customers WHERE email = 'user777@example.com';
```

```text
 Index Scan using idx_customers_email_hash on customers  (cost=0.00..8.02 rows=1 width=61) (actual time=0.021..0.022 rows=1 loops=1)
   Index Cond: (email = 'user777@example.com'::text)
 Execution Time: 0.037 ms
```

Nhanh, nhưng so với B-tree trên cùng cột (0.072ms, kích thước 3992kB so với hash 4112kB) thì **không đáng kể**. Hash index không hỗ trợ `UNIQUE`, không hỗ trợ khoảng, không sắp xếp. **Thực tế: 99% trường hợp dùng B-tree.** Hash index có đất dụng võ khi khóa rất dài (URL, token) vì chỉ lưu mã băm 4 byte. (Hash table trong RAM thì lại là "vua" - xem [Bài 3 thuật toán](../algorithms/03-hashing.md) và Redis ở [Bài 8](./08-caching.md).)

### 2.5 Composite index & quy tắc leftmost prefix

Index **nhiều cột** `(customer_id, created_at)` được sắp xếp **theo cột 1 trước, trong cùng cột 1 thì theo cột 2** - giống danh bạ sắp theo **(Họ, Tên)**.

```text
Index (customer_id, created_at):
  (4241, 2024-03-02) → ctid
  (4242, 2024-02-11) → ctid   ┐
  (4242, 2024-09-30) → ctid   │ các đơn của khách 4242
  (4242, 2025-04-18) → ctid   │ nằm LIỀN NHAU,
  (4242, 2025-11-07) → ctid   ┘ đã sắp theo ngày
  (4243, 2024-01-05) → ctid
```

```sql
DROP INDEX idx_orders_customer;
CREATE INDEX idx_orders_cust_created ON orders (customer_id, created_at);
```

**Truy vấn 1 - dùng cả 2 cột** ✅:

```sql
EXPLAIN ANALYZE SELECT id, total FROM orders
WHERE customer_id = 4242 AND created_at >= '2025-01-01' ORDER BY created_at DESC;
```

```text
 Sort  (cost=24.26..24.27 rows=5 width=22) (actual time=0.098..0.100 rows=6 loops=1)
   Sort Key: created_at DESC
   Sort Method: quicksort  Memory: 25kB
   ->  Bitmap Heap Scan on orders  (cost=4.48..24.20 rows=5 width=22) (actual time=0.069..0.080 rows=6 loops=1)
         Recheck Cond: ((customer_id = 4242) AND (created_at >= '2025-01-01 00:00:00+00'::timestamp with time zone))
         Heap Blocks: exact=6
         ->  Bitmap Index Scan on idx_orders_cust_created  (cost=0.00..4.47 rows=5 width=0) (actual time=0.058..0.059 rows=6 loops=1)
               Index Cond: ((customer_id = 4242) AND (created_at >= '2025-01-01 00:00:00+00'::timestamp with time zone))
 Execution Time: 0.187 ms
```

**Truy vấn 2 - chỉ cột đầu** ✅ (tiền tố bên trái vẫn dùng được):

```text
 Bitmap Heap Scan on orders  (cost=4.51..47.51 rows=11 width=14) (actual time=0.034..0.054 rows=13 loops=1)
   Recheck Cond: (customer_id = 4242)
   ->  Bitmap Index Scan on idx_orders_cust_created  (cost=0.00..4.51 rows=11 width=0) (actual time=0.025..0.025 rows=13 loops=1)
         Index Cond: (customer_id = 4242)
 Execution Time: 0.100 ms
```

**Truy vấn 3 - chỉ cột thứ hai** ❌ (bỏ qua cột trái nhất):

```sql
EXPLAIN ANALYZE SELECT id, total FROM orders
WHERE created_at >= '2025-12-30' AND created_at < '2025-12-31';
```

```text
 Gather  (cost=1000.00..16582.80 rows=1168 width=14) (actual time=0.373..33.328 rows=1348 loops=1)
   Workers Planned: 2
   Workers Launched: 2
   ->  Parallel Seq Scan on orders  (cost=0.00..15466.00 rows=487 width=14) (actual time=0.093..24.673 rows=449 loops=3)
         Filter: ((created_at >= '2025-12-30 00:00:00+00'::timestamp with time zone) AND (created_at < '2025-12-31 00:00:00+00'::timestamp with time zone))
         Rows Removed by Filter: 332884
 Execution Time: 33.405 ms
```

Quay lại **Seq Scan**! Giống như danh bạ sắp theo (Họ, Tên) - bạn **không thể** tìm nhanh "tất cả người tên Lan" vì người tên Lan nằm rải rác ở họ Nguyễn, họ Trần, họ Lê...

!!! tip "Quy tắc leftmost prefix"
    Index `(a, b, c)` phục vụ được: `a`, `(a, b)`, `(a, b, c)`, và `a = ? ORDER BY b`.
    **Không** phục vụ tốt: `b`, `c`, `(b, c)`.
    `a = ? AND c = ?` chỉ dùng được phần `a`, phần `c` phải lọc thêm.

    **Thứ tự cột**: đặt cột so sánh **bằng** (`=`) trước, cột so sánh **khoảng** (`>`, `<`, `BETWEEN`) hoặc `ORDER BY` sau. Index `(created_at, customer_id)` cho truy vấn 1 sẽ kém hơn vì phải quét cả khoảng ngày rồi mới lọc khách.

    *(PostgreSQL 18 có thêm "skip scan" giúp phần nào trường hợp bỏ cột đầu khi cột đầu ít giá trị khác nhau - nhưng đừng thiết kế dựa vào nó.)*

### 2.6 Covering index & Index-Only Scan

Ở trên, sau khi tra index, Postgres vẫn phải **đọc heap** (bảng) để lấy các cột không có trong index (`Heap Blocks: exact=13`). Nếu **mọi cột** query cần đều nằm trong index → khỏi đọc heap: **Index-Only Scan**.

```sql
-- Màn hình "5 đơn gần nhất" của khách: cần created_at và total
CREATE INDEX idx_orders_cust_created_cov ON orders (customer_id, created_at) INCLUDE (total);
VACUUM orders;   -- cập nhật visibility map (giải thích ở mục MVCC)
EXPLAIN (ANALYZE, BUFFERS) SELECT created_at, total FROM orders
WHERE customer_id = 4242 ORDER BY created_at DESC LIMIT 5;
```

```text
 Limit  (cost=0.42..2.33 rows=5 width=14) (actual time=0.084..0.086 rows=5 loops=1)
   Buffers: shared hit=1 read=3
   ->  Index Only Scan Backward using idx_orders_cust_created_cov on orders  (cost=0.42..4.62 rows=11 width=14) (actual time=0.083..0.084 rows=5 loops=1)
         Index Cond: (customer_id = 4242)
         Heap Fetches: 0
         Buffers: shared hit=1 read=3
 Execution Time: 0.109 ms
```

- `Index Only Scan` + `Heap Fetches: 0` → **không đụng tới bảng**, chỉ đọc 4 page.
- `Backward` → đi ngược trên lá B+tree để có `ORDER BY ... DESC` **không cần sort**.
- `INCLUDE (total)`: `total` được lưu ở lá nhưng **không** tham gia sắp xếp → index gọn hơn đưa `total` vào khóa.

Trade-off: index to hơn, ghi chậm hơn. Chỉ dùng cho những query **cực nóng**.

### 2.7 Partial index - chỉ đánh index một phần

Trang admin cần "20 đơn **pending** cũ nhất để xử lý". Chỉ 3% đơn là pending. Đánh index cả 1 triệu dòng thì phí:

```sql
CREATE INDEX idx_orders_pending ON orders (created_at) WHERE status = 'pending';
EXPLAIN ANALYZE SELECT * FROM orders WHERE status = 'pending' ORDER BY created_at LIMIT 20;
```

```text
 Limit  (cost=0.29..24.74 rows=20 width=39) (actual time=0.030..0.061 rows=20 loops=1)
   ->  Index Scan using idx_orders_pending on orders  (cost=0.29..37662.38 rows=30800 width=39) (actual time=0.029..0.058 rows=20 loops=1)
 Execution Time: 0.080 ms
```

So với index thường trên `status` (phải lấy 30.067 dòng pending rồi sort, **20.234 ms**), partial index chỉ **0.080 ms** và nhỏ xíu:

```text
      indexrelname       | pg_size_pretty
-------------------------+----------------
 orders_pkey             | 21 MB
 idx_orders_cust_created | 30 MB
 idx_orders_pending      | 680 kB
```

Ứng dụng khác của partial index: **unique có điều kiện** - "mỗi email chỉ có 1 tài khoản **chưa bị xóa**":

```sql
CREATE UNIQUE INDEX uniq_active_email ON users (email) WHERE deleted_at IS NULL;
```

### 2.8 Expression index - khi query bọc cột trong hàm

```sql
CREATE INDEX idx_customers_email ON customers (email);
EXPLAIN ANALYZE SELECT * FROM customers WHERE lower(email) = 'user777@example.com';
```

```text
 Seq Scan on customers  (cost=0.00..2649.00 rows=500 width=61) (actual time=0.390..31.472 rows=1 loops=1)
   Filter: (lower(email) = 'user777@example.com'::text)
   Rows Removed by Filter: 99999
 Execution Time: 31.489 ms
```

Có index trên `email` nhưng **không dùng được** vì index lưu `email`, còn query hỏi `lower(email)`. Sửa bằng index trên **biểu thức**:

```sql
CREATE INDEX idx_customers_email_lower ON customers (lower(email));
```

```text
 Bitmap Heap Scan on customers  (cost=16.29..930.36 rows=500 width=61) (actual time=0.066..0.067 rows=1 loops=1)
   Recheck Cond: (lower(email) = 'user777@example.com'::text)
   ->  Bitmap Index Scan on idx_customers_email_lower  (cost=0.00..16.17 rows=500 width=0) (actual time=0.046..0.046 rows=1 loops=1)
         Index Cond: (lower(email) = 'user777@example.com'::text)
 Execution Time: 0.123 ms
```

Tương tự, các cách viết sau đều **giết index** (gọi là query không *sargable*):

| ❌ Không dùng được index | ✅ Viết lại |
|---|---|
| `WHERE date(created_at) = '2025-06-01'` (61.6ms, Seq Scan) | `WHERE created_at >= '2025-06-01' AND created_at < '2025-06-02'` (2.2ms với index `created_at`) |
| `WHERE customer_id + 0 = 4242` (28.8ms) | `WHERE customer_id = 4242` (0.05ms) |
| `WHERE email LIKE '%@gmail.com'` | Lưu thêm cột `email_domain`, hoặc dùng `pg_trgm` + GIN |
| `WHERE phone = 912345678` khi `phone` là `text` | `WHERE phone = '0912345678'` (đúng kiểu) |

### 2.9 Selectivity - index không phải lúc nào cũng được dùng

**Selectivity** (độ chọn lọc) = tỷ lệ dòng mà điều kiện giữ lại. Càng ít dòng → càng "chọn lọc" → index càng có lợi.

```text
  status   | count  | pct
-----------+--------+------
 cancelled |  70505 |  7.1
 delivered | 899428 | 89.9
 pending   |  30067 |  3.0
```

Tạo index trên `status` rồi hỏi planner:

```sql
CREATE INDEX idx_orders_status ON orders (status);
EXPLAIN SELECT * FROM orders WHERE status = 'delivered';
EXPLAIN SELECT * FROM orders WHERE status = 'pending';
```

```text
 Seq Scan on orders  (cost=0.00..21716.00 rows=897100 width=39)
   Filter: (status = 'delivered'::text)

 Bitmap Heap Scan on orders  (cost=347.12..9948.12 rows=30800 width=39)
   Recheck Cond: (status = 'pending'::text)
   ->  Bitmap Index Scan on idx_orders_status  (cost=0.00..339.43 rows=30800 width=0)
         Index Cond: (status = 'pending'::text)
```

Cùng một index, **`delivered` (90%) → planner bỏ qua index**, `pending` (3%) → dùng index. Vì sao? Lấy 90% dòng qua index = nhảy qua lại hàng trăm nghìn lần giữa index và heap (**random I/O**), chậm hơn đọc thẳng cả bảng (**sequential I/O**).

> 💡 **Ví von**: Muốn đọc 90% cuốn sách thì cứ đọc từ đầu tới cuối, ai lại tra mục lục cho từng trang?

Planner biết tỷ lệ này nhờ **thống kê** (`ANALYZE`, xem `pg_stats`). Quy tắc kinh nghiệm: index B-tree có lợi khi điều kiện lọc giữ lại **dưới ~5-10%** số dòng (tùy độ rộng dòng, SSD hay HDD).

Các loại cột **kém chọn lọc**: `gender`, `is_active`, `status` có 3 giá trị... Đừng đánh index đơn lẻ cho chúng - hãy dùng **partial index** hoặc đặt chúng **sau** trong composite index.

### 2.10 Khi index gây hại - chi phí ghi

Mỗi `INSERT`/`UPDATE`/`DELETE` phải cập nhật **mọi** index của bảng. Thí nghiệm: chèn 1 triệu dòng vào bảng không index và bảng có 5 index:

```sql
CREATE TABLE bench_noidx (id bigint, customer_id bigint, status text, total numeric, created_at timestamptz);
CREATE TABLE bench_5idx (LIKE bench_noidx);
CREATE INDEX ON bench_5idx(id); CREATE INDEX ON bench_5idx(customer_id); CREATE INDEX ON bench_5idx(status);
CREATE INDEX ON bench_5idx(total); CREATE INDEX ON bench_5idx(created_at);
INSERT INTO bench_noidx SELECT id, customer_id, status, total, created_at FROM orders;
INSERT INTO bench_5idx  SELECT id, customer_id, status, total, created_at FROM orders;
```

```text
INSERT 0 1000000
Time: 1687.544 ms (00:01.688)
INSERT 0 1000000
Time: 17458.568 ms (00:17.459)
```

**Chậm hơn ~10 lần!** Ngoài ra index còn tốn **dung lượng** (bảng 72MB nhưng các index cộng lại dễ vượt 100MB), tốn **RAM** buffer pool, làm **VACUUM** và **backup** lâu hơn.

!!! warning "Index là con dao hai lưỡi"
    - Đọc nhiều, ghi ít (catalog sản phẩm, profile) → index thoải mái.
    - Ghi cực nhiều (log, event, IoT) → chỉ index những gì **thật sự cần**.
    - Định kỳ tìm index **không ai dùng** để xóa:

    ```sql
    SELECT relname, indexrelname, idx_scan, pg_size_pretty(pg_relation_size(indexrelid))
    FROM pg_stat_user_indexes WHERE idx_scan = 0 ORDER BY pg_relation_size(indexrelid) DESC;
    ```

### 2.11 Các loại index khác của PostgreSQL

| Loại | Dùng cho | Ví dụ |
|---|---|---|
| **B-tree** (mặc định) | `=`, `<`, `>`, `BETWEEN`, `ORDER BY`, `LIKE 'abc%'` | Hầu hết mọi thứ |
| **Hash** | Chỉ `=` | Token dài |
| **GIN** | Giá trị "chứa nhiều phần tử": JSONB, mảng, full-text | `WHERE tags @> '{sale}'`, `WHERE doc @> '{"color":"red"}'` |
| **GiST** | Dữ liệu hình học, khoảng, gần đúng | PostGIS "quán cà phê trong bán kính 2km", `tsrange` chống đặt phòng trùng |
| **BRIN** | Bảng **cực lớn**, dữ liệu **tự nhiên có thứ tự** (thời gian) | Bảng log 10 tỷ dòng, index chỉ vài MB |
| **pg_trgm + GIN** | `LIKE '%abc%'`, tìm gần đúng | Ô tìm kiếm tên sản phẩm |
| **HNSW / IVFFlat** (pgvector) | Tìm vector gần nhất | Tìm kiếm ngữ nghĩa, RAG - xem [Bài 7](./07-nosql.md) |

### 💡 Tips quan trọng về index

- **Khóa ngoại không tự có index** trong Postgres (MySQL thì có). Hầu như lúc nào bạn cũng nên index cột FK (`orders.customer_id`) vì JOIN và `ON DELETE` đều cần.
- Index theo **query**, không theo **bảng**: liệt kê các query nóng nhất rồi mới quyết định index.
- Tạo index trên production **luôn dùng `CREATE INDEX CONCURRENTLY`** (mục 14).
- Một composite index tốt thường thay được 2-3 index đơn.

## 📖 3. Đọc EXPLAIN & EXPLAIN ANALYZE

`EXPLAIN` cho bạn xem **kế hoạch** (plan) mà **query planner** chọn. Thêm `ANALYZE` thì Postgres **chạy thật** và báo số liệu thật.

!!! warning "EXPLAIN ANALYZE chạy thật câu lệnh!"
    `EXPLAIN ANALYZE DELETE FROM orders` sẽ **xóa thật**. Với lệnh ghi, bọc trong transaction: `BEGIN; EXPLAIN ANALYZE UPDATE ...; ROLLBACK;`

### 3.1 Giải phẫu một dòng plan

```text
->  Bitmap Index Scan on idx_orders_status  (cost=0.00..339.43 rows=30800 width=0) (actual time=2.208..2.209 rows=30067 loops=1)
    └── loại node ──────── └── dùng index nào   └─ ước lượng ───────────────────┘ └─ thực tế ───────────────────────────────────┘
```

| Thành phần | Ý nghĩa |
|---|---|
| `cost=0.00..339.43` | Chi phí **ước lượng** (đơn vị tùy ý, ~ "số page đọc tuần tự"). Số đầu: chi phí trước khi trả dòng đầu tiên. Số sau: tổng chi phí |
| `rows=30800` | Planner **đoán** trả về 30.800 dòng |
| `width=39` | Độ rộng trung bình mỗi dòng (byte) |
| `actual time=2.208..2.209` | Thời gian thật (ms): tới dòng đầu .. tới dòng cuối, **mỗi loop** |
| `rows=30067` | Số dòng **thật** |
| `loops=1` | Node này chạy mấy lần (trong Nested Loop sẽ > 1: tổng thời gian = time × loops) |
| `Buffers: shared hit=16 read=3` | 16 page từ RAM, 3 page từ đĩa/OS cache |
| `Rows Removed by Filter` | Số dòng đọc lên rồi bỏ → càng lớn càng lãng phí |

!!! tip "Dấu hiệu số 1 của query tồi: ước lượng lệch thực tế"
    Nếu `rows=` ước lượng và `rows=` thực tế lệch nhau **10-100 lần** → planner đang "đoán mò" → chọn sai plan. Thường do thống kê cũ → chạy `ANALYZE ten_bang;`, hoặc do điều kiện phức tạp/tương quan giữa các cột (dùng `CREATE STATISTICS`).

### 3.2 Đọc plan từ trong ra ngoài

Plan là **cây**: node **thụt vào sâu nhất chạy trước**, kết quả chảy **lên trên**.

```sql
EXPLAIN ANALYZE
SELECT c.city, count(*) AS orders, sum(o.total) AS revenue
FROM orders o JOIN customers c ON c.id = o.customer_id
WHERE o.status = 'delivered' AND o.created_at >= '2025-01-01'
GROUP BY c.city ORDER BY revenue DESC;
```

```text
 Sort  (cost=20814.47..20814.48 rows=5 width=48) (actual time=135.332..137.924 rows=5 loops=1)
   Sort Key: (sum(o.total)) DESC
   Sort Method: quicksort  Memory: 25kB
   ->  Finalize GroupAggregate  (cost=20813.08..20814.41 rows=5 width=48) (actual time=135.250..137.880 rows=5 loops=1)
         Group Key: c.city
         ->  Gather Merge  (cost=20813.08..20814.25 rows=10 width=48) (actual time=135.237..137.858 rows=15 loops=1)
               Workers Planned: 2
               Workers Launched: 2
               ->  Sort  (cost=19813.06..19813.07 rows=5 width=48) (actual time=126.999..127.002 rows=5 loops=3)
                     Sort Key: c.city
                     ->  Partial HashAggregate  (cost=19812.94..19813.00 rows=5 width=48) (actual time=126.950..126.955 rows=5 loops=3)
                           Group Key: c.city
                           ->  Parallel Hash Join  (cost=2472.54..18424.51 rows=185124 width=14) (actual time=15.635..96.743 rows=149656 loops=3)
                                 Hash Cond: (o.customer_id = c.id)
                                 ->  Parallel Seq Scan on orders o  (cost=0.00..15466.00 rows=185124 width=14) (actual time=0.026..35.310 rows=149656 loops=3)
                                       Filter: ((created_at >= '2025-01-01 00:00:00+00'::timestamp with time zone) AND (status = 'delivered'::text))
                                       Rows Removed by Filter: 183678
                                 ->  Parallel Hash  (cost=1737.24..1737.24 rows=58824 width=16) (actual time=13.810..13.811 rows=33333 loops=3)
                                       Buckets: 131072  Batches: 1  Memory Usage: 5920kB
                                       ->  Parallel Seq Scan on customers c  (cost=0.00..1737.24 rows=58824 width=16) (actual time=0.021..4.369 rows=33333 loops=3)
 Planning Time: 2.552 ms
 Execution Time: 138.075 ms
```

Đọc theo thứ tự thực thi:

```mermaid
flowchart BT
    A["Parallel Seq Scan customers<br/>100k dòng"] --> B["Parallel Hash<br/>xây bảng băm id → city (5.9MB RAM)"]
    C["Parallel Seq Scan orders<br/>lọc delivered + 2025: ~449k dòng"] --> D["Parallel Hash Join<br/>o.customer_id = c.id"]
    B --> D
    D --> E["Partial HashAggregate<br/>mỗi worker gom theo city"]
    E --> F["Sort + Gather Merge<br/>gộp kết quả 3 tiến trình"]
    F --> G["Finalize GroupAggregate"]
    G --> H["Sort theo revenue DESC<br/>5 dòng"]
```

Nhận xét: query này **phải** đọc ~45% bảng orders (delivered + năm 2025) → Seq Scan là **đúng**, không phải lỗi. Muốn nhanh hơn nữa cho dashboard: **bảng tổng hợp trước** (materialized view, bảng `daily_revenue` cập nhật định kỳ) - xem mục 4.

### 3.3 Các loại node thường gặp

| Node | Nghĩa | Tốt hay xấu? |
|---|---|---|
| **Seq Scan** | Đọc toàn bảng | Tốt với bảng nhỏ hoặc lấy nhiều dòng; xấu nếu lấy vài dòng từ bảng lớn |
| **Index Scan** | Duyệt index, mỗi khóa nhảy sang heap lấy dòng | Tốt khi lấy ít dòng |
| **Index Only Scan** | Chỉ đọc index | Rất tốt (kiểm tra `Heap Fetches` thấp) |
| **Bitmap Index Scan + Bitmap Heap Scan** | Gom ctid từ index thành bitmap, sắp theo page rồi đọc heap 1 lượt | Tốt cho số dòng "vừa vừa", hoặc kết hợp nhiều index (`BitmapAnd/Or`) |
| **Nested Loop** | Với mỗi dòng bên ngoài, tìm dòng khớp bên trong | Tốt khi bên ngoài **ít** dòng và bên trong có index |
| **Hash Join** | Xây bảng băm từ bảng nhỏ, quét bảng lớn và tra | Tốt cho join lớn, không có thứ tự |
| **Merge Join** | Hai bên đã sắp xếp theo khóa join, "kéo khóa" song song | Tốt khi cả hai đã có thứ tự (index) |
| **Sort** | Sắp xếp; để ý `Sort Method: external merge Disk` = tràn ra đĩa | Tăng `work_mem` hoặc thêm index để khỏi sort |
| **HashAggregate / GroupAggregate** | `GROUP BY` | - |
| **Gather / Gather Merge** | Gộp kết quả từ các worker song song | - |

Ví dụ Nested Loop (khách 100..110 và đơn của họ):

```text
 Nested Loop  (cost=4.80..532.31 rows=110 width=30) (actual time=0.063..0.947 rows=109 loops=1)
   ->  Index Scan using customers_pkey on customers c  (cost=0.29..8.51 rows=11 width=24) (actual time=0.028..0.032 rows=11 loops=1)
         Index Cond: ((id >= 100) AND (id <= 110))
   ->  Bitmap Heap Scan on orders o  (cost=4.51..47.51 rows=11 width=22) (actual time=0.021..0.074 rows=10 loops=11)
         Recheck Cond: (c.id = customer_id)
         ->  Bitmap Index Scan on idx_orders_cust_created  (cost=0.00..4.51 rows=11 width=0) (actual time=0.012..0.012 rows=10 loops=11)
               Index Cond: (customer_id = c.id)
 Execution Time: 0.995 ms
```

`loops=11`: bên trong chạy 11 lần (một lần cho mỗi khách). Thời gian thật của node trong ≈ 0.074 × 11 ≈ 0.8ms.

```mermaid
flowchart LR
    subgraph NL["Nested Loop - O(n × log m)"]
        direction TB
        n1["for mỗi customer (11 dòng)"] --> n2["tra index orders.customer_id"]
    end
    subgraph HJ["Hash Join - O(n + m)"]
        direction TB
        h1["build: băm bảng nhỏ vào RAM"] --> h2["probe: quét bảng lớn, tra băm"]
    end
    subgraph MJ["Merge Join - O(n + m) nếu đã sắp"]
        direction TB
        m1["hai danh sách đã sắp theo khóa"] --> m2["đi song song như kéo khóa"]
    end
```

### 💡 Tips đọc EXPLAIN

- Luôn dùng `EXPLAIN (ANALYZE, BUFFERS)` - số page mới là chi phí thật.
- Tìm node có **actual time lớn nhất** (nhớ nhân `loops`) - đó là nút cổ chai.
- Tìm `Rows Removed by Filter` lớn trên bảng lớn → thiếu index.
- Tìm ước lượng `rows` lệch xa thực tế → `ANALYZE`.
- Dán plan vào [explain.dalibo.com](https://explain.dalibo.com) hoặc [explain.depesz.com](https://explain.depesz.com) để xem trực quan.

## 📖 4. Tối ưu query - quy trình thực chiến

```mermaid
flowchart TD
    A["Người dùng than: API chậm"] --> B["Đo: APM / log slow query<br/>(log_min_duration_statement)"]
    B --> C["Tìm query tốn nhất: pg_stat_statements<br/>(total_time = calls × mean_time)"]
    C --> D["EXPLAIN (ANALYZE, BUFFERS)"]
    D --> E{"Vấn đề?"}
    E -->|"Seq Scan lấy ít dòng"| F["Thêm / sửa index"]
    E -->|"Ước lượng lệch"| G["ANALYZE, CREATE STATISTICS"]
    E -->|"Hàm bọc cột"| H["Viết lại cho sargable<br/>hoặc expression index"]
    E -->|"Lấy quá nhiều dữ liệu"| I["Chỉ SELECT cột cần,<br/>phân trang keyset"]
    E -->|"Gọi quá nhiều query"| J["Sửa N+1 (mục 5)"]
    E -->|"Aggregate nặng lặp lại"| K["Bảng tổng hợp / materialized view / cache"]
    F --> L["Đo lại - so sánh trước/sau"]
    G --> L
    H --> L
    I --> L
    J --> L
    K --> L
```

!!! tip "pg_stat_statements - danh sách 'tội phạm'"
    Bật extension này trên production (cần `shared_preload_libraries = 'pg_stat_statements'`). Nó thống kê **mọi** query đã chạy:

    ```sql
    SELECT round(total_exec_time) AS total_ms, calls, round(mean_exec_time, 2) AS mean_ms, query
    FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;
    ```

    Query chạy 2ms nhưng gọi 10 triệu lần/ngày quan trọng hơn query 5 giây chạy 1 lần/ngày.

### 4.1 Phân trang: OFFSET vs keyset

`OFFSET` lớn buộc DB **đọc rồi bỏ đi** mọi dòng phía trước:

```sql
EXPLAIN ANALYZE SELECT id, total FROM orders ORDER BY id LIMIT 20 OFFSET 900000;
```

```text
 Limit  (cost=31679.53..31680.24 rows=20 width=14) (actual time=263.047..263.055 rows=20 loops=1)
   ->  Index Scan using orders_pkey on orders  (cost=0.42..35199.43 rows=1000000 width=14) (actual time=0.057..223.997 rows=900020 loops=1)
 Execution Time: 263.103 ms
```

**Keyset pagination** (còn gọi *cursor pagination*): nhớ khóa cuối cùng của trang trước:

```sql
EXPLAIN ANALYZE SELECT id, total FROM orders WHERE id > 900000 ORDER BY id LIMIT 20;
```

```text
 Limit  (cost=0.42..1.18 rows=20 width=14) (actual time=0.085..0.091 rows=20 loops=1)
   ->  Index Scan using orders_pkey on orders  (cost=0.42..3798.38 rows=100568 width=14) (actual time=0.084..0.088 rows=20 loops=1)
         Index Cond: (id > 900000)
 Execution Time: 0.116 ms
```

**263ms → 0.116ms** (~2.200 lần). Đây là lý do Facebook, Twitter, Shopee dùng "Xem thêm" / cuộn vô hạn với `cursor` thay vì "Trang 1, 2, 3... 45000". (Thiết kế API cursor: xem [Bài 3](./03-api-design.md).)

### 4.2 Checklist tối ưu nhanh

| Vấn đề | Cách xử lý |
|---|---|
| `SELECT *` | Chỉ lấy cột cần → ít dữ liệu truyền đi, có cơ hội Index-Only Scan |
| Đếm chính xác `count(*)` bảng khổng lồ | Dùng ước lượng `reltuples` từ `pg_class`, hoặc bộ đếm riêng |
| `OR` giữa các cột khác nhau | Viết thành `UNION ALL` hoặc để Postgres dùng BitmapOr |
| `IN (...)` với 10.000 phần tử | Dùng `= ANY($1)` với mảng, hoặc JOIN với bảng tạm |
| Sort tràn đĩa (`external merge`) | Index theo thứ tự cần, hoặc tăng `work_mem` cho session |
| Báo cáo tổng hợp chạy mỗi lần mở dashboard | Materialized view `REFRESH ... CONCURRENTLY` mỗi 5 phút, hoặc cache ([Bài 8](./08-caching.md)) |
| Transaction dài giữ khóa | Làm việc nặng (gọi API ngoài, gửi email) **ngoài** transaction |
| Chèn từng dòng một | Batch insert / `COPY` - nhanh hơn hàng chục lần |

## 📖 5. N+1 query - kẻ giết hiệu năng thầm lặng

### 5.1 N+1 là gì?

Trang "Đơn hàng gần đây" hiển thị 200 đơn kèm tên khách. Code ngây thơ:

1. `SELECT ... FROM orders LIMIT 200` → **1 query**
2. Với **mỗi** đơn: `SELECT full_name FROM customers WHERE id = ?` → **200 query**

Tổng **N+1 = 201** query. Mỗi query tốn một **round-trip** mạng (app → DB → app). Trên localhost ~0.1ms, nhưng trong cloud giữa 2 máy khác nhau ~0.5-2ms → 201 × 1ms = **200ms chỉ để chờ mạng**.

```mermaid
sequenceDiagram
    participant App
    participant DB
    App->>DB: SELECT ... FROM orders LIMIT 200
    DB-->>App: 200 đơn
    loop 200 lần
        App->>DB: SELECT full_name FROM customers WHERE id = ?
        DB-->>App: 1 tên
    end
    Note over App,DB: 201 round-trip!
```

N+1 cực kỳ phổ biến với **ORM** (GORM, SQLAlchemy, Django ORM, Hibernate) vì **lazy loading**: `order.customer.name` trông như truy cập thuộc tính nhưng thực ra bắn 1 query.

### 5.2 Demo và cách sửa

Hai cách sửa:

- **JOIN**: 1 query lấy tất cả.
- **Batch loading** (`WHERE id = ANY($1)`): 2 query - lấy đơn, gom các `customer_id`, lấy khách **một lần**. Đây là cách ORM làm khi bạn dùng `Preload` (GORM), `selectinload` (SQLAlchemy), `prefetch_related` (Django), và cách **DataLoader** trong GraphQL làm.

=== "Go"

    ```go
    // go.mod: github.com/jackc/pgx/v5 v5.8.0 (bản cuối hỗ trợ Go 1.24)
    package main

    import (
    	"context"
    	"fmt"
    	"log"
    	"time"

    	"github.com/jackc/pgx/v5/pgxpool"
    )

    type Order struct {
    	ID           int64
    	CustomerID   int64
    	Total        int64
    	CustomerName string
    }

    // ❌ N+1: 1 query lấy đơn + N query lấy tên khách
    func listOrdersNPlus1(ctx context.Context, db *pgxpool.Pool) ([]Order, int, error) {
    	queries := 0
    	rows, err := db.Query(ctx,
    		`SELECT id, customer_id, total::bigint FROM orders ORDER BY id DESC LIMIT 200`)
    	if err != nil {
    		return nil, 0, err
    	}
    	queries++
    	var orders []Order
    	for rows.Next() {
    		var o Order
    		if err := rows.Scan(&o.ID, &o.CustomerID, &o.Total); err != nil {
    			return nil, 0, err
    		}
    		orders = append(orders, o)
    	}
    	rows.Close()
    	for i := range orders { // mỗi đơn 1 query → 200 round-trip!
    		err := db.QueryRow(ctx, `SELECT full_name FROM customers WHERE id = $1`,
    			orders[i].CustomerID).Scan(&orders[i].CustomerName)
    		if err != nil {
    			return nil, 0, err
    		}
    		queries++
    	}
    	return orders, queries, nil
    }

    // ✅ Cách 1: JOIN - 1 query duy nhất
    func listOrdersJoin(ctx context.Context, db *pgxpool.Pool) ([]Order, int, error) {
    	rows, err := db.Query(ctx, `
    		SELECT o.id, o.customer_id, o.total::bigint, c.full_name
    		FROM orders o JOIN customers c ON c.id = o.customer_id
    		ORDER BY o.id DESC LIMIT 200`)
    	if err != nil {
    		return nil, 0, err
    	}
    	defer rows.Close()
    	var orders []Order
    	for rows.Next() {
    		var o Order
    		if err := rows.Scan(&o.ID, &o.CustomerID, &o.Total, &o.CustomerName); err != nil {
    			return nil, 0, err
    		}
    		orders = append(orders, o)
    	}
    	return orders, 1, rows.Err()
    }

    // ✅ Cách 2: batch "WHERE id = ANY($1)" - 2 query (kiểu DataLoader / ORM preload)
    func listOrdersBatch(ctx context.Context, db *pgxpool.Pool) ([]Order, int, error) {
    	rows, err := db.Query(ctx,
    		`SELECT id, customer_id, total::bigint FROM orders ORDER BY id DESC LIMIT 200`)
    	if err != nil {
    		return nil, 0, err
    	}
    	var orders []Order
    	idSet := map[int64]struct{}{}
    	for rows.Next() {
    		var o Order
    		if err := rows.Scan(&o.ID, &o.CustomerID, &o.Total); err != nil {
    			return nil, 0, err
    		}
    		orders = append(orders, o)
    		idSet[o.CustomerID] = struct{}{}
    	}
    	rows.Close()

    	ids := make([]int64, 0, len(idSet))
    	for id := range idSet {
    		ids = append(ids, id)
    	}
    	crows, err := db.Query(ctx, `SELECT id, full_name FROM customers WHERE id = ANY($1)`, ids)
    	if err != nil {
    		return nil, 0, err
    	}
    	defer crows.Close()
    	names := make(map[int64]string, len(ids))
    	for crows.Next() {
    		var id int64
    		var name string
    		if err := crows.Scan(&id, &name); err != nil {
    			return nil, 0, err
    		}
    		names[id] = name
    	}
    	for i := range orders {
    		orders[i].CustomerName = names[orders[i].CustomerID]
    	}
    	return orders, 2, crows.Err()
    }

    func main() {
    	ctx := context.Background()
    	cfg, err := pgxpool.ParseConfig("postgres://postgres:pass@localhost:5432/shop")
    	if err != nil {
    		log.Fatal(err)
    	}
    	cfg.MaxConns = 10
    	db, err := pgxpool.NewWithConfig(ctx, cfg)
    	if err != nil {
    		log.Fatal(err)
    	}
    	defer db.Close()

    	type fn func(context.Context, *pgxpool.Pool) ([]Order, int, error)
    	for _, c := range []struct {
    		name string
    		f    fn
    	}{{"N+1", listOrdersNPlus1}, {"JOIN", listOrdersJoin}, {"Batch ANY($1)", listOrdersBatch}} {
    		c.f(ctx, db) // warm-up (nạp cache, mở kết nối)
    		start := time.Now()
    		orders, q, err := c.f(ctx, db)
    		if err != nil {
    			log.Fatal(err)
    		}
    		fmt.Printf("%-14s %3d đơn, %3d query, %v\n", c.name, len(orders), q, time.Since(start).Round(100*time.Microsecond))
    	}
    }

    // Output (Postgres chạy trên cùng máy - localhost):
    // N+1            200 đơn, 201 query, 27.5ms
    // JOIN           200 đơn,   1 query, 2.5ms
    // Batch ANY($1)  200 đơn,   2 query, 1ms
    ```

=== "Python"

    ```python
    # pip install "psycopg[binary]==3.3.6" "psycopg-pool==3.3.3"
    import time
    from dataclasses import dataclass

    from psycopg_pool import ConnectionPool

    DSN = "postgresql://postgres:pass@localhost:5432/shop"


    @dataclass
    class Order:
        id: int
        customer_id: int
        total: int
        customer_name: str = ""


    def list_orders_n_plus_1(conn) -> tuple[list[Order], int]:
        """❌ N+1: 1 query lấy đơn + N query lấy tên khách."""
        rows = conn.execute(
            "SELECT id, customer_id, total::bigint FROM orders ORDER BY id DESC LIMIT 200"
        ).fetchall()
        orders = [Order(*r) for r in rows]
        for o in orders:  # mỗi đơn 1 round-trip tới DB
            o.customer_name = conn.execute(
                "SELECT full_name FROM customers WHERE id = %s", (o.customer_id,)
            ).fetchone()[0]
        return orders, 1 + len(orders)


    def list_orders_join(conn) -> tuple[list[Order], int]:
        """✅ JOIN: 1 query."""
        rows = conn.execute("""
            SELECT o.id, o.customer_id, o.total::bigint, c.full_name
            FROM orders o JOIN customers c ON c.id = o.customer_id
            ORDER BY o.id DESC LIMIT 200""").fetchall()
        return [Order(*r) for r in rows], 1


    def list_orders_batch(conn) -> tuple[list[Order], int]:
        """✅ Batch: 2 query, WHERE id = ANY(%s) (giống selectinload của SQLAlchemy)."""
        rows = conn.execute(
            "SELECT id, customer_id, total::bigint FROM orders ORDER BY id DESC LIMIT 200"
        ).fetchall()
        orders = [Order(*r) for r in rows]
        ids = list({o.customer_id for o in orders})
        names = dict(conn.execute(
            "SELECT id, full_name FROM customers WHERE id = ANY(%s)", (ids,)
        ).fetchall())
        for o in orders:
            o.customer_name = names[o.customer_id]
        return orders, 2


    if __name__ == "__main__":
        with ConnectionPool(DSN, min_size=1, max_size=10) as pool, pool.connection() as conn:
            for name, fn in [("N+1", list_orders_n_plus_1),
                             ("JOIN", list_orders_join),
                             ("Batch ANY(%s)", list_orders_batch)]:
                fn(conn)  # warm-up
                start = time.perf_counter()
                orders, q = fn(conn)
                ms = (time.perf_counter() - start) * 1000
                print(f"{name:<14} {len(orders)} đơn, {q:>3} query, {ms:.1f}ms")

    # Output:
    # N+1            200 đơn, 201 query, 39.4ms
    # JOIN           200 đơn,   1 query, 4.5ms
    # Batch ANY(%s)  200 đơn,   2 query, 2.4ms
    ```

Ngay trên **localhost** (mạng gần như bằng 0), N+1 đã chậm hơn **10-25 lần**. Trong production, DB ở máy khác → chênh lệch còn lớn hơn nhiều.

### 5.3 Phát hiện N+1

- **Log số query mỗi request** (middleware đếm query) - request nào > 20 query là đáng ngờ.
- Bật log SQL của ORM ở môi trường dev: thấy cùng một câu lặp lại hàng trăm lần với tham số khác nhau.
- APM (Datadog, New Relic, Sentry Performance) có sẵn cảnh báo "N+1 query detected".
- Với ORM: GORM `db.Preload("Customer")`, SQLAlchemy `options(selectinload(Order.customer))`, Django `select_related` / `prefetch_related`.

## 📖 6. Transaction & ACID

**Transaction** là một nhóm thao tác được đối xử như **một đơn vị duy nhất**: hoặc **tất cả** thành công, hoặc **không có gì** xảy ra. (Cách dùng transaction trong code Go đã học ở [Go Bài 13](../golang/13-database-sql.md), Python ở [Python Bài 13](../python/13-database-sql.md).)

Ví dụ kinh điển: chuyển 100k từ An sang Bình = 2 lệnh `UPDATE`. Nếu server chết giữa 2 lệnh → tiền **biến mất**. Transaction ngăn điều đó.

| Chữ cái | Tên | Ý nghĩa | Postgres đảm bảo bằng |
|---|---|---|---|
| **A** | Atomicity (nguyên tử) | Tất cả hoặc không gì cả | Transaction ID + MVCC: thay đổi của transaction bị `ROLLBACK` đơn giản là "vô hình" |
| **C** | Consistency (nhất quán) | Dữ liệu luôn thỏa ràng buộc (`CHECK`, `FK`, `UNIQUE`) | Kiểm tra ràng buộc; phần còn lại là **trách nhiệm của app** |
| **I** | Isolation (cô lập) | Các transaction chạy đồng thời không "giẫm chân" nhau | MVCC + lock + isolation level (mục 7) |
| **D** | Durability (bền vững) | Đã `COMMIT` là không mất, kể cả mất điện | WAL + fsync (mục 1.4) |

```mermaid
stateDiagram-v2
    [*] --> Active: BEGIN
    Active --> Active: SELECT / INSERT / UPDATE
    Active --> Committed: COMMIT (WAL đã fsync)
    Active --> Aborted: ROLLBACK / lỗi / mất kết nối
    Committed --> [*]: Thay đổi hiển thị cho mọi người
    Aborted --> [*]: Như chưa từng xảy ra
```

!!! warning "Trong Postgres, 1 lỗi = cả transaction hỏng"
    Sau khi một lệnh trong transaction bị lỗi, mọi lệnh tiếp theo đều bị từ chối với `current transaction is aborted, commands ignored until end of transaction block` cho tới khi bạn `ROLLBACK`. Dùng `SAVEPOINT` nếu muốn "thử một bước, lỗi thì quay lại điểm đó".

## 📖 7. Isolation level & các anomaly

Nếu mọi transaction chạy **tuần tự** (xong cái này mới tới cái kia) thì không bao giờ có lỗi đồng thời - nhưng chậm kinh khủng. Database cho phép chạy **song song** và cho bạn chọn **mức cô lập** (isolation level): cô lập càng cao càng an toàn nhưng càng dễ phải chờ/thử lại.

Các demo dưới đây chạy **thật** với 2 kết nối A và B tới Postgres 17 (script Python điều phối 2 kết nối xen kẽ; bạn có thể mở 2 cửa sổ `psql` và gõ tay theo đúng thứ tự). Bảng dùng:

```sql
CREATE TABLE accounts (id int PRIMARY KEY, owner text, balance int);
INSERT INTO accounts VALUES (1,'An',100),(2,'Binh',100);
CREATE TABLE products (id int PRIMARY KEY, name text, stock int, version int NOT NULL DEFAULT 1);
INSERT INTO products VALUES (1,'iPhone 16',10,1);
CREATE TABLE doctors (name text PRIMARY KEY, on_call bool);
INSERT INTO doctors VALUES ('Alice',true),('Bob',true);
```

??? question "Script điều phối 2 session (Python) - bấm để xem"

    ```python
    # iso.py - chạy: python iso.py lost-rc
    import sys, threading, time
    import psycopg

    DSN = "postgresql://postgres:pass@localhost:5432/shop"
    lock = threading.Lock()

    class S:
        def __init__(self, name):
            self.name = name
            self.c = psycopg.connect(DSN, autocommit=True)  # tự quản lý BEGIN/COMMIT
        def run(self, sql):
            with lock:
                print(f"{self.name}> {sql}")
            try:
                cur = self.c.execute(sql)
                if cur.description:
                    rows = cur.fetchall()
                    with lock:
                        print(f"   {self.name} <- {rows}")
            except Exception as e:
                with lock:
                    print(f"   {self.name} !! {type(e).__name__}: {str(e).splitlines()[0]}")
                self.c.execute("ROLLBACK")
        def run_bg(self, sql):   # chạy lệnh có thể bị CHẶN trong thread riêng
            t = threading.Thread(target=self.run, args=(sql,)); t.start(); time.sleep(0.5)
            with lock: print(f"   ({self.name} đang chờ khóa...)")
            return t

    A, B = S("A"), S("B")
    # ... mỗi kịch bản là một chuỗi A.run(...) / B.run(...) như trong output bên dưới
    ```

### 7.1 Dirty read - đọc dữ liệu chưa commit

**Dirty read**: B đọc được thay đổi **chưa commit** của A. Nếu A rollback, B đã dùng một giá trị **không bao giờ tồn tại**.

```mermaid
sequenceDiagram
    participant A as Transaction A
    participant DB as Database
    participant B as Transaction B
    A->>DB: BEGIN; UPDATE balance = 0 (id=1)
    B->>DB: SELECT balance (id=1)
    DB-->>B: 0 ❌ (nếu cho phép dirty read)
    A->>DB: ROLLBACK
    Note over B: B đã quyết định dựa trên số 0<br/>- con số chưa bao giờ tồn tại!
```

Postgres **không bao giờ** cho dirty read - kể cả khi bạn xin `READ UNCOMMITTED`:

```text
A> BEGIN
A> UPDATE accounts SET balance = 0 WHERE id = 1
B> BEGIN ISOLATION LEVEL READ UNCOMMITTED
B> SELECT balance FROM accounts WHERE id = 1
   B <- [(100,)]
A> ROLLBACK
B> COMMIT
```

B vẫn thấy `100`. (MySQL/SQL Server ở `READ UNCOMMITTED` thì **có** dirty read.)

### 7.2 Non-repeatable read - đọc 2 lần ra 2 kết quả

Trong **cùng một transaction**, đọc cùng một dòng 2 lần ra 2 giá trị khác nhau vì có transaction khác sửa và commit ở giữa.

```mermaid
sequenceDiagram
    participant A as Transaction A
    participant DB as Database
    participant B as Transaction B
    A->>DB: BEGIN
    A->>DB: SELECT balance (id=1)
    DB-->>A: 100
    B->>DB: UPDATE balance = 50 (id=1); COMMIT
    A->>DB: SELECT balance (id=1)
    DB-->>A: 50 ⚠️ khác lần trước
```

Chạy thật ở **READ COMMITTED** (mặc định của Postgres):

```text
A> BEGIN ISOLATION LEVEL READ COMMITTED
A> SELECT balance FROM accounts WHERE id = 1
   A <- [(100,)]
B> UPDATE accounts SET balance = 50 WHERE id = 1
A> SELECT balance FROM accounts WHERE id = 1
   A <- [(50,)]
A> COMMIT
```

Ở **REPEATABLE READ**, A nhìn một **snapshot** cố định từ đầu transaction:

```text
A> BEGIN ISOLATION LEVEL REPEATABLE READ
A> SELECT balance FROM accounts WHERE id = 1
   A <- [(100,)]
B> UPDATE accounts SET balance = 50 WHERE id = 1
A> SELECT balance FROM accounts WHERE id = 1
   A <- [(100,)]
A> COMMIT
```

Khi nào đáng lo? Ví dụ báo cáo cuối ngày: câu 1 tính tổng doanh thu, câu 2 tính theo từng chi nhánh - nếu giữa 2 câu có đơn mới, **tổng các chi nhánh ≠ tổng** → kế toán la làng. Dùng `REPEATABLE READ` cho báo cáo nhiều câu.

### 7.3 Phantom read - "bóng ma" xuất hiện

Giống non-repeatable read nhưng với **tập dòng**: truy vấn theo điều kiện 2 lần, lần sau có thêm/bớt dòng.

```mermaid
sequenceDiagram
    participant A as Transaction A
    participant DB as Database
    participant B as Transaction B
    A->>DB: SELECT count(*) WHERE balance >= 100
    DB-->>A: 2
    B->>DB: INSERT (3, 'Chi', 500); COMMIT
    A->>DB: SELECT count(*) WHERE balance >= 100
    DB-->>A: 3 👻 dòng "ma" xuất hiện
```

```text
===== Phantom read (READ COMMITTED) =====
A> BEGIN ISOLATION LEVEL READ COMMITTED
A> SELECT count(*) FROM accounts WHERE balance >= 100
   A <- [(2,)]
B> INSERT INTO accounts VALUES (3, 'Chi', 500)
A> SELECT count(*) FROM accounts WHERE balance >= 100
   A <- [(3,)]
A> COMMIT

===== Phantom read (REPEATABLE READ) =====
A> BEGIN ISOLATION LEVEL REPEATABLE READ
A> SELECT count(*) FROM accounts WHERE balance >= 100
   A <- [(2,)]
B> INSERT INTO accounts VALUES (3, 'Chi', 500)
A> SELECT count(*) FROM accounts WHERE balance >= 100
   A <- [(2,)]
A> COMMIT
```

Chuẩn SQL cho phép phantom ở `REPEATABLE READ`, nhưng **Postgres** dùng snapshot nên **không có** phantom ở mức này (MySQL InnoDB chặn phantom bằng *gap lock*).

### 7.4 Lost update - "mất" một lần cập nhật

Anomaly **phổ biến nhất ngoài đời thực**. Hai người cùng **đọc** giá trị, **tính toán trong app**, rồi **ghi đè**. Người ghi sau xóa mất thay đổi của người ghi trước.

Kịch bản: flash sale iPhone, còn 10 máy, 2 khách mua cùng lúc:

```mermaid
sequenceDiagram
    participant A as Khách A (app)
    participant DB as Database
    participant B as Khách B (app)
    A->>DB: SELECT stock → 10
    B->>DB: SELECT stock → 10
    Note over A: app tính 10 - 1 = 9
    Note over B: app tính 10 - 1 = 9
    A->>DB: UPDATE stock = 9; COMMIT
    B->>DB: UPDATE stock = 9; COMMIT
    Note over DB: stock = 9 nhưng đã bán 2 máy!<br/>Lần cập nhật của A bị "mất"
```

```text
===== Lost update (READ COMMITTED) - đọc lên app rồi ghi lại =====
A> BEGIN ISOLATION LEVEL READ COMMITTED
B> BEGIN ISOLATION LEVEL READ COMMITTED
A> SELECT stock FROM products WHERE id = 1
   A <- [(10,)]
B> SELECT stock FROM products WHERE id = 1
   B <- [(10,)]
A> UPDATE products SET stock = 9 WHERE id = 1  -- app tính 10-1
B> UPDATE products SET stock = 9 WHERE id = 1  -- app tính 10-1
   (B đang chờ khóa...)
A> COMMIT
B> COMMIT
A> SELECT stock FROM products WHERE id = 1  -- bán 2 máy nhưng chỉ trừ 1!
   A <- [(9,)]
```

Để ý: B **bị chặn** ở lệnh UPDATE (A đang giữ khóa dòng), nhưng khi A commit, B **vẫn ghi đè** giá trị 9 mà app B đã tính từ số 10 cũ. Khóa dòng **không** cứu được lost update vì lỗi nằm ở chỗ **app tính từ dữ liệu cũ**.

Ở **REPEATABLE READ**, Postgres phát hiện dòng đã bị sửa sau snapshot của B và **báo lỗi**:

```text
===== Lost update (REPEATABLE READ) =====
A> BEGIN ISOLATION LEVEL REPEATABLE READ
B> BEGIN ISOLATION LEVEL REPEATABLE READ
A> SELECT stock FROM products WHERE id = 1
   A <- [(10,)]
B> SELECT stock FROM products WHERE id = 1
   B <- [(10,)]
A> UPDATE products SET stock = 9 WHERE id = 1  -- app tính 10-1
B> UPDATE products SET stock = 9 WHERE id = 1  -- app tính 10-1
   (B đang chờ khóa...)
A> COMMIT
   B !! SerializationFailure: could not serialize access due to concurrent update
```

B phải **thử lại toàn bộ transaction** (đọc lại stock = 9, tính 8, ghi). Mục 8 trình bày 3 cách chống lost update mà không cần đổi isolation level.

### 7.5 Write skew - mỗi người đúng, cộng lại sai

Tinh vi nhất. Hai transaction đọc **cùng một tập dữ liệu**, rồi mỗi bên sửa **dòng khác nhau** dựa trên điều kiện đã đọc. Không ai ghi đè ai, nhưng **kết quả chung vi phạm quy tắc nghiệp vụ**.

Kịch bản kinh điển: bệnh viện yêu cầu **luôn có ít nhất 1 bác sĩ trực**. Alice và Bob đều đang trực, cùng lúc bấm "xin nghỉ":

```mermaid
sequenceDiagram
    participant A as Alice
    participant DB as Database
    participant B as Bob
    A->>DB: SELECT count(*) WHERE on_call → 2
    B->>DB: SELECT count(*) WHERE on_call → 2
    Note over A: 2 người trực, mình nghỉ được
    Note over B: 2 người trực, mình nghỉ được
    A->>DB: UPDATE Alice on_call=false; COMMIT
    B->>DB: UPDATE Bob on_call=false; COMMIT
    Note over DB: 0 bác sĩ trực! 🚨
```

**REPEATABLE READ không chặn được** (hai bên sửa hai dòng khác nhau, không xung đột ghi):

```text
===== Write skew (REPEATABLE READ) - phải còn >= 1 bác sĩ trực =====
A> BEGIN ISOLATION LEVEL REPEATABLE READ
B> BEGIN ISOLATION LEVEL REPEATABLE READ
A> SELECT count(*) FROM doctors WHERE on_call
   A <- [(2,)]
B> SELECT count(*) FROM doctors WHERE on_call
   B <- [(2,)]
A> UPDATE doctors SET on_call = false WHERE name = 'Alice'
B> UPDATE doctors SET on_call = false WHERE name = 'Bob'
A> COMMIT
B> COMMIT
A> SELECT * FROM doctors
   A <- [('Alice', False), ('Bob', False)]
```

**SERIALIZABLE** phát hiện "phụ thuộc đọc-ghi" nguy hiểm (thuật toán SSI - Serializable Snapshot Isolation) và hủy một bên:

```text
===== Write skew (SERIALIZABLE) - phải còn >= 1 bác sĩ trực =====
A> BEGIN ISOLATION LEVEL SERIALIZABLE
B> BEGIN ISOLATION LEVEL SERIALIZABLE
A> SELECT count(*) FROM doctors WHERE on_call
   A <- [(2,)]
B> SELECT count(*) FROM doctors WHERE on_call
   B <- [(2,)]
A> UPDATE doctors SET on_call = false WHERE name = 'Alice'
B> UPDATE doctors SET on_call = false WHERE name = 'Bob'
A> COMMIT
B> COMMIT
   B !! SerializationFailure: could not serialize access due to read/write dependencies among transactions
A> SELECT * FROM doctors
   A <- [('Bob', True), ('Alice', False)]
```

Ví dụ write skew ngoài đời: **đặt phòng khách sạn/lịch họp trùng giờ** (hai người cùng kiểm tra "phòng trống 14h-15h" rồi cùng chèn booking), **username trùng** khi không có `UNIQUE`, **vượt hạn mức chi tiêu** khi kiểm tra tổng chi rồi chèn giao dịch mới.

Cách chữa (ngoài SERIALIZABLE): ràng buộc DB (`UNIQUE`, `EXCLUDE USING gist` cho khoảng thời gian), hoặc `SELECT ... FOR UPDATE` khóa **các dòng đã đọc** để "biến" xung đột đọc thành xung đột ghi.

### 7.6 Bảng tổng kết isolation level

| Isolation level | Dirty read | Non-repeatable read | Phantom | Lost update | Write skew |
|---|---|---|---|---|---|
| READ UNCOMMITTED (chuẩn SQL) | có thể | có thể | có thể | có thể | có thể |
| **READ COMMITTED** (mặc định Postgres, Oracle, SQL Server) | ❌ | ⚠️ có thể | ⚠️ có thể | ⚠️ có thể | ⚠️ có thể |
| **REPEATABLE READ** (mặc định MySQL) | ❌ | ❌ | ❌ trong Postgres (chuẩn SQL: có thể) | ❌ Postgres báo lỗi 40001 (MySQL: **có thể**!) | ⚠️ có thể |
| **SERIALIZABLE** | ❌ | ❌ | ❌ | ❌ | ❌ |

!!! tip "Chọn isolation level nào?"
    - **Mặc định READ COMMITTED** + xử lý đúng các chỗ nhạy cảm bằng **UPDATE nguyên tử**, **FOR UPDATE**, **optimistic locking**, **ràng buộc DB**. Đây là cách 90% hệ thống làm.
    - **REPEATABLE READ** cho báo cáo/đối soát nhiều câu cần snapshot nhất quán.
    - **SERIALIZABLE** cho nghiệp vụ phức tạp, khó lường hết (tài chính, đặt chỗ) - **bắt buộc** code phải **retry** khi gặp lỗi `40001 serialization_failure`.
    - Ở REPEATABLE READ/SERIALIZABLE, app **luôn** phải sẵn sàng retry cả transaction.

## 📖 8. Locking - khóa trong database

### 8.1 Các loại khóa

```mermaid
flowchart TB
    L["Khóa trong PostgreSQL"] --> T["Table-level lock"]
    L --> R["Row-level lock"]
    L --> AD["Advisory lock<br/>(khóa do app tự đặt tên)"]
    T --> T1["ACCESS SHARE: SELECT"]
    T --> T2["ROW EXCLUSIVE: INSERT/UPDATE/DELETE"]
    T --> T3["SHARE: CREATE INDEX (thường)"]
    T --> T4["ACCESS EXCLUSIVE: ALTER TABLE, DROP,<br/>chặn MỌI thứ kể cả SELECT"]
    R --> R1["FOR UPDATE: tôi sắp sửa dòng này"]
    R --> R2["FOR NO KEY UPDATE: UPDATE thường tự lấy"]
    R --> R3["FOR SHARE: đừng ai sửa dòng này"]
```

Điều cốt lõi: trong Postgres **đọc không chặn ghi, ghi không chặn đọc** (nhờ MVCC - mục 9). Chỉ **ghi chặn ghi** trên cùng dòng, và các lệnh DDL (`ALTER TABLE`) lấy khóa `ACCESS EXCLUSIVE` chặn tất cả.

### 8.2 Ba cách chống lost update

**Cách 1 - UPDATE nguyên tử** (đơn giản nhất, nên ưu tiên): để DB tự tính, đừng tính trong app.

```sql
UPDATE products SET stock = stock - 1 WHERE id = 1 AND stock >= 1 RETURNING stock;
```

```text
A> BEGIN
B> BEGIN
A> UPDATE products SET stock = stock - 1 WHERE id = 1 AND stock >= 1 RETURNING stock
   A <- [(9,)]
B> UPDATE products SET stock = stock - 1 WHERE id = 1 AND stock >= 1 RETURNING stock
   (B đang chờ khóa...)
A> COMMIT
   B <- [(8,)]
B> COMMIT
```

B chờ A, rồi **đọc lại** giá trị mới nhất (9) trước khi trừ → 8. Đúng! Điều kiện `stock >= 1` chống bán âm kho; nếu `RETURNING` trả 0 dòng → hết hàng.

**Cách 2 - Pessimistic locking `SELECT ... FOR UPDATE`**: khi logic phức tạp, cần đọc → kiểm tra nhiều điều kiện → ghi.

```text
A> BEGIN
B> BEGIN
A> SELECT stock FROM products WHERE id = 1 FOR UPDATE
   A <- [(10,)]
B> SELECT stock FROM products WHERE id = 1 FOR UPDATE
   (B đang chờ khóa...)
A> UPDATE products SET stock = 9 WHERE id = 1
A> COMMIT
   B <- [(9,)]
B> UPDATE products SET stock = 8 WHERE id = 1
B> COMMIT
A> SELECT stock FROM products WHERE id = 1
   A <- [(8,)]
```

> 💡 **Ví von**: Pessimistic lock = **cầm chìa khóa phòng thử đồ**. Người khác muốn vào phải xếp hàng chờ. An toàn, nhưng nếu bạn thử đồ lâu (transaction dài) thì hàng dài dằng dặc.

Biến thể hữu ích:

- `FOR UPDATE NOWAIT`: không chờ, báo lỗi ngay nếu dòng đang bị khóa.
- `FOR UPDATE SKIP LOCKED`: **bỏ qua** các dòng đang bị khóa - nền tảng để làm **job queue bằng Postgres** (nhiều worker cùng lấy việc mà không đụng nhau - xem [Bài 9](./09-message-queues.md)).

**Cách 3 - Optimistic locking với cột `version`**: không khóa gì cả, chỉ **kiểm tra lúc ghi** xem dữ liệu có bị ai sửa chưa.

```sql
-- đọc
SELECT stock, version FROM products WHERE id = 1;            -- 10, version 1
-- ghi: chỉ thành công nếu version vẫn là 1
UPDATE products SET stock = 9, version = version + 1
WHERE id = 1 AND version = 1;                                -- 0 dòng = có người nhanh tay hơn → đọc lại, thử lại
```

```text
A> SELECT stock, version FROM products WHERE id = 1
   A <- [(10, 1)]
B> SELECT stock, version FROM products WHERE id = 1
   B <- [(10, 1)]
A> UPDATE products SET stock = 9, version = version + 1 WHERE id = 1 AND version = 1 RETURNING stock, version
   A <- [(9, 2)]
B> UPDATE products SET stock = 9, version = version + 1 WHERE id = 1 AND version = 1 RETURNING stock, version
   B <- []
B> SELECT stock, version FROM products WHERE id = 1  -- B đọc lại, thử lại
   B <- [(9, 2)]
B> UPDATE products SET stock = 8, version = version + 1 WHERE id = 1 AND version = 2 RETURNING stock, version
   B <- [(8, 3)]
```

> 💡 **Ví von**: Optimistic lock = **Google Docs cũ**: ai cũng sửa được, lúc lưu mới báo "tài liệu đã bị người khác thay đổi, vui lòng tải lại". Không ai phải chờ ai, nhưng có thể phải làm lại.

Optimistic locking đặc biệt hợp với **thao tác dài có người dùng tham gia**: form chỉnh sửa sản phẩm mở 10 phút rồi mới bấm Lưu - bạn **không thể** giữ khóa DB suốt 10 phút. Trong REST API, `version` thường được trả dưới dạng header `ETag` và client gửi lại qua `If-Match` (xem [Bài 3](./03-api-design.md)).

Demo 30 khách tranh 10 chiếc iPhone với optimistic locking + retry:

=== "Go"

    ```go
    package main

    import (
    	"context"
    	"errors"
    	"fmt"
    	"log"
    	"sync"
    	"sync/atomic"

    	"github.com/jackc/pgx/v5/pgxpool"
    )

    var ErrConflict = errors.New("dữ liệu đã bị người khác sửa")
    var ErrOutOfStock = errors.New("hết hàng")

    // buyOnce: đọc stock + version, rồi UPDATE có điều kiện version.
    func buyOnce(ctx context.Context, db *pgxpool.Pool, productID int) error {
    	var stock, version int
    	err := db.QueryRow(ctx, `SELECT stock, version FROM products WHERE id = $1`, productID).
    		Scan(&stock, &version)
    	if err != nil {
    		return err
    	}
    	if stock < 1 {
    		return ErrOutOfStock
    	}
    	tag, err := db.Exec(ctx, `
    		UPDATE products SET stock = $1, version = version + 1
    		WHERE id = $2 AND version = $3`, stock-1, productID, version)
    	if err != nil {
    		return err
    	}
    	if tag.RowsAffected() == 0 { // version đã đổi → có người nhanh tay hơn
    		return ErrConflict
    	}
    	return nil
    }

    // buy: thử lại tối đa 10 lần khi xung đột
    func buy(ctx context.Context, db *pgxpool.Pool, productID int, retries *atomic.Int64) error {
    	for attempt := 1; attempt <= 10; attempt++ {
    		err := buyOnce(ctx, db, productID)
    		if !errors.Is(err, ErrConflict) {
    			return err // nil, hết hàng, hoặc lỗi khác
    		}
    		retries.Add(1)
    	}
    	return ErrConflict
    }

    func main() {
    	ctx := context.Background()
    	db, err := pgxpool.New(ctx, "postgres://postgres:pass@localhost:5432/shop")
    	if err != nil {
    		log.Fatal(err)
    	}
    	defer db.Close()
    	db.Exec(ctx, `UPDATE products SET stock = 10, version = 1 WHERE id = 1`)

    	var ok, soldOut, failed, retries atomic.Int64
    	var wg sync.WaitGroup
    	for i := 0; i < 30; i++ { // 30 khách tranh nhau 10 chiếc iPhone
    		wg.Add(1)
    		go func() {
    			defer wg.Done()
    			switch err := buy(ctx, db, 1, &retries); {
    			case err == nil:
    				ok.Add(1)
    			case errors.Is(err, ErrOutOfStock):
    				soldOut.Add(1)
    			default:
    				failed.Add(1)
    			}
    		}()
    	}
    	wg.Wait()
    	var stock, version int
    	db.QueryRow(ctx, `SELECT stock, version FROM products WHERE id = 1`).Scan(&stock, &version)
    	fmt.Printf("Mua thành công: %d, hết hàng: %d, thất bại: %d, số lần retry: %d\n",
    		ok.Load(), soldOut.Load(), failed.Load(), retries.Load())
    	fmt.Printf("Tồn kho cuối: %d, version: %d\n", stock, version)
    }

    // Output (số lần retry thay đổi mỗi lần chạy):
    // Mua thành công: 10, hết hàng: 20, thất bại: 0, số lần retry: 189
    // Tồn kho cuối: 0, version: 11
    ```

=== "Python"

    ```python
    import threading
    from concurrent.futures import ThreadPoolExecutor

    from psycopg_pool import ConnectionPool

    DSN = "postgresql://postgres:pass@localhost:5432/shop"


    class Conflict(Exception): ...
    class OutOfStock(Exception): ...


    def buy_once(pool: ConnectionPool, product_id: int) -> None:
        with pool.connection() as conn:  # mỗi khối with là 1 transaction, tự COMMIT khi thoát
            stock, version = conn.execute(
                "SELECT stock, version FROM products WHERE id = %s", (product_id,)
            ).fetchone()
            if stock < 1:
                raise OutOfStock
            cur = conn.execute(
                """UPDATE products SET stock = %s, version = version + 1
                   WHERE id = %s AND version = %s""",
                (stock - 1, product_id, version),
            )
            if cur.rowcount == 0:  # version đã đổi → có người nhanh tay hơn
                raise Conflict


    retries = 0
    lock = threading.Lock()


    def buy(pool: ConnectionPool, product_id: int) -> str:
        global retries
        for _ in range(10):
            try:
                buy_once(pool, product_id)
                return "ok"
            except OutOfStock:
                return "sold_out"
            except Conflict:
                with lock:
                    retries += 1
        return "failed"


    if __name__ == "__main__":
        with ConnectionPool(DSN, min_size=5, max_size=30) as pool:
            with pool.connection() as conn:
                conn.execute("UPDATE products SET stock = 10, version = 1 WHERE id = 1")
            with ThreadPoolExecutor(max_workers=30) as ex:  # 30 khách tranh 10 máy
                results = list(ex.map(lambda _: buy(pool, 1), range(30)))
            with pool.connection() as conn:
                stock, version = conn.execute(
                    "SELECT stock, version FROM products WHERE id = 1").fetchone()
        print(f"Mua thành công: {results.count('ok')}, hết hàng: {results.count('sold_out')}, "
              f"thất bại: {results.count('failed')}, số lần retry: {retries}")
        print(f"Tồn kho cuối: {stock}, version: {version}")

    # Output (số lần retry thay đổi mỗi lần chạy):
    # Mua thành công: 10, hết hàng: 20, thất bại: 0, số lần retry: 55
    # Tồn kho cuối: 0, version: 11
    ```

Kết quả **chính xác**: đúng 10 người mua được, kho về 0, không bán âm. Nhưng để ý **189 lần retry** - khi tranh chấp **cao** (hot item flash sale), optimistic locking lãng phí; UPDATE nguyên tử hoặc pessimistic lock tốt hơn.

| | Optimistic | Pessimistic (`FOR UPDATE`) | UPDATE nguyên tử |
|---|---|---|---|
| Ý tưởng | Không khóa, kiểm tra version lúc ghi | Khóa dòng trước khi đọc | DB tự tính trong 1 lệnh |
| Tranh chấp thấp | ✅ Rất tốt | OK | ✅ Rất tốt |
| Tranh chấp cao | ❌ Retry liên tục | ✅ Xếp hàng có trật tự | ✅ Tốt nhất |
| Thao tác dài có người dùng | ✅ Phù hợp (ETag/If-Match) | ❌ Không thể giữ khóa lâu | - |
| Logic phức tạp | ✅ | ✅ | ❌ Chỉ phép tính đơn giản |

### 8.3 Deadlock

**Deadlock**: A giữ khóa X và chờ Y; B giữ khóa Y và chờ X → chờ nhau mãi mãi.

```mermaid
flowchart LR
    A["Transaction A<br/>đã khóa: tài khoản 1"] -->|"chờ khóa"| R2["Tài khoản 2"]
    B["Transaction B<br/>đã khóa: tài khoản 2"] -->|"chờ khóa"| R1["Tài khoản 1"]
    R2 -.->|"đang bị giữ bởi"| B
    R1 -.->|"đang bị giữ bởi"| A
```

Kịch bản: An chuyển cho Bình, **cùng lúc** Bình chuyển cho An:

```text
A> BEGIN
B> BEGIN
A> UPDATE accounts SET balance = balance - 10 WHERE id = 1
B> UPDATE accounts SET balance = balance - 10 WHERE id = 2
A> UPDATE accounts SET balance = balance + 10 WHERE id = 2
   (A đang chờ khóa...)
B> UPDATE accounts SET balance = balance + 10 WHERE id = 1
   A !! DeadlockDetected: deadlock detected
A> COMMIT
B> COMMIT
A> SELECT id, balance FROM accounts ORDER BY id
   A <- [(1, 110), (2, 90)]
```

Postgres có bộ **phát hiện deadlock** (chạy sau `deadlock_timeout` = 1 giây): nó chọn một nạn nhân (A) để hủy, B được đi tiếp. Log server ghi rõ:

```text
ERROR:  deadlock detected
DETAIL:  Process 209 waits for ShareLock on transaction 813; blocked by process 210.
	Process 210 waits for ShareLock on transaction 812; blocked by process 209.
	Process 209: UPDATE accounts SET balance = balance + 10 WHERE id = 2
	Process 210: UPDATE accounts SET balance = balance + 10 WHERE id = 1
```

Kết quả `(110, 90)`: chỉ giao dịch của B thành công; giao dịch của A bị rollback toàn bộ (không mất tiền nhờ Atomicity).

!!! tip "Cách phòng deadlock"
    1. **Luôn khóa theo cùng một thứ tự**: ví dụ khi chuyển tiền, luôn cập nhật tài khoản có `id` **nhỏ hơn trước**. A và B sẽ cùng tranh khóa tài khoản 1 trước → một người chờ, không vòng tròn.
    2. **Transaction ngắn**: càng ngắn càng ít cơ hội đan xen.
    3. Khóa **ít dòng** nhất có thể, có index cho điều kiện `WHERE` (không index → quét và khóa nhiều hơn).
    4. **Retry** khi gặp lỗi `40P01 deadlock_detected` - deadlock không thể loại bỏ 100%, chỉ giảm thiểu.

### 8.4 Advisory lock

Khóa "do app tự đặt tên" - không gắn với dòng nào. Dùng khi cần "chỉ một tiến trình được chạy việc X": ví dụ cron job chạy trên 3 server nhưng chỉ 1 server được gửi báo cáo.

```sql
SELECT pg_try_advisory_lock(hashtext('daily-report'));  -- true: được chạy; false: người khác đang chạy
-- ... làm việc ...
SELECT pg_advisory_unlock(hashtext('daily-report'));
```

(Khóa phân tán bằng Redis: [Bài 8](./08-caching.md).)

## 📖 9. MVCC - vì sao đọc không chặn ghi

**MVCC (Multi-Version Concurrency Control)**: thay vì sửa dòng **tại chỗ**, mỗi `UPDATE` tạo ra **một phiên bản mới** của dòng. Mỗi transaction nhìn thấy phiên bản phù hợp với **snapshot** của nó.

Mỗi phiên bản dòng (tuple) có 2 trường ẩn:

- **`xmin`**: ID của transaction đã **tạo ra** phiên bản này
- **`xmax`**: ID của transaction đã **xóa/thay thế** phiên bản này (0 = còn sống)

Xem tận mắt bằng extension `pageinspect`:

```sql
CREATE EXTENSION IF NOT EXISTS pageinspect;
CREATE TABLE mvcc_demo (id int PRIMARY KEY, stock int) WITH (autovacuum_enabled = off);
INSERT INTO mvcc_demo VALUES (1, 10);
SELECT xmin, xmax, ctid, * FROM mvcc_demo;
UPDATE mvcc_demo SET stock = 9 WHERE id = 1;
UPDATE mvcc_demo SET stock = 8 WHERE id = 1;
SELECT xmin, xmax, ctid, * FROM mvcc_demo;
SELECT lp, t_xmin, t_xmax, t_ctid FROM heap_page_items(get_raw_page('mvcc_demo', 0));
```

```text
 xmin | xmax | ctid  | id | stock
------+------+-------+----+-------
  823 |    0 | (0,1) |  1 |    10

 xmin | xmax | ctid  | id | stock
------+------+-------+----+-------
  825 |    0 | (0,3) |  1 |     8

 lp | t_xmin | t_xmax | t_ctid
----+--------+--------+--------
  1 |    823 |    824 | (0,2)
  2 |    824 |    825 | (0,3)
  3 |    825 |      0 | (0,3)
```

Một dòng logic `id=1` nhưng **3 phiên bản vật lý** trong page:

```mermaid
flowchart LR
    V1["Phiên bản 1 (ô 1)<br/>stock=10<br/>xmin=823, xmax=824"] -->|"t_ctid trỏ tới"| V2["Phiên bản 2 (ô 2)<br/>stock=9<br/>xmin=824, xmax=825"]
    V2 -->|"t_ctid trỏ tới"| V3["Phiên bản 3 (ô 3)<br/>stock=8<br/>xmin=825, xmax=0 ✅ đang sống"]
```

Quy tắc hiển thị (đơn giản hóa): transaction T thấy một phiên bản nếu `xmin` **đã commit trước snapshot của T** và `xmax` **chưa commit** (hoặc bằng 0) theo snapshot của T.

- Một transaction `REPEATABLE READ` bắt đầu **trước** xid 824 sẽ vẫn thấy `stock=10` - không cần khóa gì, không chặn ai.
- Đó là lý do **đọc không chặn ghi, ghi không chặn đọc**.
- `ROLLBACK` rẻ: phiên bản mới có `xmin` thuộc transaction bị hủy → không ai thấy.

### 9.1 VACUUM - dọn rác

Phiên bản cũ ("dead tuple") không ai cần nữa vẫn chiếm chỗ. **VACUUM** dọn chúng:

```sql
VACUUM mvcc_demo;
SELECT lp, t_xmin, t_xmax, t_ctid, lp_flags FROM heap_page_items(get_raw_page('mvcc_demo', 0));
```

```text
 lp | t_xmin | t_xmax | t_ctid | lp_flags
----+--------+--------+--------+----------
  1 |        |        |        |        2
  2 |        |        |        |        0
  3 |    825 |      0 | (0,3)  |        1
```

Ô 1 thành *redirect* (lp_flags=2, chuyển hướng tới phiên bản sống), ô 2 được giải phóng (0 = unused, dùng lại được), chỉ ô 3 còn dữ liệu.

**Autovacuum** chạy nền tự động. Vấn đề thực tế:

!!! warning "Transaction dài = kẻ thù của MVCC"
    Một transaction mở **hàng giờ** (ví dụ: ai đó `BEGIN` trong psql rồi đi ăn trưa, hoặc app quên commit) giữ snapshot cũ → VACUUM **không được phép** dọn bất kỳ dead tuple nào mới hơn snapshot đó → bảng **phình to** (bloat), query chậm dần. Theo dõi:

    ```sql
    SELECT pid, now() - xact_start AS duration, state, query
    FROM pg_stat_activity WHERE xact_start IS NOT NULL ORDER BY duration DESC;
    ```

    Đặt `idle_in_transaction_session_timeout = '5min'` để Postgres tự ngắt kết nối "ngồi không trong transaction".

!!! note "Visibility map & Index-Only Scan"
    Index không lưu `xmin/xmax`, nên Index-Only Scan phải hỏi **visibility map** ("page này có toàn dòng mà ai cũng thấy không?"). Page chưa được VACUUM đánh dấu → phải đọc heap (`Heap Fetches` > 0). Đó là lý do ở mục 2.6 ta chạy `VACUUM` trước.

MySQL InnoDB cũng dùng MVCC nhưng theo kiểu khác: sửa dòng tại chỗ và lưu phiên bản cũ trong **undo log**.

## 📖 10. Connection pooling

### 10.1 Vì sao cần pool?

Mở một kết nối Postgres **rất đắt**: TCP handshake + TLS + xác thực + Postgres **fork một tiến trình mới** (~vài MB RAM mỗi kết nối). Mất vài ms tới hàng chục ms.

Mỗi request mở/đóng kết nối = lãng phí. **Connection pool** giữ sẵn một số kết nối mở và cho mượn.

> 💡 **Ví von**: Pool giống **bãi xe đạp công cộng**: thay vì mỗi người mua một chiếc xe (mở kết nối), đi xong vứt (đóng), thì có sẵn 10 chiếc, ai cần mượn, dùng xong trả lại. Hết xe thì **xếp hàng chờ**.

```mermaid
flowchart LR
    subgraph APP["App server (1 process)"]
        R1["Request 1"] --> P
        R2["Request 2"] --> P
        R3["Request ..."] --> P
        R4["Request 500"] --> P
        P["Connection pool<br/>MaxConns = 10<br/>(request thứ 11 phải chờ)"]
    end
    P --> C1["conn 1"] --> PG[("PostgreSQL<br/>max_connections = 100")]
    P --> C2["conn 2"] --> PG
    P --> C3["... conn 10"] --> PG
```

Postgres có giới hạn cứng `max_connections` (mặc định 100). Vượt quá:

```text
Kết nối thứ 101 thất bại: connection failed: connection to server at "127.0.0.1", port 5432 failed: FATAL:  sorry, too many clients already
```

Bài toán thực tế: bạn có **20 pod** Kubernetes × pool 10 = 200 kết nối > 100 → **sập** khi scale. Phải tính: `số instance × MaxConns ≤ max_connections - dự phòng`.

### 10.2 Cấu hình pool và quan sát

=== "Go"

    ```go
    package main

    import (
    	"context"
    	"fmt"
    	"log"
    	"sync"
    	"time"

    	"github.com/jackc/pgx/v5/pgxpool"
    )

    func main() {
    	ctx := context.Background()
    	cfg, err := pgxpool.ParseConfig("postgres://postgres:pass@localhost:5432/shop")
    	if err != nil {
    		log.Fatal(err)
    	}
    	cfg.MaxConns = 10                      // tối đa 10 kết nối thật tới Postgres
    	cfg.MinConns = 2                       // giữ sẵn 2 kết nối "ấm"
    	cfg.MaxConnLifetime = 30 * time.Minute // đóng & mở lại định kỳ (cân bằng lại sau failover)
    	cfg.MaxConnIdleTime = 5 * time.Minute  // kết nối rảnh quá lâu thì đóng bớt
    	db, err := pgxpool.NewWithConfig(ctx, cfg)
    	if err != nil {
    		log.Fatal(err)
    	}
    	defer db.Close()

    	start := time.Now()
    	var wg sync.WaitGroup
    	for i := 0; i < 50; i++ { // 50 "request" đồng thời, mỗi cái giữ kết nối 100ms
    		wg.Add(1)
    		go func() {
    			defer wg.Done()
    			if _, err := db.Exec(ctx, "SELECT pg_sleep(0.1)"); err != nil {
    				log.Println(err)
    			}
    		}()
    	}
    	time.Sleep(50 * time.Millisecond)
    	s := db.Stat()
    	fmt.Printf("Đang chạy: total=%d acquired=%d idle=%d\n", s.TotalConns(), s.AcquiredConns(), s.IdleConns())
    	wg.Wait()
    	s = db.Stat()
    	fmt.Printf("50 query x 100ms với pool 10 kết nối: %v\n", time.Since(start).Round(10*time.Millisecond))
    	fmt.Printf("Tổng số lần phải chờ kết nối rảnh: %d, tổng thời gian chờ: %v\n",
    		s.EmptyAcquireCount(), s.AcquireDuration().Round(10*time.Millisecond))
    }

    // Output:
    // Đang chạy: total=10 acquired=10 idle=0
    // 50 query x 100ms với pool 10 kết nối: 540ms
    // Tổng số lần phải chờ kết nối rảnh: 50, tổng thời gian chờ: 11.56s
    ```

=== "Python"

    ```python
    # psycopg-pool 3.3.x
    from psycopg_pool import ConnectionPool

    pool = ConnectionPool(
        "postgresql://postgres:pass@localhost:5432/shop",
        min_size=2,          # giữ sẵn 2 kết nối
        max_size=10,         # tối đa 10
        max_lifetime=1800,   # giây - tái tạo kết nối định kỳ
        max_idle=300,        # đóng kết nối rảnh quá 5 phút
        timeout=5,           # chờ tối đa 5s để mượn được kết nối, quá thì PoolTimeout
    )

    with pool.connection() as conn:          # mượn
        print(conn.execute("SELECT 1").fetchone())
    # tự trả về pool khi ra khỏi with
    print(pool.get_stats())                  # pool_size, requests_waiting, ...
    pool.close()
    ```

50 query × 100ms, chỉ 10 kết nối → phải chạy thành 5 "đợt" ≈ 500ms (đo được 540ms). "Tổng thời gian chờ 11.56s" là **cộng dồn** của 50 goroutine - cho thấy request đang **xếp hàng chờ pool**. Nếu metric này tăng cao trên production → pool quá nhỏ **hoặc** query quá chậm.

### 10.3 Pool bao nhiêu là đủ?

**To hơn không phải lúc nào cũng tốt hơn!** Postgres có số CPU giới hạn; 500 kết nối cùng chạy query → tranh CPU, tranh khóa, context switch → **chậm hơn**. Công thức kinh nghiệm (từ HikariCP/PostgreSQL wiki):

```text
pool_size ≈ (số_core_CPU_của_DB × 2) + số_ổ_đĩa_hiệu_dụng
```

DB 8 core → khoảng **20 kết nối hoạt động** là "điểm ngọt". Nhiều app instance thì dùng **PgBouncer** (connection pooler đứng giữa): hàng nghìn kết nối từ app → PgBouncer → chỉ vài chục kết nối thật tới Postgres.

```mermaid
flowchart LR
    A1["App pod 1<br/>pool 20"] --> PB["PgBouncer<br/>pool_mode = transaction"]
    A2["App pod 2<br/>pool 20"] --> PB
    A3["... App pod 50<br/>pool 20"] --> PB
    PB -->|"chỉ 40 kết nối thật"| PG[("PostgreSQL")]
```

!!! warning "PgBouncer transaction mode"
    Ở chế độ `transaction`, mỗi transaction có thể chạy trên một kết nối thật **khác nhau** → không dùng được các tính năng gắn với session: `SET` (không kèm `LOCAL`), advisory lock mức session, `LISTEN`... Prepared statement chỉ được hỗ trợ từ PgBouncer 1.21+ (`max_prepared_statements`).

## 📖 11. Replication - nhân bản dữ liệu

### 11.1 Primary / Replica

**Replication**: giữ bản sao dữ liệu trên nhiều máy. Mục đích:

1. **Chịu lỗi (High Availability)**: primary chết → đẩy replica lên làm primary (**failover**)
2. **Mở rộng đọc (read scaling)**: chia truy vấn đọc (báo cáo, tìm kiếm) sang replica
3. **Backup, phân tích** trên replica mà không ảnh hưởng primary

```mermaid
flowchart LR
    APP["App"] -->|"ghi: INSERT/UPDATE"| P[("Primary")]
    APP -->|"đọc"| R1[("Replica 1")]
    APP -->|"đọc (báo cáo)"| R2[("Replica 2")]
    P -->|"stream WAL"| R1
    P -->|"stream WAL"| R2
```

Postgres dùng **streaming replication**: primary gửi **WAL** (mục 1.4) sang replica, replica phát lại → dữ liệu giống hệt.

### 11.2 Demo replication thật

Tạo replica từ `pg-lesson` bằng `pg_basebackup` (sao chép toàn bộ dữ liệu + tự cấu hình kết nối stream):

```bash
# Trên primary: tạo user replication và cho phép kết nối replication
docker exec pg-lesson sh -c "echo 'host replication all all scram-sha-256' >> /var/lib/postgresql/data/pg_hba.conf"
docker exec pg-lesson psql -U postgres -c "SELECT pg_reload_conf()" \
  -c "CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD 'rep'"

# Replica: sao chép dữ liệu từ primary (IP 172.17.0.2 trong mạng docker) rồi khởi động
docker run -d --name pg-replica -e PGPASSWORD=rep --entrypoint sh postgres:17-alpine -c "
  rm -rf /var/lib/postgresql/data/* &&
  pg_basebackup -h 172.17.0.2 -U replicator -D /var/lib/postgresql/data -R -X stream -c fast &&
  chown -R postgres:postgres /var/lib/postgresql/data && chmod 700 /var/lib/postgresql/data &&
  exec gosu postgres postgres -D /var/lib/postgresql/data"
```

Log của replica:

```text
LOG:  consistent recovery state reached at 0/50000120
LOG:  database system is ready to accept read-only connections
LOG:  started streaming WAL from primary at 0/51000000 on timeline 1
```

Kiểm tra trên primary:

```sql
SELECT client_addr, state, sync_state, sent_lsn, replay_lsn, replay_lag FROM pg_stat_replication;
```

```text
-[ RECORD 1 ]---------------
client_addr | 172.17.0.5
state       | streaming
sync_state  | async
sent_lsn    | 0/51000060
replay_lsn  | 0/51000060
replay_lag  | 00:00:00.11417
```

Ghi ở primary, đọc ở replica, thử ghi vào replica:

```text
-- primary
INSERT INTO accounts VALUES (99, 'Replica test', 1);
INSERT 0 1
-- replica
SELECT * FROM accounts WHERE id = 99;
 id |    owner     | balance
----+--------------+---------
 99 | Replica test |       1
SELECT pg_is_in_recovery(), now() - pg_last_xact_replay_timestamp() AS lag;
 pg_is_in_recovery |       lag
-------------------+-----------------
 t                 | 00:00:00.081524
INSERT INTO accounts VALUES (100, 'x', 1);
ERROR:  cannot execute INSERT in a read-only transaction
```

### 11.3 Sync vs Async & replication lag

```mermaid
sequenceDiagram
    participant C as Client
    participant P as Primary
    participant R as Replica
    Note over C,R: ASYNC (mặc định)
    C->>P: COMMIT
    P->>P: ghi WAL local
    P-->>C: OK ✅ (nhanh)
    P->>R: gửi WAL (sau đó)
    Note over P,R: Primary chết ngay lúc này → mất giao dịch vừa commit
    Note over C,R: SYNC (synchronous_commit = on + synchronous_standby_names)
    C->>P: COMMIT
    P->>R: gửi WAL
    R-->>P: đã ghi xong
    P-->>C: OK ✅ (chậm hơn 1 round-trip)
```

| | Async | Sync |
|---|---|---|
| Tốc độ ghi | Nhanh | Chậm hơn (chờ replica xác nhận) |
| Mất dữ liệu khi primary chết | Có thể mất vài giao dịch cuối | Không mất (RPO = 0) |
| Replica chết | Không ảnh hưởng | **Primary bị treo khi commit** nếu không còn replica sync nào |
| Dùng khi | Đa số hệ thống | Tài chính, ngân hàng (thường dùng *quorum*: `ANY 1 (r1, r2)`) |

**Replication lag** là độ trễ giữa primary và replica. Đo thật khi có một lệnh ghi lớn (cập nhật 300.000 đơn):

```text
UPDATE 300000
-[ RECORD 1 ]---------------
sent_lsn   | 0/5E5C0000
replay_lsn | 0/5DBFFFF8
behind     | 9984 kB
replay_lag | 00:00:00.151582
```

Replica đang chậm ~10MB WAL. Trên production với batch job lớn, lag có thể lên **vài giây tới vài phút**.

!!! warning "Bẫy read-your-writes"
    Người dùng đổi avatar (ghi vào primary) → trang reload đọc từ replica (chưa kịp nhận) → thấy **avatar cũ** → nghĩ lỗi → bấm lại. Cách xử lý:

    - Đọc từ **primary** trong vài giây sau khi user đó vừa ghi (lưu mốc thời gian trong session/cookie).
    - Đọc dữ liệu **của chính mình** (profile, giỏ hàng, đơn vừa đặt) từ primary; dữ liệu **công khai** (danh sách sản phẩm) từ replica.
    - Chờ replica đạt tới LSN của lần ghi (`pg_last_wal_replay_lsn() >= lsn`).

**Failover**: công cụ như **Patroni** (dùng etcd/Consul bầu leader), dịch vụ managed (AWS RDS Multi-AZ, Cloud SQL HA) tự phát hiện primary chết và thăng cấp replica. Phải cẩn thận **split-brain**: hai máy cùng nghĩ mình là primary.

## 📖 12. Partitioning & Sharding

Khi một bảng lên tới **hàng trăm triệu - hàng tỷ dòng**, index to hơn RAM, VACUUM chạy hàng giờ, xóa dữ liệu cũ cực chậm. Giải pháp: **chia nhỏ**.

```mermaid
flowchart TB
    subgraph PART["Partitioning: chia bảng, vẫn 1 server"]
        direction LR
        T["orders (bảng cha, logic)"] --> P1["orders_2024"]
        T --> P2["orders_2025"]
        T --> P3["orders_2026"]
    end
    subgraph SHARD["Sharding: chia dữ liệu ra NHIỀU server"]
        direction LR
        RT["Router / app<br/>shard = hash(user_id) % 3"] --> S1[("Server 1<br/>user 0,3,6...")]
        RT --> S2[("Server 2<br/>user 1,4,7...")]
        RT --> S3[("Server 3<br/>user 2,5,8...")]
    end
```

### 12.1 Partitioning trong PostgreSQL

```sql
CREATE TABLE orders_p (
  id bigint NOT NULL, customer_id bigint NOT NULL, status text NOT NULL,
  total numeric(12,0) NOT NULL, created_at timestamptz NOT NULL,
  PRIMARY KEY (id, created_at)          -- khóa chính PHẢI chứa cột partition
) PARTITION BY RANGE (created_at);
CREATE TABLE orders_2024 PARTITION OF orders_p FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
CREATE TABLE orders_2025 PARTITION OF orders_p FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE orders_2026 PARTITION OF orders_p FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
INSERT INTO orders_p SELECT id, customer_id, status, total, created_at FROM orders;
SELECT tableoid::regclass AS partition, count(*) FROM orders_p GROUP BY 1 ORDER BY 1;
```

```text
  partition  | count
-------------+--------
 orders_2024 | 500975
 orders_2025 | 499025
```

**Partition pruning** - query chỉ đụng partition liên quan:

```sql
EXPLAIN ANALYZE SELECT count(*) FROM orders_p
WHERE created_at >= '2025-03-01' AND created_at < '2025-04-01';
```

```text
 Finalize Aggregate  (cost=8761.64..8761.65 rows=1 width=8) (actual time=20.171..23.820 rows=1 loops=1)
   ->  Gather  (cost=8761.42..8761.63 rows=2 width=8) (actual time=19.968..23.814 rows=3 loops=1)
         Workers Planned: 2
         Workers Launched: 2
         ->  Partial Aggregate  (cost=7761.42..7761.43 rows=1 width=8) (actual time=16.859..16.860 rows=1 loops=3)
               ->  Parallel Seq Scan on orders_2025 orders_p  (cost=0.00..7717.91 rows=17406 width=0) (actual time=0.015..16.027 rows=14193 loops=3)
                     Filter: ((created_at >= '2025-03-01 00:00:00+00'::timestamp with time zone) AND (created_at < '2025-04-01 00:00:00+00'::timestamp with time zone))
                     Rows Removed by Filter: 152149
 Execution Time: 23.860 ms
```

Chỉ `orders_2025` được quét; `orders_2024` và `orders_2026` bị bỏ qua hoàn toàn.

Lợi ích lớn nhất của partitioning theo thời gian: **xóa dữ liệu cũ tức thì**. `DROP TABLE orders_2020` mất vài ms, trong khi `DELETE FROM orders WHERE created_at < '2021-01-01'` với 100 triệu dòng mất hàng giờ, sinh hàng GB WAL và để lại bloat.

| Kiểu | Ví dụ | Dùng khi |
|---|---|---|
| `RANGE` | Theo tháng/năm | Log, đơn hàng, sự kiện - dữ liệu có thời gian |
| `LIST` | Theo `region IN ('north','south')` | Chia theo vùng, theo tenant lớn |
| `HASH` | `MODULUS 8, REMAINDER n` | Chia đều khi không có khóa tự nhiên |

### 12.2 Sharding

Khi **một server không chịu nổi** (ghi quá nhiều, dữ liệu quá lớn) → chia dữ liệu sang **nhiều server**, mỗi server (shard) giữ một phần.

**Chọn shard key** là quyết định quan trọng nhất, rất khó thay đổi về sau:

| Chiến lược | Cách làm | Ưu | Nhược |
|---|---|---|---|
| **Hash** | `shard = hash(user_id) % N` | Phân bố đều | Thêm shard → phải di chuyển gần hết dữ liệu (dùng **consistent hashing** để giảm - xem [Bài 10](./10-system-design.md)) |
| **Range** | user 1-1tr → shard 1, 1tr-2tr → shard 2 | Truy vấn khoảng dễ | Dễ "nóng" một shard (user mới đều vào shard cuối) |
| **Directory / lookup** | Bảng tra `tenant_id → shard` | Linh hoạt, di chuyển tenant dễ | Thêm một dịch vụ tra cứu |
| **Theo địa lý** | Khách VN → shard Singapore | Độ trễ thấp, tuân thủ luật dữ liệu | Không đều |

!!! warning "Sharding là phương án CUỐI CÙNG"
    Sharding mang lại nỗi đau lớn: JOIN giữa các shard gần như không thể, transaction xuyên shard cần 2PC/saga, `UNIQUE` toàn cục khó, báo cáo phải gom từ mọi shard, vận hành phức tạp gấp N lần. **Thứ tự nên thử**: tối ưu query & index → nâng cấp máy (scale up) → read replica → cache → partitioning → tách DB theo service → **rồi mới** sharding. Một Postgres tốt trên máy mạnh chịu được **hàng TB dữ liệu và hàng chục nghìn query/giây**. Nếu cần, dùng giải pháp có sẵn: **Citus** (Postgres), **Vitess** (MySQL - YouTube, Slack dùng), hoặc DB phân tán như CockroachDB, YugabyteDB, TiDB.

Chọn shard key tốt: truy vấn phổ biến nhất **chỉ cần 1 shard**. Ví dụ app SaaS: shard theo `tenant_id` - mọi dữ liệu của một công ty nằm cùng shard, JOIN thoải mái trong phạm vi công ty.

## 📖 13. Backup & Restore

> "Backup chưa từng được thử restore = không có backup."

### 13.1 Logical backup: `pg_dump`

Xuất dữ liệu thành lệnh SQL hoặc định dạng nén riêng (`-Fc`):

```bash
docker exec pg-lesson sh -c 'time pg_dump -U postgres -Fc -f /tmp/shop.dump shop && ls -lh /tmp/shop.dump'
docker exec pg-lesson sh -c 'createdb -U postgres shop_restore && time pg_restore -U postgres -d shop_restore -j 4 /tmp/shop.dump'
docker exec pg-lesson psql -U postgres -d shop_restore -c "select count(*) from orders"
```

```text
real	0m 3.93s
-rw-r--r--    1 root     root       19.9M Sep 26 15:53 /tmp/shop.dump
real	0m 2.81s
  count
---------
 1000000
```

Database ~150MB (bảng + index) nén thành dump 20MB. `-j 4` restore song song 4 luồng. Nhược điểm: với DB **hàng trăm GB**, dump/restore mất **hàng giờ**, và chỉ khôi phục được về **thời điểm dump**.

### 13.2 Physical backup + WAL archiving = PITR

**Point-In-Time Recovery (PITR)**: backup toàn bộ thư mục dữ liệu định kỳ (`pg_basebackup` - như ta vừa làm để tạo replica) + **lưu trữ liên tục mọi file WAL** (lên S3). Khi sự cố, khôi phục base backup rồi **phát lại WAL tới đúng thời điểm** mong muốn - ví dụ 14:31:59, **1 giây trước** khi thực tập sinh chạy `DELETE FROM orders` quên `WHERE`.

```mermaid
gantt
    title PITR - khôi phục về 1 giây trước sự cố
    dateFormat HH:mm
    axisFormat %H:%M
    section Base backup
    Base backup lúc 02:00 :done, b1, 02:00, 10m
    section WAL archive
    WAL liên tục lên S3 :active, w1, 02:10, 12h
    section Sự cố
    DELETE nhầm lúc 14:32 :crit, s1, 14:32, 5m
    section Khôi phục
    Restore base + replay WAL tới 14:31:59 :r1, 14:40, 30m
```

Công cụ: **pgBackRest**, **WAL-G**, **Barman**; dịch vụ managed (RDS, Cloud SQL) có sẵn PITR.

| Khái niệm | Ý nghĩa | Ví dụ mục tiêu |
|---|---|---|
| **RPO** (Recovery Point Objective) | Được phép mất tối đa bao nhiêu dữ liệu | "Tối đa 5 phút" → WAL archive mỗi ≤ 5 phút |
| **RTO** (Recovery Time Objective) | Được phép "chết" tối đa bao lâu | "Tối đa 1 giờ" → phải restore xong trong 1 giờ |

!!! tip "Quy tắc 3-2-1 và diễn tập"
    - **3** bản sao, trên **2** loại lưu trữ khác nhau, **1** bản ở nơi khác (region khác, tài khoản cloud khác - phòng khi tài khoản bị hack xóa sạch).
    - **Replica KHÔNG phải backup**: `DROP TABLE` trên primary sẽ được replicate sang replica trong vài ms.
    - **Tự động restore thử** hàng tuần vào môi trường tạm và chạy kiểm tra (đếm dòng, checksum). Đo thời gian restore để biết RTO thật.

## 📖 14. Migration trên production - không downtime

### 14.1 Vì sao migration nguy hiểm?

Nhiều lệnh `ALTER TABLE` lấy khóa **ACCESS EXCLUSIVE** - chặn **mọi** truy vấn kể cả `SELECT`. Tệ hơn nữa là **hàng đợi khóa**: nếu có một transaction dài đang đọc bảng, `ALTER TABLE` phải chờ; trong lúc chờ, **mọi query mới** xếp hàng **sau** `ALTER TABLE` → cả hệ thống đứng hình.

```mermaid
sequenceDiagram
    participant L as Query báo cáo dài (SELECT)
    participant M as Migration (ALTER TABLE)
    participant U as Hàng nghìn request user
    L->>L: giữ ACCESS SHARE (30 giây)
    M->>M: xin ACCESS EXCLUSIVE → phải chờ L
    U->>U: SELECT ... xin ACCESS SHARE → phải chờ M!
    Note over U: API timeout hàng loạt 🔥
```

**Luôn đặt `lock_timeout`** trong migration để thà thất bại (rồi thử lại) còn hơn làm treo hệ thống. Demo thật:

```text
A: BEGIN; SELECT ... FROM products;  -- transaction dài, chưa COMMIT
B: ALTER TABLE ... sau 2.0s -> LockNotAvailable: canceling statement due to lock timeout
B: thử lại sau khi A commit -> OK
```

```sql
SET lock_timeout = '2s';
SET statement_timeout = '15min';
ALTER TABLE products ADD COLUMN note text;
```

### 14.2 Thao tác an toàn và không an toàn (PostgreSQL 11+)

| Thao tác | An toàn? | Cách làm đúng |
|---|---|---|
| `ADD COLUMN` nullable, hoặc có `DEFAULT` hằng số | ✅ Chỉ sửa metadata, tức thì | Đo thật: `ADD COLUMN channel text NOT NULL DEFAULT 'web'` trên 1 triệu dòng: **1.7ms** |
| `CREATE INDEX` | ❌ Chặn ghi suốt quá trình | `CREATE INDEX CONCURRENTLY` (không chặn ghi; đo thật: 603ms trên 1 triệu dòng; không chạy được trong transaction) |
| `ADD COLUMN ... DEFAULT now()` / hàm volatile | ❌ Viết lại cả bảng | Thêm cột nullable → backfill theo lô → đặt default |
| `ALTER COLUMN TYPE` (int → bigint) | ❌ Viết lại cả bảng + index | Cột mới + trigger/dual-write + backfill + đổi |
| `SET NOT NULL` | ⚠️ Quét toàn bảng dưới khóa | `ADD CONSTRAINT ... CHECK (col IS NOT NULL) NOT VALID` → `VALIDATE CONSTRAINT` → `SET NOT NULL` (PG12+ dùng lại check) |
| `ADD FOREIGN KEY` | ⚠️ Quét và khóa | `ADD CONSTRAINT ... NOT VALID` rồi `VALIDATE CONSTRAINT` |
| `RENAME COLUMN` / `DROP COLUMN` | ⚠️ Nhanh, nhưng **code cũ đang chạy sẽ lỗi** | Expand/contract (dưới đây) |

### 14.3 Expand / Contract (parallel change)

Khi deploy, **code cũ và code mới cùng chạy** trong vài phút (rolling update). Schema phải tương thích với **cả hai**. Ví dụ đổi tên cột `full_name` → `display_name`:

```mermaid
flowchart LR
    E1["1. EXPAND<br/>ADD COLUMN display_name"] --> E2["2. Deploy code<br/>GHI cả 2 cột,<br/>đọc cột cũ"]
    E2 --> E3["3. BACKFILL<br/>copy dữ liệu cũ<br/>theo lô 5.000 dòng"]
    E3 --> E4["4. Deploy code<br/>ĐỌC cột mới<br/>(vẫn ghi cả 2)"]
    E4 --> E5["5. Deploy code<br/>chỉ dùng cột mới"]
    E5 --> E6["6. CONTRACT<br/>DROP COLUMN full_name"]
```

Mỗi bước là một lần deploy riêng, **có thể rollback** độc lập. Backfill theo lô để không khóa lâu và không tạo replication lag lớn:

```sql
-- chạy lặp lại cho tới khi UPDATE 0
UPDATE customers SET display_name = full_name
WHERE id IN (
  SELECT id FROM customers WHERE display_name IS NULL LIMIT 5000
);
-- nghỉ 100ms giữa các lô, theo dõi replication lag
```

!!! tip "Công cụ migration"
    Go: **golang-migrate**, **goose**, **atlas**. Python: **Alembic** (SQLAlchemy), Django migrations. Luôn: file migration trong git, chạy tự động trong CI/CD ([Bài 13](./13-testing-cicd-deployment.md)), **review migration như review code**, thử trên bản sao dữ liệu production trước. Công cụ lint như **squawk** phát hiện migration nguy hiểm tự động.

## 🌍 Ứng dụng thực tế

| Tình huống | Kỹ thuật trong bài |
|---|---|
| **Flash sale 12.12** trên sàn TMĐT: 50.000 người tranh 1.000 sản phẩm | UPDATE nguyên tử `stock = stock - 1 WHERE stock >= 1`, đệm bằng Redis + queue ([Bài 8](./08-caching.md), [Bài 9](./09-message-queues.md)) |
| **Ví điện tử / ngân hàng** chuyển tiền | Transaction, khóa theo thứ tự id tránh deadlock, SERIALIZABLE hoặc FOR UPDATE, sync replication, PITR |
| **Đặt vé xem phim / phòng khách sạn** | Chống write skew bằng `UNIQUE (showtime_id, seat)` hoặc `EXCLUDE USING gist` |
| **Trang admin CMS** nhiều người sửa cùng bài viết | Optimistic locking (`version` + ETag/If-Match) |
| **Bảng log / event hàng tỷ dòng** | Partition theo tháng, BRIN index, `DROP` partition cũ |
| **Dashboard doanh thu** chậm | Bảng tổng hợp, materialized view, replica cho báo cáo |
| **SaaS nhiều khách hàng doanh nghiệp** | Shard theo `tenant_id` (Citus), partial index theo tenant lớn |
| **Deploy 20 lần/ngày** không bảo trì | Expand/contract, `CREATE INDEX CONCURRENTLY`, `lock_timeout` |

## ⚠️ Lỗi thường gặp

**1. Quên index cột khóa ngoại**

```sql
-- ❌ orders.customer_id không có index → JOIN chậm, xóa customer quét cả bảng orders
-- ✅
CREATE INDEX CONCURRENTLY idx_orders_customer ON orders (customer_id);
```

**2. Đánh index "mọi cột cho chắc"** → ghi chậm 10 lần (đã đo ở mục 2.10), tốn RAM. Index theo query thực tế và xóa index `idx_scan = 0`.

**3. Bọc cột trong hàm / sai kiểu dữ liệu** → index vô dụng. `WHERE date(created_at) = ...`, `WHERE lower(email) = ...` (không có expression index), so sánh `text` với số.

**4. Composite index sai thứ tự cột** → `(created_at, customer_id)` cho query `WHERE customer_id = ? ORDER BY created_at`. Cột `=` trước, cột khoảng/sort sau.

**5. Đọc - tính trong app - ghi lại** → lost update.

```python
# ❌
stock = db.execute("SELECT stock FROM products WHERE id=1").fetchone()[0]
db.execute("UPDATE products SET stock=%s WHERE id=1", (stock - 1,))
# ✅
db.execute("UPDATE products SET stock = stock - 1 WHERE id=1 AND stock >= 1")
```

**6. Gọi API bên ngoài bên trong transaction** (gửi email, gọi cổng thanh toán) → transaction kéo dài vài giây, giữ khóa, chiếm kết nối pool, cản VACUUM. Làm việc ngoài transaction, dùng **outbox pattern** ([Bài 9](./09-message-queues.md)).

**7. Không retry khi gặp `40001` / `40P01`** ở REPEATABLE READ/SERIALIZABLE hoặc deadlock → người dùng thấy lỗi 500 ngẫu nhiên.

**8. Pool quá lớn × quá nhiều instance** → `too many clients already` khi autoscale. Tính tổng, dùng PgBouncer.

**9. Đọc từ replica ngay sau khi ghi** → user thấy dữ liệu cũ (read-your-writes).

**10. `EXPLAIN ANALYZE` một câu `DELETE`/`UPDATE` trên production** mà không bọc `BEGIN ... ROLLBACK` → xóa thật.

**11. Migration không có `lock_timeout`**, `CREATE INDEX` không `CONCURRENTLY`, đổi tên cột một bước → sự cố downtime.

**12. Có replica nên nghĩ là có backup** → `DROP TABLE` được nhân bản ngay lập tức.

**13. `OFFSET` lớn cho phân trang** → trang càng sâu càng chậm (263ms ở trang 45.000). Dùng keyset.

## 🏋️ Bài tập

### Bài 1 (Dễ): Đo tác dụng của index

Với dataset trong bài, viết query tìm **tất cả đơn `cancelled` của khách `777`**. Đo `EXPLAIN ANALYZE` khi: (a) không có index nào ngoài khóa chính, (b) có index `(customer_id)`, (c) có index `(customer_id, status)`. Ghi lại thời gian và số buffer.

<details><summary>Gợi ý đáp án</summary>

```sql
DROP INDEX IF EXISTS idx_orders_cust_created;  -- làm sạch
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM orders WHERE customer_id = 777 AND status = 'cancelled';
-- (a) Parallel Seq Scan, ~30-40ms, hàng nghìn buffer

CREATE INDEX idx_c ON orders (customer_id);
-- (b) Bitmap Heap Scan, Filter: status = 'cancelled', Rows Removed by Filter ~9, ~0.05ms

CREATE INDEX idx_cs ON orders (customer_id, status);
-- (c) Index Cond cả hai cột, không còn "Rows Removed by Filter"
```

Nhận xét: (b) và (c) chênh nhau rất ít vì mỗi khách chỉ ~10 đơn - thêm `status` vào index **không đáng** ở đây. Index (c) chỉ đáng khi mỗi khách có hàng nghìn đơn.
</details>

### Bài 2 (Dễ): Sửa query không sargable

Viết lại các điều kiện sau để dùng được index B-tree trên cột tương ứng:

1. `WHERE extract(year FROM created_at) = 2025`
2. `WHERE total / 1000 > 4000`
3. `WHERE substring(email, 1, 5) = 'user7'`

<details><summary>Đáp án</summary>

1. `WHERE created_at >= '2025-01-01' AND created_at < '2026-01-01'`
2. `WHERE total > 4000000`
3. `WHERE email LIKE 'user7%'` (cần index với `text_pattern_ops` nếu collation không phải `C`: `CREATE INDEX ON customers (email text_pattern_ops)`)
</details>

### Bài 3 (Trung bình): Tái hiện lost update và sửa

Mở **2 cửa sổ psql**. Tái hiện lost update trên bảng `products` (READ COMMITTED). Sau đó sửa bằng **cả 3 cách**: UPDATE nguyên tử, `FOR UPDATE`, optimistic `version`. Ghi lại thứ tự lệnh từng cách.

### Bài 4 (Trung bình): Chuyển tiền không deadlock

Viết hàm `Transfer(from, to, amount)` (Go **hoặc** Python) chạy trong transaction:
- Không cho số dư âm
- **Không bao giờ deadlock** dù có 100 goroutine/thread chuyển qua lại ngẫu nhiên giữa 10 tài khoản
- Kiểm tra: tổng tiền 10 tài khoản trước và sau **bằng nhau**

<details><summary>Gợi ý</summary>

Khóa hai dòng theo thứ tự id tăng dần trong **một** câu:

```sql
SELECT id, balance FROM accounts WHERE id IN ($1, $2) ORDER BY id FOR UPDATE;
```

Sau đó kiểm tra số dư trong app và chạy 2 lệnh UPDATE. Vẫn nên retry khi gặp `40P01` phòng trường hợp code khác khóa sai thứ tự.
</details>

### Bài 5 (Trung bình): Phát hiện N+1 trong ORM

Dùng GORM (Go) hoặc SQLAlchemy (Python), tạo quan hệ `Customer has many Orders`. Viết endpoint liệt kê 50 khách kèm số đơn. Bật log SQL, đếm số query. Sửa bằng `Preload` / `selectinload` và bằng một query `GROUP BY`. So sánh thời gian.

### Bài 6 (Khó): Write skew đặt phòng họp

Bảng `bookings(room_id, starts_at, ends_at)`. Hai người cùng đặt phòng A từ 14:00-15:00 và 14:30-15:30.

1. Viết logic "kiểm tra trùng rồi chèn" ở READ COMMITTED và tái hiện được việc **cả hai cùng đặt thành công**.
2. Sửa bằng SERIALIZABLE + retry.
3. Sửa bằng ràng buộc DB: `EXCLUDE USING gist (room_id WITH =, tstzrange(starts_at, ends_at) WITH &&)` (cần `CREATE EXTENSION btree_gist`). So sánh hai cách.

### Bài 7 (Khó): Migration không downtime

Bảng `orders` có cột `total numeric(12,0)`. Yêu cầu: đổi sang lưu `total_cents bigint` **không downtime**, trong khi app vẫn ghi 100 đơn/giây. Viết kế hoạch expand/contract từng bước (SQL + thay đổi code + thứ tự deploy), gồm backfill theo lô và cách kiểm tra dữ liệu khớp trước khi contract.

### Bài 8 (Khó): Replica & lag

Dựng primary + replica như mục 11.2. Viết script ghi liên tục vào primary và đo `replay_lag` mỗi giây. Chạy một `UPDATE` 1 triệu dòng, vẽ biểu đồ lag theo thời gian. Sau đó viết hàm "đọc an toàn": nếu user vừa ghi trong 5 giây gần nhất thì đọc primary, ngược lại đọc replica.

## ✅ Checklist hoàn thành

- [ ] Giải thích được page, heap, `ctid`, buffer pool, WAL và vì sao WAL giúp database không mất dữ liệu khi mất điện
- [ ] Vẽ được B+tree và giải thích vì sao 3-4 lần đọc page đủ tìm 1 dòng trong 100 triệu dòng
- [ ] Áp dụng đúng quy tắc leftmost prefix, biết khi nào dùng covering / partial / expression index
- [ ] Giải thích vì sao planner bỏ qua index khi selectivity thấp, và chi phí ghi của index
- [ ] Đọc được `EXPLAIN (ANALYZE, BUFFERS)`: node, cost, rows ước lượng vs thật, loops, buffers
- [ ] Phát hiện và sửa N+1 bằng JOIN hoặc batch `ANY($1)`
- [ ] Phân biệt 5 anomaly và biết isolation level nào chặn anomaly nào trong Postgres
- [ ] Dùng được UPDATE nguyên tử, `SELECT ... FOR UPDATE`, `SKIP LOCKED`, optimistic locking
- [ ] Biết phòng và xử lý deadlock, retry lỗi `40001`/`40P01`
- [ ] Giải thích MVCC bằng `xmin`/`xmax`, vai trò của VACUUM và tác hại của transaction dài
- [ ] Cấu hình connection pool hợp lý, biết khi nào cần PgBouncer
- [ ] Hiểu replication sync/async, replication lag và bẫy read-your-writes
- [ ] Phân biệt partitioning và sharding, biết vì sao sharding là phương án cuối
- [ ] Biết `pg_dump` vs PITR, RPO/RTO, quy tắc 3-2-1
- [ ] Viết được kế hoạch migration expand/contract với `lock_timeout` và `CREATE INDEX CONCURRENTLY`

**Bài tiếp theo**: [Bài 7: NoSQL](./07-nosql.md)
