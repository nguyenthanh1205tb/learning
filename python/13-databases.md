# 📚 Bài 13: Làm việc với Database

## 🎯 Mục tiêu bài học

- Hiểu **database** là gì, vì sao ứng dụng thật không lưu dữ liệu bằng file JSON
- Viết **SQL cơ bản**: `CREATE TABLE`, `INSERT`, `SELECT`, `WHERE`, `ORDER BY`, `GROUP BY`, `JOIN`, `UPDATE`, `DELETE`, `INDEX`
- Dùng module **`sqlite3`** (có sẵn trong Python): connect, cursor, placeholder `?`, `executemany`, `sqlite3.Row`, `commit`/`rollback`
- Hiểu **transaction** và tính "tất cả hoặc không gì cả"
- Hiểu **SQL Injection** - lỗ hổng bảo mật kinh điển - và cách phòng tránh tuyệt đối
- Tổ chức code truy cập dữ liệu bằng **Repository pattern**
- Dùng **SQLAlchemy 2.0 ORM**: `DeclarativeBase`, `Mapped`, `mapped_column`, `Session`, `select()`, `relationship` một-nhiều
- Biết **migration** là gì và vai trò của **Alembic**
- Biết khi nào chuyển từ SQLite sang **PostgreSQL**
- Nối database vào **FastAPI** (tiếp nối Bài 12)
- Xây 3 ứng dụng: **kho hàng + đơn hàng có transaction**, **báo cáo doanh thu theo tháng**, **thư viện sách với quan hệ tác giả - sách**

## 📖 1. Database là gì? Tại sao không dùng file JSON?

Ở Bài 10, Todo CLI lưu dữ liệu vào file JSON. Với vài trăm công việc của một người thì ổn. Nhưng hãy tưởng tượng một shop online:

| Vấn đề | File JSON | Database |
| --- | --- | --- |
| 100.000 đơn hàng, tìm đơn của khách "An" | Đọc **toàn bộ** file vào RAM rồi lọc 🐢 | Dùng **index**, tìm trong mili-giây ⚡ |
| 2 người cùng mua sản phẩm cuối cùng lúc | Ghi đè lẫn nhau, bán 2 chiếc khi chỉ còn 1 😱 | **Transaction** + khóa đảm bảo đúng |
| Mất điện giữa lúc đang ghi file | File hỏng, mất sạch dữ liệu | Tự phục hồi về trạng thái an toàn |
| Giá âm, email trùng, đơn của khách không tồn tại | Tự viết code kiểm tra ở mọi nơi | **Ràng buộc** (`CHECK`, `UNIQUE`, `FOREIGN KEY`) chặn ngay |
| "Doanh thu tháng 3 theo từng danh mục?" | Viết vòng lặp, dict, cộng dồn... | **Một câu SQL** |

> 🧠 **Ví dụ dễ hiểu**: File JSON giống **cuốn sổ tay** 📓 - tiện cho ghi chép cá nhân. Database giống **thư viện có thủ thư** 🏛️: sách được xếp theo mục lục (index), mượn/trả có sổ sách (transaction), không ai được mang sách ra mà không ghi phiếu (ràng buộc), và nhiều người có thể tra cứu cùng lúc.

### Database quan hệ (Relational Database)

Dữ liệu được tổ chức thành các **bảng (table)** - giống sheet Excel:

```text
Bảng customers                        Bảng orders
┌────┬──────┬─────────┐               ┌────┬─────────────┬────────────┬──────────┐
│ id │ name │ city    │               │ id │ customer_id │ product_id │ quantity │
├────┼──────┼─────────┤               ├────┼─────────────┼────────────┼──────────┤
│ 1  │ An   │ Hà Nội  │ ◄─────────────│ 1  │ 1           │ 1          │ 2        │
│ 2  │ Bình │ TP.HCM  │ ◄──────┐      │ 2  │ 1           │ 3          │ 1        │
└────┴──────┴─────────┘        └──────│ 3  │ 2           │ 2          │ 3        │
                                      └────┴─────────────┴────────────┴──────────┘
```

- **Hàng (row)** = một bản ghi (một khách hàng). **Cột (column)** = một thuộc tính (tên, thành phố).
- **Primary key (khóa chính)** - cột `id`: định danh **duy nhất** cho mỗi hàng, như số CCCD.
- **Foreign key (khóa ngoại)** - cột `orders.customer_id`: trỏ tới `customers.id`, tạo **quan hệ** giữa hai bảng. Nhờ vậy thông tin khách hàng chỉ lưu **một chỗ**; đổi địa chỉ khách không phải sửa hàng nghìn đơn hàng.

Ngôn ngữ để làm việc với database quan hệ là **SQL** (Structured Query Language) - chung cho SQLite, PostgreSQL, MySQL, SQL Server... chỉ khác nhau chút ít.

| Database | Đặc điểm | Dùng khi |
| --- | --- | --- |
| **SQLite** | Cả database là **một file**, không cần cài server, có sẵn trong Python | Học tập, app desktop/mobile, tool, prototype, web nhỏ |
| **PostgreSQL** | Server mạnh mẽ, nhiều người dùng đồng thời, nhiều tính năng | Web/app production |
| **MySQL/MariaDB** | Server phổ biến | Web, hosting phổ thông |
| NoSQL (MongoDB, Redis...) | Không theo mô hình bảng | Dữ liệu dạng document, cache, trường hợp đặc biệt |

Bài này dùng **SQLite** để học (không cần cài gì), và mọi kiến thức SQL đều dùng được cho PostgreSQL.

## 📖 2. SQL cơ bản cho người mới

### Chuẩn bị: database mẫu

Lưu file dưới đây thành `shop_db.py` - nó tạo một database mẫu **trong RAM** và hàm `show()` in kết quả truy vấn dạng bảng. Các ví dụ SQL trong phần này đều import từ file này.

```python
# file: shop_db.py
"""Database mẫu cho các ví dụ SQL + hàm show() in kết quả thành bảng."""

import sqlite3

SCHEMA = """
CREATE TABLE customers (
    id    INTEGER PRIMARY KEY,           -- Khóa chính, SQLite tự tăng 1, 2, 3...
    name  TEXT NOT NULL,                 -- NOT NULL: bắt buộc có giá trị
    email TEXT UNIQUE,                   -- UNIQUE: không được trùng
    city  TEXT
);

CREATE TABLE products (
    id       INTEGER PRIMARY KEY,
    name     TEXT NOT NULL,
    category TEXT NOT NULL,
    price    INTEGER NOT NULL CHECK (price > 0)   -- CHECK: điều kiện phải thỏa
);

CREATE TABLE orders (
    id          INTEGER PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id),   -- Khóa ngoại
    product_id  INTEGER NOT NULL REFERENCES products(id),
    quantity    INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    order_date  TEXT NOT NULL                                -- Ngày lưu dạng ISO: 'YYYY-MM-DD'
);
"""

CUSTOMERS = [
    (1, "An", "an@mail.com", "Hà Nội"),
    (2, "Bình", "binh@mail.com", "TP.HCM"),
    (3, "Chi", "chi@mail.com", "Đà Nẵng"),
    (4, "Dũng", None, "Hà Nội"),                # Chưa mua gì, chưa có email
]
PRODUCTS = [
    (1, "Bàn phím", "Phụ kiện", 500_000),
    (2, "Chuột", "Phụ kiện", 200_000),
    (3, "Màn hình", "Màn hình", 3_000_000),
    (4, "Laptop", "Máy tính", 15_000_000),
    (5, "Tai nghe", "Phụ kiện", 800_000),
]
ORDERS = [
    (1, 1, 1, 2, "2026-01-15"),
    (2, 1, 3, 1, "2026-01-20"),
    (3, 2, 2, 3, "2026-02-03"),
    (4, 3, 4, 1, "2026-02-14"),
    (5, 2, 5, 2, "2026-03-01"),
    (6, 1, 2, 1, "2026-03-09"),
]


def create_sample_db() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")          # ":memory:" = database tạm trong RAM
    conn.execute("PRAGMA foreign_keys = ON")    # SQLite mặc định TẮT kiểm tra khóa ngoại!
    conn.executescript(SCHEMA)
    conn.executemany("INSERT INTO customers VALUES (?, ?, ?, ?)", CUSTOMERS)
    conn.executemany("INSERT INTO products VALUES (?, ?, ?, ?)", PRODUCTS)
    conn.executemany("INSERT INTO orders VALUES (?, ?, ?, ?, ?)", ORDERS)
    conn.commit()
    return conn


def show(conn: sqlite3.Connection, sql: str, params=()) -> None:
    """Chạy câu SELECT và in kết quả thành bảng."""
    cur = conn.execute(sql, params)
    headers = [col[0] for col in cur.description]
    rows = [["NULL" if v is None else str(v) for v in row] for row in cur.fetchall()]
    widths = [max([len(h)] + [len(r[i]) for r in rows]) for i, h in enumerate(headers)]
    print(" | ".join(h.ljust(w) for h, w in zip(headers, widths)).rstrip())
    print("-+-".join("-" * w for w in widths))
    for r in rows:
        print(" | ".join(v.ljust(w) for v, w in zip(r, widths)).rstrip())
```

### `SELECT` - Lấy dữ liệu

Cú pháp đọc gần như tiếng Anh: "**CHỌN** cột nào **TỪ** bảng nào **Ở ĐÂU** điều kiện gì **SẮP XẾP THEO** gì".

```python
from shop_db import create_sample_db, show

conn = create_sample_db()

show(conn, "SELECT name, city FROM customers")            # Chọn vài cột
# Output:
# name | city
# -----+--------
# An   | Hà Nội
# Bình | TP.HCM
# Chi  | Đà Nẵng
# Dũng | Hà Nội

# WHERE: lọc hàng; ORDER BY ... DESC: sắp xếp giảm dần; AS: đặt tên cột kết quả
show(conn, """
    SELECT name, price, price * 110 / 100 AS price_with_vat   -- Số nguyên chia số nguyên → số nguyên
    FROM products
    WHERE category = 'Phụ kiện' AND price >= 300000
    ORDER BY price DESC
""")
# Output:
# name     | price  | price_with_vat
# ---------+--------+---------------
# Tai nghe | 800000 | 880000
# Bàn phím | 500000 | 550000

# IN, BETWEEN, LIKE (% = chuỗi bất kỳ), IS NULL, LIMIT
show(conn, "SELECT name FROM products WHERE category IN ('Máy tính', 'Màn hình')")
# Output:
# name
# --------
# Màn hình
# Laptop
show(conn, "SELECT id, order_date FROM orders WHERE order_date BETWEEN '2026-02-01' AND '2026-02-28'")
# Output:
# id | order_date
# ---+-----------
# 3  | 2026-02-03
# 4  | 2026-02-14
show(conn, "SELECT name FROM products WHERE name LIKE '%phím%'")
# Output:
# name
# --------
# Bàn phím
show(conn, "SELECT name FROM customers WHERE email IS NULL")    # KHÔNG viết "= NULL"
# Output:
# name
# ----
# Dũng
show(conn, "SELECT name, price FROM products ORDER BY price DESC LIMIT 2")   # Top 2 đắt nhất
# Output:
# name     | price
# ---------+---------
# Laptop   | 15000000
# Màn hình | 3000000
```

### Hàm tổng hợp và `GROUP BY`

`COUNT`, `SUM`, `AVG`, `MIN`, `MAX` gộp nhiều hàng thành một giá trị. `GROUP BY` chia hàng thành **nhóm** rồi tổng hợp **từng nhóm**. `HAVING` lọc **sau khi** đã nhóm (còn `WHERE` lọc **trước khi** nhóm).

> 🧠 **Ví dụ dễ hiểu**: `GROUP BY category` giống việc cô giáo bảo "các em **xếp thành hàng theo tổ**", rồi mỗi tổ trưởng **đếm sĩ số** tổ mình (`COUNT`). `HAVING COUNT(*) >= 2` là "chỉ giữ lại tổ có từ 2 người trở lên".

```python
from shop_db import create_sample_db, show

conn = create_sample_db()

show(conn, "SELECT COUNT(*) AS so_sp, MIN(price) AS re_nhat, MAX(price) AS dat_nhat, AVG(price) AS tb FROM products")
# Output:
# so_sp | re_nhat | dat_nhat | tb
# ------+---------+----------+----------
# 5     | 200000  | 15000000 | 3900000.0

show(conn, """
    SELECT category, COUNT(*) AS so_sp, SUM(price) AS tong_gia
    FROM products
    GROUP BY category
    HAVING COUNT(*) >= 1
    ORDER BY so_sp DESC, category
""")
# Output:
# category | so_sp | tong_gia
# ---------+-------+---------
# Phụ kiện | 3     | 1500000
# Màn hình | 1     | 3000000
# Máy tính | 1     | 15000000

# Số đơn theo tháng: strftime của SQLite cắt 'YYYY-MM' từ ngày
show(conn, """
    SELECT strftime('%Y-%m', order_date) AS thang, COUNT(*) AS so_don
    FROM orders
    GROUP BY thang
""")
# Output:
# thang   | so_don
# --------+-------
# 2026-01 | 2
# 2026-02 | 2
# 2026-03 | 2
```

### `JOIN` - Kết hợp nhiều bảng

Bảng `orders` chỉ chứa `customer_id = 1` - muốn biết **tên** khách phải **nối** sang bảng `customers`.

- **`INNER JOIN`** (viết tắt `JOIN`): chỉ giữ các hàng **khớp ở cả hai bảng**
- **`LEFT JOIN`**: giữ **mọi hàng bảng bên trái**, bên phải không khớp thì điền `NULL`

```python
from shop_db import create_sample_db, show

conn = create_sample_db()

show(conn, """
    SELECT o.id, c.name AS khach, p.name AS san_pham, o.quantity AS sl,
           o.quantity * p.price AS thanh_tien
    FROM orders AS o
    JOIN customers AS c ON c.id = o.customer_id
    JOIN products  AS p ON p.id = o.product_id
    WHERE c.city = 'Hà Nội'
    ORDER BY o.id
""")
# Output:
# id | khach | san_pham | sl | thanh_tien
# ---+-------+----------+----+-----------
# 1  | An    | Bàn phím | 2  | 1000000
# 2  | An    | Màn hình | 1  | 3000000
# 6  | An    | Chuột    | 1  | 200000

# LEFT JOIN + GROUP BY: tổng chi tiêu của MỌI khách, kể cả khách chưa mua (Dũng)
show(conn, """
    SELECT c.name, COUNT(o.id) AS so_don, COALESCE(SUM(o.quantity * p.price), 0) AS tong_chi
    FROM customers AS c
    LEFT JOIN orders   AS o ON o.customer_id = c.id
    LEFT JOIN products AS p ON p.id = o.product_id
    GROUP BY c.id
    ORDER BY tong_chi DESC
""")
# Output:
# name | so_don | tong_chi
# -----+--------+---------
# Chi  | 1      | 15000000
# An   | 3      | 4200000
# Bình | 2      | 2200000
# Dũng | 0      | 0
```

> 💡 `COALESCE(x, 0)` = "nếu x là NULL thì dùng 0". Đặt **bí danh** ngắn cho bảng (`orders AS o`) giúp câu SQL gọn và tránh nhầm cột trùng tên (`o.id` vs `c.id`).

### `UPDATE`, `DELETE` và ràng buộc

```python
import sqlite3

from shop_db import create_sample_db, show

conn = create_sample_db()

conn.execute("UPDATE products SET price = price * 0.9 WHERE category = 'Phụ kiện'")   # Giảm giá 10%
conn.execute("DELETE FROM customers WHERE id = 4")                                   # Xóa Dũng
conn.commit()
show(conn, "SELECT name, price FROM products WHERE category = 'Phụ kiện'")
# Output:
# name     | price
# ---------+-------
# Bàn phím | 450000
# Chuột    | 180000
# Tai nghe | 720000

# Ràng buộc bảo vệ dữ liệu - database TỪ CHỐI dữ liệu sai
bad_statements = [
    "UPDATE products SET price = -5 WHERE id = 1",                   # Vi phạm CHECK
    "INSERT INTO customers (name, email) VALUES ('Em', 'an@mail.com')",  # Trùng UNIQUE
    "INSERT INTO orders (customer_id, product_id, order_date) VALUES (99, 1, '2026-04-01')",  # Khách 99 không tồn tại
    "DELETE FROM customers WHERE id = 1",                            # An còn đơn hàng → không xóa được
]
for sql in bad_statements:
    try:
        conn.execute(sql)
    except sqlite3.IntegrityError as error:
        print("❌", error)
# Output:
# ❌ CHECK constraint failed: price > 0
# ❌ UNIQUE constraint failed: customers.email
# ❌ FOREIGN KEY constraint failed
# ❌ FOREIGN KEY constraint failed
```

> ⚠️ **`UPDATE`/`DELETE` mà quên `WHERE`** sẽ tác động lên **toàn bộ bảng**! Thói quen tốt: viết `SELECT ... WHERE ...` trước để xem sẽ ảnh hưởng những hàng nào, rồi mới đổi thành `UPDATE`/`DELETE`.
>
> ℹ️ Ở đây kết quả nhân `0.9` tròn số nên SQLite lưu lại thành số nguyên. Nhưng nếu giá là `199999`, kết quả `179999.1` sẽ được lưu thành **số thực** ngay trong cột `INTEGER` (SQLite khá "dễ dãi" về kiểu). Với **tiền**, nên lưu **số nguyên** (đồng) và làm tròn rõ ràng: `SET price = CAST(ROUND(price * 0.9) AS INTEGER)`. Không dùng `float` cho tiền (sai số làm tròn!).

### `INDEX` - Mục lục để tìm nhanh

Không có index, tìm `WHERE email = 'x'` phải **quét từng hàng** (như lật từng trang sách). Index giống **mục lục cuối sách** 📑: tra chữ cái → biết ngay số trang.

```python
import sqlite3

conn = sqlite3.connect(":memory:")
conn.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, city TEXT)")
conn.executemany("INSERT INTO users (email, city) VALUES (?, ?)",
                 [(f"user{i}@mail.com", f"city{i % 50}") for i in range(100_000)])


def plan(sql: str) -> str:
    """EXPLAIN QUERY PLAN: hỏi SQLite 'bạn định tìm bằng cách nào?'"""
    return conn.execute("EXPLAIN QUERY PLAN " + sql).fetchone()[-1]


query = "SELECT * FROM users WHERE email = 'user500@mail.com'"
print(plan(query))                  # SCAN = quét toàn bộ bảng
# Output: SCAN users

conn.execute("CREATE INDEX idx_users_email ON users(email)")
print(plan(query))                  # SEARCH ... USING INDEX = dùng mục lục
# Output: SEARCH users USING INDEX idx_users_email (email=?)
```

> 💡 **Nên tạo index cho**: cột hay dùng trong `WHERE`, `JOIN ... ON`, `ORDER BY` (email, khóa ngoại, ngày tạo). **Đừng index mọi thứ**: mỗi index làm `INSERT`/`UPDATE` chậm hơn và tốn dung lượng. Cột `PRIMARY KEY` và `UNIQUE` đã tự có index.

## 📖 3. `sqlite3` trong Python - chi tiết

### Kết nối, cursor, execute

```python
import sqlite3
from pathlib import Path

db_path = Path("notes.db")
db_path.unlink(missing_ok=True)                 # Xóa file cũ để ví dụ chạy lại được

conn = sqlite3.connect(db_path)                 # File chưa có → tự tạo
cur = conn.cursor()                             # Cursor: "con trỏ" thực thi lệnh và đọc kết quả
cur.execute("""
    CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        tag TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
""")

# Placeholder ? - LUÔN dùng cách này để truyền dữ liệu (lý do ở phần SQL Injection)
cur.execute("INSERT INTO notes (title, tag) VALUES (?, ?)", ("Học SQL", "study"))
print("id vừa tạo:", cur.lastrowid)

# Placeholder có tên :ten - dễ đọc khi nhiều tham số, truyền dict
cur.execute("INSERT INTO notes (title, tag) VALUES (:title, :tag)", {"title": "Đi chợ", "tag": "home"})

# executemany: chèn nhiều hàng một lần (nhanh hơn nhiều so với vòng lặp execute)
cur.executemany("INSERT INTO notes (title, tag) VALUES (?, ?)",
                [("Đọc sách", "study"), ("Tập gym", "health"), ("Ôn Python", "study")])
print("số hàng vừa chèn:", cur.rowcount)
conn.commit()                                   # ⚠️ Không commit → dữ liệu KHÔNG được lưu!

# Đọc kết quả: fetchone / fetchall / duyệt trực tiếp cursor
print(cur.execute("SELECT COUNT(*) FROM notes").fetchone())
print(cur.execute("SELECT id, title FROM notes WHERE tag = ?", ("study",)).fetchall())
for note_id, title in conn.execute("SELECT id, title FROM notes ORDER BY id DESC LIMIT 2"):
    print(f"  #{note_id} {title}")

cur = conn.execute("UPDATE notes SET tag = ? WHERE tag = ?", ("learning", "study"))
print("đã sửa:", cur.rowcount, "hàng")
conn.commit()
conn.close()
print("file tồn tại:", db_path.exists())
# Output:
# id vừa tạo: 1
# số hàng vừa chèn: 3
# (5,)
# [(1, 'Học SQL'), (3, 'Đọc sách'), (5, 'Ôn Python')]
#   #5 Ôn Python
#   #4 Tập gym
# đã sửa: 3 hàng
# file tồn tại: True
```

> ⚠️ Tham số phải là **tuple/list**: `("study",)` có dấu phẩy. Viết `("study")` chỉ là chuỗi trong ngoặc → lỗi `Incorrect number of bindings supplied`.

### `row_factory = sqlite3.Row` - truy cập cột theo tên

Mặc định mỗi hàng là tuple - `row[2]` là cột gì? Khó đọc và dễ sai khi thêm cột. `sqlite3.Row` cho phép truy cập **theo tên**:

```python
import sqlite3

conn = sqlite3.connect(":memory:")
conn.row_factory = sqlite3.Row                  # Đặt MỘT lần sau khi connect
conn.execute("CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, price INTEGER)")
conn.execute("INSERT INTO products (name, price) VALUES ('Bàn phím', 500000)")

row = conn.execute("SELECT * FROM products").fetchone()
print(row["name"], row["price"], row[0])        # Theo tên hoặc theo vị trí đều được
print(row.keys())
print(dict(row))                                # Chuyển thành dict (tiện trả về JSON)
# Output:
# Bàn phím 500000 1
# ['id', 'name', 'price']
# {'id': 1, 'name': 'Bàn phím', 'price': 500000}
```

### Transaction: commit, rollback và `with conn`

**Transaction** = một nhóm thao tác được thực hiện theo nguyên tắc **"tất cả hoặc không gì cả"**.

> 🧠 **Ví dụ dễ hiểu**: Chuyển khoản 1 triệu từ An sang Bình gồm 2 bước: **trừ tiền An**, **cộng tiền Bình**. Nếu mất điện sau bước 1 → 1 triệu **biến mất** 💸. Transaction đảm bảo: hoặc **cả hai bước** cùng thành công (`COMMIT`), hoặc có lỗi thì **hủy toàn bộ** như chưa từng xảy ra (`ROLLBACK`).

Trong `sqlite3`, dùng **`with conn:`** - tự `commit()` nếu khối lệnh chạy xong, tự `rollback()` nếu có exception:

```python
import sqlite3

conn = sqlite3.connect(":memory:")
conn.execute("""CREATE TABLE accounts (
    id INTEGER PRIMARY KEY, owner TEXT, balance INTEGER NOT NULL CHECK (balance >= 0))""")
conn.executemany("INSERT INTO accounts VALUES (?, ?, ?)", [(1, "An", 1_000_000), (2, "Bình", 500_000)])
conn.commit()


def transfer(from_id: int, to_id: int, amount: int, crash: bool = False) -> None:
    try:
        with conn:                                          # BẮT ĐẦU transaction
            conn.execute("UPDATE accounts SET balance = balance - ? WHERE id = ?", (amount, from_id))
            if crash:
                raise RuntimeError("💥 Mất điện giữa chừng!")
            conn.execute("UPDATE accounts SET balance = balance + ? WHERE id = ?", (amount, to_id))
        print(f"✅ Chuyển {amount:,}đ thành công")          # Tự COMMIT khi ra khỏi with
    except (sqlite3.IntegrityError, RuntimeError) as error:
        print(f"❌ Thất bại ({error}) → đã ROLLBACK")      # Tự ROLLBACK khi có exception


def balances() -> list[tuple]:
    return conn.execute("SELECT owner, balance FROM accounts").fetchall()


transfer(1, 2, 300_000)
print(balances())
transfer(1, 2, 5_000_000)                  # Không đủ tiền → vi phạm CHECK (balance >= 0)
print(balances())
transfer(1, 2, 100_000, crash=True)        # Lỗi SAU khi đã trừ tiền An
print(balances())                          # Tiền An KHÔNG bị trừ - rollback đã hủy bước 1
# Output:
# ✅ Chuyển 300,000đ thành công
# [('An', 700000), ('Bình', 800000)]
# ❌ Thất bại (CHECK constraint failed: balance >= 0) → đã ROLLBACK
# [('An', 700000), ('Bình', 800000)]
# ❌ Thất bại (💥 Mất điện giữa chừng!) → đã ROLLBACK
# [('An', 700000), ('Bình', 800000)]
```

> ⚠️ `with conn:` **chỉ quản lý transaction, KHÔNG đóng kết nối**. Muốn tự đóng, dùng `contextlib.closing`:
>
> ```text
> from contextlib import closing
> with closing(sqlite3.connect("shop.db")) as conn, conn:   # closing → đóng; conn → transaction
>     ...
> ```

### Ngày giờ trong SQLite

SQLite không có kiểu `DATE`/`DATETIME` riêng. Cách chuẩn: lưu **chuỗi ISO 8601** (`'2026-09-25'`, `'2026-09-25T14:30:00+00:00'`) - vừa đọc được, vừa **sắp xếp đúng** theo thứ tự chữ, vừa dùng được với hàm `date()`, `strftime()` của SQLite.

```python
import sqlite3
from datetime import date, datetime, timezone

conn = sqlite3.connect(":memory:")
conn.execute("CREATE TABLE events (name TEXT, day TEXT, created_at TEXT)")
now = datetime(2026, 9, 25, 7, 30, tzinfo=timezone.utc)
conn.execute("INSERT INTO events VALUES (?, ?, ?)", ("Họp", date(2026, 10, 1).isoformat(), now.isoformat()))

name, day, created = conn.execute("SELECT * FROM events").fetchone()
print(day, "→", date.fromisoformat(day) - date(2026, 9, 25))
print(datetime.fromisoformat(created))
print(conn.execute("SELECT date(day, '+7 days'), strftime('%m/%Y', day) FROM events").fetchone())
# Output:
# 2026-10-01 → 6 days, 0:00:00
# 2026-09-25 07:30:00+00:00
# ('2026-10-08', '10/2026')
```

## 📖 4. SQL Injection - Lỗ hổng kinh điển

### Chuyện gì xảy ra khi ghép chuỗi vào SQL?

```python
import sqlite3

conn = sqlite3.connect(":memory:")
conn.execute("CREATE TABLE users (username TEXT, password TEXT, role TEXT)")
conn.executemany("INSERT INTO users VALUES (?, ?, ?)",
                 [("admin", "S3cret!", "admin"), ("an", "123456", "user")])


def login_unsafe(username: str, password: str):
    # ❌❌❌ NGUY HIỂM: ghép dữ liệu người dùng vào SQL bằng f-string
    sql = f"SELECT username, role FROM users WHERE username = '{username}' AND password = '{password}'"
    print("   SQL:", sql)
    return conn.execute(sql).fetchone()


print(login_unsafe("an", "123456"))                 # Bình thường
print(login_unsafe("admin", "' OR '1'='1"))         # Hacker: không cần biết mật khẩu!
# Output:
#    SQL: SELECT username, role FROM users WHERE username = 'an' AND password = '123456'
# ('an', 'user')
#    SQL: SELECT username, role FROM users WHERE username = 'admin' AND password = '' OR '1'='1'
# ('admin', 'admin')
```

Mật khẩu `' OR '1'='1` **đóng dấu nháy** rồi chèn thêm điều kiện luôn đúng → hacker đăng nhập thành quyền **admin** 😱. Tệ hơn, với một số database, họ có thể chèn `; DROP TABLE users; --` để xóa cả bảng.

> 🧠 **Ví dụ dễ hiểu**: Bạn đưa cho nhân viên ngân hàng tờ giấy: "Rút tiền cho khách tên: `___`". Kẻ gian điền vào chỗ trống: "`Nam. Và chuyển toàn bộ tiền trong két cho Nam`". Nhân viên đọc cả câu như **một mệnh lệnh** → thảm họa. Placeholder `?` giống như ô điền tên có **viền cứng**: dù điền gì vào, nó **chỉ là một cái tên**, không bao giờ thành mệnh lệnh.

### Cách phòng tránh: LUÔN dùng placeholder

```python
import sqlite3

conn = sqlite3.connect(":memory:")
conn.execute("CREATE TABLE users (username TEXT, password TEXT, role TEXT)")
conn.execute("INSERT INTO users VALUES ('admin', 'S3cret!', 'admin')")


def login_safe(username: str, password: str):
    # ✅ Dữ liệu truyền RIÊNG qua tham số - database coi nó là GIÁ TRỊ, không bao giờ là lệnh SQL
    return conn.execute(
        "SELECT username, role FROM users WHERE username = ? AND password = ?",
        (username, password),
    ).fetchone()


print(login_safe("admin", "' OR '1'='1"))
print(login_safe("admin", "S3cret!"))
# Output:
# None
# ('admin', 'admin')

# Placeholder chỉ dùng cho GIÁ TRỊ. Tên cột/tên bảng (vd: sắp xếp theo cột người dùng chọn)
# thì phải kiểm tra bằng DANH SÁCH TRẮNG (whitelist)
ALLOWED_SORT = {"username", "role"}


def list_users(sort_by: str):
    if sort_by not in ALLOWED_SORT:
        raise ValueError(f"Không được sắp xếp theo: {sort_by!r}")
    return conn.execute(f"SELECT username FROM users ORDER BY {sort_by}").fetchall()


print(list_users("role"))
try:
    list_users("username; DROP TABLE users")
except ValueError as error:
    print(error)
# Output:
# [('admin',)]
# Không được sắp xếp theo: 'username; DROP TABLE users'
```

> ⚠️ Ví dụ lưu mật khẩu dạng chữ thường chỉ để minh họa injection. Thực tế **luôn băm mật khẩu** (`hashlib.pbkdf2_hmac` - Bài 11, hoặc `bcrypt`/`argon2`).

**Quy tắc sắt**: Không bao giờ dùng f-string, `%`, `.format()` hay `+` để đưa **dữ liệu** vào câu SQL. Không ngoại lệ - kể cả khi "dữ liệu này chắc chắn an toàn".

## 📖 5. Repository Pattern - Tách logic khỏi SQL

Nếu câu SQL rải rác khắp nơi (trong hàm xử lý đơn hàng, trong endpoint API, trong CLI...), khi đổi database hay đổi cấu trúc bảng bạn phải sửa **mọi chỗ**. **Repository** gom toàn bộ việc truy cập dữ liệu của một loại đối tượng vào **một class**, phần còn lại của app chỉ gọi method như `repo.get(5)`, `repo.add(product)`.

> 🧠 **Ví dụ dễ hiểu**: Repository giống **thủ kho** 📦. Nhân viên bán hàng chỉ nói "lấy cho tôi sản phẩm mã AO-001", không cần biết kho xếp theo kệ nào, dùng máy quét gì. Đổi kho (SQLite → PostgreSQL) chỉ cần đổi thủ kho, nhân viên bán hàng không phải học lại.

```python
import sqlite3
from dataclasses import dataclass
from typing import Protocol


@dataclass
class Product:
    name: str
    price: int
    stock: int = 0
    id: int | None = None


class ProductRepository(Protocol):          # "Hợp đồng": repo nào cũng phải có các method này
    def add(self, product: Product) -> Product: ...
    def get(self, product_id: int) -> Product | None: ...
    def list_in_stock(self) -> list[Product]: ...


class SqliteProductRepository:
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("""CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY, name TEXT NOT NULL,
            price INTEGER NOT NULL CHECK (price > 0), stock INTEGER NOT NULL DEFAULT 0)""")

    @staticmethod
    def _to_product(row: sqlite3.Row) -> Product:
        return Product(id=row["id"], name=row["name"], price=row["price"], stock=row["stock"])

    def add(self, product: Product) -> Product:
        with self.conn:
            cur = self.conn.execute("INSERT INTO products (name, price, stock) VALUES (?, ?, ?)",
                                    (product.name, product.price, product.stock))
        product.id = cur.lastrowid
        return product

    def get(self, product_id: int) -> Product | None:
        row = self.conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
        return self._to_product(row) if row else None

    def list_in_stock(self) -> list[Product]:
        rows = self.conn.execute("SELECT * FROM products WHERE stock > 0 ORDER BY name")
        return [self._to_product(r) for r in rows]


class InMemoryProductRepository:            # Dùng cho test: nhanh, không cần database
    def __init__(self):
        self._items: dict[int, Product] = {}

    def add(self, product: Product) -> Product:
        product.id = len(self._items) + 1
        self._items[product.id] = product
        return product

    def get(self, product_id: int) -> Product | None:
        return self._items.get(product_id)

    def list_in_stock(self) -> list[Product]:
        return sorted((p for p in self._items.values() if p.stock > 0), key=lambda p: p.name)


# Logic nghiệp vụ chỉ biết đến "hợp đồng" ProductRepository, không biết SQL
def inventory_value(repo: ProductRepository) -> int:
    return sum(p.price * p.stock for p in repo.list_in_stock())


for repo in [SqliteProductRepository(sqlite3.connect(":memory:")), InMemoryProductRepository()]:
    repo.add(Product("Chuột", 200_000, stock=10))
    repo.add(Product("Bàn phím", 500_000, stock=4))
    repo.add(Product("Webcam", 900_000))                   # Hết hàng
    print(f"{type(repo).__name__:<27} {[p.name for p in repo.list_in_stock()]} {inventory_value(repo):,}đ")
# Output:
# SqliteProductRepository     ['Bàn phím', 'Chuột'] 4,000,000đ
# InMemoryProductRepository   ['Bàn phím', 'Chuột'] 4,000,000đ
```

## 📖 6. SQLAlchemy 2.0 - ORM

### ORM là gì? Tại sao dùng?

Viết SQL bằng tay và chuyển qua lại giữa `tuple`/`Row` và object Python khá tốn công. **ORM (Object-Relational Mapping)** cho phép làm việc với database bằng **class và object Python**: mỗi class ↔ một bảng, mỗi object ↔ một hàng, mỗi attribute ↔ một cột.

> 🧠 **Ví dụ dễ hiểu**: ORM là **phiên dịch viên** 🧑‍💼 giữa bạn (nói Python) và database (nói SQL). Bạn nói `session.get(Book, 5)`, phiên dịch viên nói với database `SELECT ... FROM books WHERE id = 5` và dịch câu trả lời thành object `Book`.

**SQLAlchemy** là ORM phổ biến nhất của Python. Ưu điểm: code gọn, có type hints, **tự chống SQL injection**, **đổi database** (SQLite → PostgreSQL) chỉ cần đổi chuỗi kết nối. Nhược điểm: thêm một lớp phải học; câu truy vấn phức tạp đôi khi SQL thuần dễ hơn (SQLAlchemy vẫn cho phép viết SQL thuần khi cần).

### Cài đặt (trong venv)

```bash
python -m pip install sqlalchemy
```

### Định nghĩa model

```python
from datetime import datetime

from sqlalchemy import CheckConstraint, String, create_engine, func, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column


class Base(DeclarativeBase):          # Lớp cha chung cho mọi model
    pass


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (CheckConstraint("price > 0", name="ck_price_positive"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))                     # NOT NULL (vì không có | None)
    sku: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    price: Mapped[int]                                                  # Kiểu suy ra từ type hint
    stock: Mapped[int] = mapped_column(default=0)
    description: Mapped[str | None]                                     # | None → cho phép NULL
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    def __repr__(self) -> str:
        return f"Product(id={self.id}, sku={self.sku!r}, price={self.price})"


# Engine: "cổng kết nối" tới database. echo=True sẽ in mọi câu SQL (rất hữu ích khi học)
engine = create_engine("sqlite:///:memory:", echo=False)
Base.metadata.create_all(engine)          # Tạo các bảng chưa tồn tại

# Session: "phiên làm việc" - theo dõi các object, gom thay đổi, commit một lần
with Session(engine) as session:
    session.add(Product(name="Bàn phím cơ", sku="KB-001", price=1_200_000, stock=5))
    session.add_all([
        Product(name="Chuột không dây", sku="MS-001", price=350_000, stock=20),
        Product(name="Màn hình 27 inch", sku="MN-027", price=4_500_000),
    ])
    session.commit()                      # Ghi xuống database (một transaction)

    # select(): xây câu truy vấn bằng Python
    stmt = select(Product).where(Product.price < 2_000_000).order_by(Product.price)
    print(stmt)                           # Xem câu SQL được sinh ra
    for p in session.scalars(stmt):       # scalars(): lấy object Product (thay vì tuple)
        print("  ", p)

    kb = session.scalar(select(Product).where(Product.sku == "KB-001"))   # Một kết quả
    kb.price = 990_000                    # Sửa object như bình thường...
    session.commit()                      # ...ORM tự sinh UPDATE

    print(session.get(Product, 1))        # Lấy theo khóa chính
    print(session.scalar(select(func.count()).select_from(Product)),
          session.scalar(select(func.sum(Product.price * Product.stock))))

    session.delete(session.get(Product, 3))
    session.commit()
    print(session.scalars(select(Product.sku)).all())
# Output:
# SELECT products.id, products.name, products.sku, products.price, products.stock, products.description, products.created_at
# FROM products
# WHERE products.price < :price_1 ORDER BY products.price
#    Product(id=2, sku='MS-001', price=350000)
#    Product(id=1, sku='KB-001', price=1200000)
# Product(id=1, sku='KB-001', price=990000)
# 3 11950000
# ['KB-001', 'MS-001']
```

Để ý: câu SQL sinh ra dùng **tham số** `:price_1` chứ không ghép giá trị - ORM tự bảo vệ bạn khỏi SQL injection.

| Việc cần làm | SQLAlchemy 2.0 |
| --- | --- |
| Lấy theo khóa chính | `session.get(Product, 5)` |
| Lấy danh sách object | `session.scalars(select(Product).where(...)).all()` |
| Lấy một object (hoặc `None`) | `session.scalar(select(Product).where(...))` |
| Lọc nhiều điều kiện | `.where(Product.price > 100, Product.stock > 0)` (AND) / `or_(...)` |
| Tìm gần đúng | `.where(Product.name.ilike("%phím%"))` |
| Sắp xếp, phân trang | `.order_by(Product.price.desc()).offset(20).limit(10)` |
| Thêm / xóa | `session.add(obj)` / `session.delete(obj)` rồi `session.commit()` |
| Hủy thay đổi | `session.rollback()` |

> ℹ️ Tutorial cũ trên mạng hay dùng kiểu SQLAlchemy 1.x: `session.query(Product).filter(...)`, `Column(Integer)`, `declarative_base()`. Kiểu **2.0** (`select()`, `Mapped`, `mapped_column`, `DeclarativeBase`) là chuẩn hiện tại, có type hints tốt hơn - hãy dùng kiểu mới.

### Quan hệ một-nhiều với `relationship`

Một tác giả viết **nhiều** sách; mỗi sách thuộc về **một** tác giả. Phía "nhiều" (`Book`) giữ **khóa ngoại** `author_id`; `relationship` giúp đi qua lại giữa hai object mà không cần tự viết JOIN.

```python
from sqlalchemy import ForeignKey, create_engine, func, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, selectinload


class Base(DeclarativeBase):
    pass


class Author(Base):
    __tablename__ = "authors"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    # Một tác giả → nhiều sách. cascade: xóa tác giả thì xóa luôn sách của họ
    books: Mapped[list["Book"]] = relationship(back_populates="author", cascade="all, delete-orphan")


class Book(Base):
    __tablename__ = "books"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str]
    year: Mapped[int]
    author_id: Mapped[int] = mapped_column(ForeignKey("authors.id"))    # Khóa ngoại
    author: Mapped["Author"] = relationship(back_populates="books")     # Đi ngược về tác giả


engine = create_engine("sqlite://")        # "sqlite://" = trong RAM
Base.metadata.create_all(engine)

with Session(engine) as session:
    to_hoai = Author(name="Tô Hoài")
    to_hoai.books.append(Book(title="Dế Mèn phiêu lưu ký", year=1941))   # Thêm qua list như bình thường
    to_hoai.books.append(Book(title="Vợ chồng A Phủ", year=1952))
    nna = Author(name="Nguyễn Nhật Ánh", books=[
        Book(title="Mắt biếc", year=1990),
        Book(title="Tôi thấy hoa vàng trên cỏ xanh", year=2010),
        Book(title="Cho tôi xin một vé đi tuổi thơ", year=2008),
    ])
    session.add_all([to_hoai, nna])        # Sách được lưu theo tác giả (cascade)
    session.commit()

    book = session.scalar(select(Book).where(Book.title == "Mắt biếc"))
    print(book.title, "-", book.author.name)                 # Book → Author

    # selectinload: tải sẵn books cho TẤT CẢ tác giả bằng 1 truy vấn (tránh lỗi N+1)
    for author in session.scalars(select(Author).options(selectinload(Author.books))):
        titles = sorted(b.title for b in author.books)
        print(f"{author.name}: {len(titles)} sách → {titles[0]}, ...")

    # JOIN + GROUP BY bằng ORM: số sách và năm xuất bản gần nhất của từng tác giả
    stmt = (select(Author.name, func.count(Book.id), func.max(Book.year))
            .join(Author.books).group_by(Author.id).order_by(Author.name))
    print(session.execute(stmt).all())

    # Sách sau năm 2000, kèm tên tác giả (JOIN)
    stmt = select(Book.title, Author.name).join(Book.author).where(Book.year > 2000).order_by(Book.year)
    print(session.execute(stmt).all())

    session.delete(to_hoai)                # Cascade: sách của Tô Hoài bị xóa theo
    session.commit()
    print(session.scalar(select(func.count(Book.id))))
# Output:
# Mắt biếc - Nguyễn Nhật Ánh
# Tô Hoài: 2 sách → Dế Mèn phiêu lưu ký, ...
# Nguyễn Nhật Ánh: 3 sách → Cho tôi xin một vé đi tuổi thơ, ...
# [('Nguyễn Nhật Ánh', 3, 2010), ('Tô Hoài', 2, 1952)]
# [('Cho tôi xin một vé đi tuổi thơ', 'Nguyễn Nhật Ánh'), ('Tôi thấy hoa vàng trên cỏ xanh', 'Nguyễn Nhật Ánh')]
# 3
```

> ⚠️ **Lỗi N+1 query**: Nếu không có `selectinload`, vòng lặp `for author in authors: author.books` sẽ chạy **1 truy vấn lấy tác giả + N truy vấn lấy sách** (mỗi tác giả một lần). Với 1000 tác giả → 1001 truy vấn, cực chậm. Bật `echo=True` để phát hiện, và dùng `selectinload`/`joinedload` để tải trước.

## 📖 7. Migrations với Alembic

### Vấn đề

`Base.metadata.create_all()` chỉ **tạo bảng chưa có**, không **sửa** bảng đã có. App đã chạy thật 6 tháng, có 1 triệu đơn hàng, giờ cần thêm cột `products.discount` - không thể xóa database tạo lại!

**Migration** = các file script ghi lại **từng bước thay đổi cấu trúc** database theo thời gian (giống **git cho cấu trúc database**). Mỗi máy (dev, test, production) chạy lần lượt các migration để có cùng cấu trúc, và có thể **quay lui** khi cần.

**Alembic** là công cụ migration đi kèm SQLAlchemy (cùng tác giả):

```bash
python -m pip install alembic
alembic init migrations                 # Tạo thư mục migrations/ và file alembic.ini
# Sửa alembic.ini: sqlalchemy.url = sqlite:///shop.db
# Sửa migrations/env.py: from models import Base; target_metadata = Base.metadata

alembic revision --autogenerate -m "tao bang products"   # So sánh model với DB → sinh script
alembic upgrade head                    # Áp dụng mọi migration chưa chạy

# ... thêm field discount vào model Product ...
alembic revision --autogenerate -m "them cot discount"
alembic upgrade head
alembic downgrade -1                    # Quay lui 1 bước nếu có vấn đề
alembic history                         # Xem lịch sử migration
```

File migration được sinh ra trông như sau (bạn **nên đọc lại** trước khi chạy, autogenerate không phải lúc nào cũng đoán đúng, ví dụ đổi tên cột):

```text
# migrations/versions/3f2a1b_them_cot_discount.py
revision = "3f2a1b"
down_revision = "a1b2c3"          # Migration liền trước → tạo thành chuỗi

def upgrade() -> None:
    op.add_column("products", sa.Column("discount", sa.Integer(), nullable=False, server_default="0"))

def downgrade() -> None:
    op.drop_column("products", "discount")
```

> 💡 Quy tắc: **commit file migration vào git** cùng với code thay đổi model. Không bao giờ sửa tay cấu trúc database production - mọi thay đổi đều đi qua migration.

## 📖 8. Khi nào dùng PostgreSQL?

| Tiêu chí | SQLite | PostgreSQL |
| --- | --- | --- |
| Cài đặt | Không cần, là một file | Cài server (hoặc Docker, dịch vụ cloud) |
| Ghi đồng thời | Một tiến trình ghi tại một thời điểm | Nhiều kết nối ghi song song |
| Nhiều server app dùng chung | ❌ (file nằm trên một máy) | ✅ Qua mạng |
| Kiểu dữ liệu, tính năng | Cơ bản | Phong phú: JSONB, full-text search, array, `TIMESTAMPTZ`... |
| Phân quyền người dùng | ❌ | ✅ |
| Phù hợp | Học, test, app nhỏ, app desktop/mobile, tool | Web/API production, nhiều người dùng |

**Chuyển sang PostgreSQL** khi: web app có nhiều người **ghi** đồng thời, chạy nhiều instance server, cần tính năng nâng cao. Nhờ SQLAlchemy, code gần như **không đổi** - chỉ đổi chuỗi kết nối:

```bash
# Chạy PostgreSQL bằng Docker (cách nhanh nhất để thử trên máy)
docker run -d --name shop-db -e POSTGRES_PASSWORD=matkhau -p 5432:5432 postgres:16

python -m pip install "psycopg[binary]"         # Driver PostgreSQL cho Python
```

```text
import os
from sqlalchemy import create_engine

# Đọc từ biến môi trường (Bài 11) - KHÔNG viết cứng mật khẩu
# Ví dụ: DATABASE_URL=postgresql+psycopg://postgres:matkhau@localhost:5432/postgres
engine = create_engine(os.environ.get("DATABASE_URL", "sqlite:///shop.db"))
```

> 💡 Nên dùng **cùng loại database** ở máy dev và production (ví dụ cả hai đều PostgreSQL qua Docker) để tránh lỗi "máy tôi chạy được mà server lỗi" do khác biệt nhỏ giữa SQLite và PostgreSQL.

## 📖 9. Tích hợp với FastAPI (tiếp nối Bài 12)

Mẫu chuẩn: một **engine** dùng chung cả app, mỗi request một **Session** qua dependency dạng `yield` (mở khi request đến, đóng khi xong). Pydantic model đọc được object ORM nhờ `from_attributes=True`.

```python
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.testclient import TestClient
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import String, create_engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker
from sqlalchemy.pool import StaticPool

# ---------- database.py ----------
# Thực tế: create_engine("sqlite:///shop.db", connect_args={"check_same_thread": False})
# Ở đây dùng DB trong RAM + StaticPool để mọi luồng dùng chung một kết nối (tiện cho demo/test)
engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
SessionLocal = sessionmaker(engine)


class Base(DeclarativeBase):
    pass


def get_session():
    with SessionLocal() as session:        # Mở session cho request...
        yield session                      # ...đóng tự động khi request xong


SessionDep = Annotated[Session, Depends(get_session)]


# ---------- models.py ----------
class Product(Base):
    __tablename__ = "products"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    sku: Mapped[str] = mapped_column(String(20), unique=True)
    price: Mapped[int]
    stock: Mapped[int] = mapped_column(default=0)


# ---------- schemas.py ----------
class ProductCreate(BaseModel):
    name: str = Field(min_length=2)
    sku: str = Field(pattern=r"^[A-Z]{2,5}-\d{3,6}$")
    price: int = Field(gt=0)
    stock: int = Field(default=0, ge=0)


class ProductOut(ProductCreate):
    model_config = ConfigDict(from_attributes=True)   # Cho phép tạo từ object ORM (product.name...)
    id: int


# ---------- main.py ----------
app = FastAPI()
Base.metadata.create_all(engine)       # Thực tế: dùng Alembic thay cho dòng này


@app.post("/products", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(data: ProductCreate, session: SessionDep):
    product = Product(**data.model_dump())
    session.add(product)
    try:
        session.commit()
    except IntegrityError:                 # Để DATABASE kiểm tra trùng SKU - an toàn kể cả khi 2 request cùng lúc
        session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, f"SKU {data.sku} đã tồn tại")
    session.refresh(product)               # Nạp lại giá trị do DB sinh (id...)
    return product


@app.get("/products", response_model=list[ProductOut])
def list_products(session: SessionDep, max_price: int | None = None):
    stmt = select(Product).order_by(Product.id)
    if max_price is not None:
        stmt = stmt.where(Product.price <= max_price)
    return session.scalars(stmt).all()


@app.get("/products/{product_id}", response_model=ProductOut)
def get_product(product_id: int, session: SessionDep):
    product = session.get(Product, product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy sản phẩm")
    return product


client = TestClient(app)
print(client.post("/products", json={"name": "Bàn phím", "sku": "KB-001", "price": 500000, "stock": 3}).json())
print(client.post("/products", json={"name": "Chuột", "sku": "MS-001", "price": 200000}).status_code)
print(client.post("/products", json={"name": "Trùng", "sku": "KB-001", "price": 1}).json())
print([p["sku"] for p in client.get("/products", params={"max_price": 300000}).json()])
print(client.get("/products/99").status_code)
# Output:
# {'name': 'Bàn phím', 'sku': 'KB-001', 'price': 500000, 'stock': 3, 'id': 1}
# 201
# {'detail': 'SKU KB-001 đã tồn tại'}
# ['MS-001']
# 404
```

> 💡 So với `InMemoryProductRepo` ở Bài 12: endpoint gần như giữ nguyên, chỉ thay nơi lưu trữ. Khi test, dùng `app.dependency_overrides[get_session]` để trỏ sang một database test riêng.

### 💡 Tips quan trọng

- **Luôn dùng placeholder** (`?`, `:ten`) hoặc ORM - **không bao giờ** f-string dữ liệu vào SQL ✅
- Bật `PRAGMA foreign_keys = ON` mỗi lần kết nối SQLite ✅
- Nhiều thao tác phải cùng thành công → gói trong **một transaction** (`with conn:` / `session.commit()`) ✅
- Để **database** kiểm tra ràng buộc (`UNIQUE`, `CHECK`, `FOREIGN KEY`) thay vì chỉ kiểm tra bằng Python - database là "tuyến phòng thủ cuối cùng" ✅
- Tiền lưu bằng **số nguyên** (đồng), ngày giờ lưu **ISO 8601 / UTC** ✅
- Index các cột hay tìm kiếm, hay JOIN ✅
- Thay đổi cấu trúc bảng → dùng **migration** (Alembic), không sửa tay ✅

## 🌍 Ứng dụng thực tế

### Ứng dụng 1: Quản lý kho hàng + đơn hàng với transaction

Đặt hàng gồm nhiều bước: kiểm tra và **trừ tồn kho** từng sản phẩm, tạo **đơn hàng**, tạo **chi tiết đơn**. Nếu sản phẩm thứ 3 hết hàng, hai sản phẩm đầu **không được bị trừ** kho. Hủy đơn phải **hoàn lại** tồn kho. Tất cả dùng transaction.

```python
"""inventory.py - Kho hàng + đơn hàng với sqlite3 và transaction."""

import sqlite3
from datetime import datetime, timezone

SCHEMA = """
CREATE TABLE IF NOT EXISTS products (
    id    INTEGER PRIMARY KEY,
    sku   TEXT NOT NULL UNIQUE,
    name  TEXT NOT NULL,
    price INTEGER NOT NULL CHECK (price > 0),
    stock INTEGER NOT NULL CHECK (stock >= 0)          -- Tồn kho không bao giờ âm
);
CREATE TABLE IF NOT EXISTS orders (
    id         INTEGER PRIMARY KEY,
    customer   TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
    total      INTEGER NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS order_items (
    order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity   INTEGER NOT NULL CHECK (quantity > 0),
    unit_price INTEGER NOT NULL,                        -- Lưu giá LÚC MUA (giá sản phẩm có thể đổi sau)
    PRIMARY KEY (order_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_items_product ON order_items(product_id);
"""


class OutOfStockError(Exception):
    pass


class OrderError(Exception):
    pass


def connect(path: str = ":memory:") -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(SCHEMA)
    return conn


def place_order(conn: sqlite3.Connection, customer: str, items: dict[str, int]) -> int:
    """Đặt hàng: items = {sku: số lượng}. Trả về id đơn. Lỗi → không thay đổi gì."""
    with conn:                                           # MỘT transaction cho toàn bộ đơn
        total = 0
        lines = []
        for sku, qty in items.items():
            product = conn.execute("SELECT id, name, price FROM products WHERE sku = ?", (sku,)).fetchone()
            if product is None:
                raise OrderError(f"Không có sản phẩm {sku}")
            # Trừ kho CÓ ĐIỀU KIỆN: chỉ trừ khi đủ hàng → an toàn kể cả khi nhiều người mua cùng lúc
            cur = conn.execute(
                "UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?",
                (qty, product["id"], qty),
            )
            if cur.rowcount == 0:
                raise OutOfStockError(f"'{product['name']}' không đủ hàng (cần {qty})")
            total += product["price"] * qty
            lines.append((product["id"], qty, product["price"]))

        cur = conn.execute(
            "INSERT INTO orders (customer, total, created_at) VALUES (?, ?, ?)",
            (customer, total, datetime.now(timezone.utc).isoformat()),
        )
        order_id = cur.lastrowid
        conn.executemany(
            "INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)",
            [(order_id, pid, qty, price) for pid, qty, price in lines],
        )
    return order_id


def cancel_order(conn: sqlite3.Connection, order_id: int) -> None:
    with conn:
        order = conn.execute("SELECT status FROM orders WHERE id = ?", (order_id,)).fetchone()
        if order is None or order["status"] == "cancelled":
            raise OrderError(f"Không hủy được đơn {order_id}")
        # Hoàn kho bằng MỘT câu UPDATE dùng subquery
        conn.execute("""
            UPDATE products
            SET stock = stock + (SELECT quantity FROM order_items
                                 WHERE order_id = ? AND product_id = products.id)
            WHERE id IN (SELECT product_id FROM order_items WHERE order_id = ?)
        """, (order_id, order_id))
        conn.execute("UPDATE orders SET status = 'cancelled' WHERE id = ?", (order_id,))


def print_stock(conn: sqlite3.Connection, title: str) -> None:
    stock = ", ".join(f"{r['sku']}={r['stock']}" for r in conn.execute("SELECT sku, stock FROM products"))
    print(f"📦 {title:<22} {stock}")


conn = connect()
with conn:
    conn.executemany("INSERT INTO products (sku, name, price, stock) VALUES (?, ?, ?, ?)", [
        ("AO-001", "Áo thun", 150_000, 10),
        ("QU-001", "Quần jean", 450_000, 5),
        ("MU-001", "Mũ lưỡi trai", 90_000, 1),
    ])
print_stock(conn, "Ban đầu")

order1 = place_order(conn, "An", {"AO-001": 2, "QU-001": 1})
print(f"✅ Đơn #{order1} của An")
print_stock(conn, "Sau đơn của An")

for customer, items in [("Bình", {"AO-001": 3, "MU-001": 2}), ("Chi", {"XX-999": 1})]:
    try:
        place_order(conn, customer, items)
    except (OutOfStockError, OrderError) as error:
        print(f"❌ {customer}: {error}")
print_stock(conn, "Sau đơn lỗi (không đổi)")

cancel_order(conn, order1)
print_stock(conn, "Sau khi hủy đơn An")

print("Đơn hàng:", [(r["id"], r["customer"], r["status"], r["total"])
                    for r in conn.execute("SELECT * FROM orders")])
print("Chi tiết:", [tuple(r) for r in conn.execute(
    "SELECT p.sku, i.quantity, i.unit_price FROM order_items i JOIN products p ON p.id = i.product_id")])
# Output:
# 📦 Ban đầu                AO-001=10, QU-001=5, MU-001=1
# ✅ Đơn #1 của An
# 📦 Sau đơn của An         AO-001=8, QU-001=4, MU-001=1
# ❌ Bình: 'Mũ lưỡi trai' không đủ hàng (cần 2)
# ❌ Chi: Không có sản phẩm XX-999
# 📦 Sau đơn lỗi (không đổi) AO-001=8, QU-001=4, MU-001=1
# 📦 Sau khi hủy đơn An     AO-001=10, QU-001=5, MU-001=1
# Đơn hàng: [(1, 'An', 'cancelled', 750000)]
# Chi tiết: [('AO-001', 2, 150000), ('QU-001', 1, 450000)]
```

> 💡 Để ý đơn của Bình: áo thun (sản phẩm đầu) **đã bị trừ 3** trong transaction, nhưng khi mũ hết hàng → exception → **rollback**, áo thun trở lại 8. Kỹ thuật `UPDATE ... WHERE stock >= ?` rồi kiểm tra `rowcount` giúp **không bao giờ bán quá số hàng có** - kể cả khi hai khách bấm "Mua" cùng một lúc.

### Ứng dụng 2: Báo cáo doanh thu theo tháng bằng SQL

Chủ shop cần báo cáo: doanh thu từng tháng, số đơn, giá trị đơn trung bình, **tăng trưởng so với tháng trước**, và **top sản phẩm**. Tất cả tính bằng SQL - database làm việc nặng, Python chỉ trình bày.

```python
"""revenue_report.py - Báo cáo doanh thu theo tháng."""

import sqlite3

conn = sqlite3.connect(":memory:")
conn.executescript("""
CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, category TEXT);
CREATE TABLE orders (id INTEGER PRIMARY KEY, created_at TEXT, status TEXT);
CREATE TABLE order_items (order_id INTEGER, product_id INTEGER, quantity INTEGER, unit_price INTEGER);
CREATE INDEX idx_orders_created ON orders(created_at);
""")
conn.executemany("INSERT INTO products VALUES (?, ?, ?)", [
    (1, "Áo thun", "Thời trang"), (2, "Quần jean", "Thời trang"),
    (3, "Tai nghe", "Điện tử"), (4, "Sạc dự phòng", "Điện tử"), (5, "Sổ tay", "Văn phòng phẩm"),
])

# Sinh dữ liệu mẫu có quy luật (thay cho dữ liệu thật): 6 tháng đầu năm 2026
order_id = 0
for month in range(1, 7):
    for n in range(3 + month):                       # Tháng sau nhiều đơn hơn tháng trước
        order_id += 1
        status = "cancelled" if n == 0 else "paid"   # Mỗi tháng có 1 đơn bị hủy
        conn.execute("INSERT INTO orders VALUES (?, ?, ?)",
                     (order_id, f"2026-{month:02d}-{n + 1:02d}T10:00:00", status))
        product_id = n % 5 + 1
        price = [150_000, 450_000, 800_000, 350_000, 30_000][product_id - 1]
        conn.execute("INSERT INTO order_items VALUES (?, ?, ?, ?)",
                     (order_id, product_id, 1 + n % 3, price))
        if month in (3, 6):                          # Tháng 3, 6 có khuyến mãi: mua kèm sổ tay
            conn.execute("INSERT INTO order_items VALUES (?, 5, 2, 30000)", (order_id,))

MONTHLY_SQL = """
WITH monthly AS (                                    -- CTE: bảng tạm đặt tên cho dễ đọc
    SELECT strftime('%Y-%m', o.created_at)           AS month,
           COUNT(DISTINCT o.id)                       AS orders,
           SUM(i.quantity * i.unit_price)             AS revenue
    FROM orders AS o
    JOIN order_items AS i ON i.order_id = o.id
    WHERE o.status = 'paid' AND o.created_at >= :start AND o.created_at < :end
    GROUP BY month
)
SELECT month, orders, revenue,
       revenue / orders                               AS avg_order,
       LAG(revenue) OVER (ORDER BY month)             AS prev_revenue   -- Window function: giá trị hàng trước
FROM monthly
ORDER BY month
"""

TOP_PRODUCTS_SQL = """
SELECT p.name, p.category, SUM(i.quantity) AS sold, SUM(i.quantity * i.unit_price) AS revenue
FROM order_items AS i
JOIN orders   AS o ON o.id = i.order_id
JOIN products AS p ON p.id = i.product_id
WHERE o.status = 'paid'
GROUP BY p.id
HAVING SUM(i.quantity) >= :min_sold
ORDER BY revenue DESC
LIMIT :limit
"""

params = {"start": "2026-01-01", "end": "2026-07-01"}
rows = conn.execute(MONTHLY_SQL, params).fetchall()
max_revenue = max(r[2] for r in rows)

print("📊 DOANH THU 6 THÁNG ĐẦU NĂM 2026 (chỉ đơn đã thanh toán)")
print(f"{'Tháng':<8} {'Đơn':>4} {'Doanh thu':>12} {'TB/đơn':>10} {'Tăng trưởng':>12}")
for month, orders, revenue, avg_order, prev in rows:
    growth = "—" if prev is None else f"{(revenue - prev) / prev:+.1%}"
    bar = "█" * round(revenue / max_revenue * 20)
    print(f"{month:<8} {orders:>4} {revenue:>12,} {avg_order:>10,} {growth:>12}  {bar}")
total = sum(r[2] for r in rows)
print(f"{'Tổng':<8} {sum(r[1] for r in rows):>4} {total:>12,}")

print("\n🏆 TOP 3 SẢN PHẨM (bán ≥ 5 cái)")
for rank, (name, category, sold, revenue) in enumerate(
        conn.execute(TOP_PRODUCTS_SQL, {"min_sold": 5, "limit": 3}), start=1):
    print(f"{rank}. {name:<14} {category:<15} {sold:>3} cái {revenue:>12,}đ  ({revenue / total:.0%})")
# Output:
# 📊 DOANH THU 6 THÁNG ĐẦU NĂM 2026 (chỉ đơn đã thanh toán)
# Tháng     Đơn    Doanh thu     TB/đơn  Tăng trưởng
# 2026-01     3    3,650,000  1,216,666            —  █████████
# 2026-02     4    3,710,000    927,500        +1.6%  ██████████
# 2026-03     5    4,460,000    892,000       +20.2%  ████████████
# 2026-04     6    4,610,000    768,333        +3.4%  ████████████
# 2026-05     7    6,210,000    887,142       +34.7%  ████████████████
# 2026-06     8    7,740,000    967,500       +24.6%  ████████████████████
# Tổng       33   30,380,000
#
# 🏆 TOP 3 SẢN PHẨM (bán ≥ 5 cái)
# 1. Tai nghe       Điện tử          22 cái   17,600,000đ  (58%)
# 2. Quần jean      Thời trang       15 cái    6,750,000đ  (22%)
# 3. Sạc dự phòng   Điện tử           9 cái    3,150,000đ  (10%)
```

> 💡 **Tại sao tính trong SQL thay vì kéo hết dữ liệu về Python rồi dùng vòng lặp?** Với 10 triệu đơn hàng, `GROUP BY` trong database (có index trên `created_at`) chỉ trả về **6 hàng** kết quả; còn kéo 10 triệu hàng qua mạng về Python sẽ chậm và tốn RAM khủng khiếp. Nguyên tắc: **lọc và tổng hợp ở database, trình bày ở Python**.
>
> ℹ️ Điều kiện `created_at >= :start AND created_at < :end` (thay vì `strftime(...) = '2026-03'`) giúp database **dùng được index** trên `created_at`.

### Ứng dụng 3: Thư viện sách với SQLAlchemy (tác giả - sách - phiếu mượn)

Hệ thống quản lý thư viện nhỏ: tác giả có nhiều sách, sách có nhiều lượt mượn. Nghiệp vụ: tìm sách, mượn (chỉ khi còn bản), trả, thống kê tác giả được mượn nhiều nhất, danh sách mượn quá hạn.

```python
"""library.py - Quản lý thư viện với SQLAlchemy 2.0."""

from datetime import date, timedelta

from sqlalchemy import CheckConstraint, ForeignKey, String, create_engine, func, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship

LOAN_DAYS = 14


class Base(DeclarativeBase):
    pass


class Author(Base):
    __tablename__ = "authors"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    books: Mapped[list["Book"]] = relationship(back_populates="author", cascade="all, delete-orphan",
                                               order_by="Book.year")


class Book(Base):
    __tablename__ = "books"
    __table_args__ = (CheckConstraint("available >= 0 AND available <= copies"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200), index=True)
    year: Mapped[int]
    copies: Mapped[int] = mapped_column(default=1)
    available: Mapped[int] = mapped_column(default=1)
    author_id: Mapped[int] = mapped_column(ForeignKey("authors.id"), index=True)
    author: Mapped[Author] = relationship(back_populates="books")
    loans: Mapped[list["Loan"]] = relationship(back_populates="book")

    def __repr__(self) -> str:
        return f"«{self.title}» ({self.year})"


class Loan(Base):
    __tablename__ = "loans"
    id: Mapped[int] = mapped_column(primary_key=True)
    borrower: Mapped[str]
    borrowed_on: Mapped[date]
    due_on: Mapped[date]
    returned_on: Mapped[date | None]
    book_id: Mapped[int] = mapped_column(ForeignKey("books.id"), index=True)
    book: Mapped[Book] = relationship(back_populates="loans")


class LibraryError(Exception):
    pass


class Library:
    """Tầng service: gom nghiệp vụ, mỗi method là một transaction."""

    def __init__(self, session: Session):
        self.session = session

    def add_book(self, title: str, year: int, author_name: str, copies: int = 1) -> Book:
        author = self.session.scalar(select(Author).where(Author.name == author_name))
        if author is None:
            author = Author(name=author_name)          # Chưa có tác giả → tạo mới
        book = Book(title=title, year=year, copies=copies, available=copies, author=author)
        self.session.add(book)
        self.session.commit()
        return book

    def search(self, keyword: str) -> list[Book]:
        stmt = select(Book).where(Book.title.ilike(f"%{keyword}%")).order_by(Book.title)
        return list(self.session.scalars(stmt))       # ilike + tham số → vẫn an toàn injection

    def borrow(self, book_id: int, borrower: str, today: date) -> Loan:
        book = self.session.get(Book, book_id)
        if book is None:
            raise LibraryError(f"Không có sách #{book_id}")
        if book.available == 0:
            raise LibraryError(f"{book} đã được mượn hết")
        book.available -= 1
        loan = Loan(book=book, borrower=borrower, borrowed_on=today, due_on=today + timedelta(days=LOAN_DAYS))
        self.session.add(loan)
        self.session.commit()                          # Trừ số bản + tạo phiếu: cùng một transaction
        return loan

    def return_book(self, loan_id: int, today: date) -> int:
        """Trả sách, trả về số ngày trễ hạn."""
        loan = self.session.get(Loan, loan_id)
        if loan is None or loan.returned_on is not None:
            raise LibraryError(f"Phiếu mượn #{loan_id} không hợp lệ")
        loan.returned_on = today
        loan.book.available += 1
        self.session.commit()
        return max(0, (today - loan.due_on).days)

    def overdue(self, today: date) -> list[Loan]:
        stmt = (select(Loan).where(Loan.returned_on.is_(None), Loan.due_on < today)
                .order_by(Loan.due_on))
        return list(self.session.scalars(stmt))

    def author_stats(self) -> list[tuple[str, int, int]]:
        """(tên tác giả, số đầu sách, tổng lượt mượn) - sắp theo lượt mượn."""
        stmt = (
            select(Author.name, func.count(func.distinct(Book.id)), func.count(Loan.id))
            .join(Author.books)
            .outerjoin(Book.loans)                     # LEFT JOIN: sách chưa ai mượn vẫn được tính
            .group_by(Author.id)
            .order_by(func.count(Loan.id).desc(), Author.name)
        )
        return [tuple(row) for row in self.session.execute(stmt)]


engine = create_engine("sqlite://")
Base.metadata.create_all(engine)

with Session(engine) as session:
    lib = Library(session)
    for title, year, author, copies in [
        ("Dế Mèn phiêu lưu ký", 1941, "Tô Hoài", 2),
        ("Mắt biếc", 1990, "Nguyễn Nhật Ánh", 1),
        ("Cho tôi xin một vé đi tuổi thơ", 2008, "Nguyễn Nhật Ánh", 2),
        ("Số đỏ", 1936, "Vũ Trọng Phụng", 1),
        ("Tắt đèn", 1937, "Ngô Tất Tố", 1),
    ]:
        lib.add_book(title, year, author, copies)

    nna = session.scalar(select(Author).where(Author.name == "Nguyễn Nhật Ánh"))
    print("📚", nna.name, "→", nna.books)
    print("🔍 Tìm 'tôi':", lib.search("tôi"))

    start = date(2026, 9, 1)
    loan1 = lib.borrow(2, "An", start)                                   # Mắt biếc
    loan2 = lib.borrow(1, "Bình", start + timedelta(days=3))              # Dế Mèn
    loan3 = lib.borrow(3, "Chi", start + timedelta(days=10))
    lib.borrow(3, "Dũng", start + timedelta(days=12))
    print(f"📖 An mượn {loan1.book}, hạn trả {loan1.due_on:%d/%m/%Y}")
    try:
        lib.borrow(2, "Em", start + timedelta(days=5))                   # Mắt biếc chỉ có 1 bản
    except LibraryError as error:
        print("❌", error)

    today = date(2026, 9, 25)
    print(f"⏰ Quá hạn tại {today:%d/%m}:",
          [(l.borrower, l.book.title, (today - l.due_on).days) for l in lib.overdue(today)])
    print("↩️  An trả sách, trễ", lib.return_book(loan1.id, today), "ngày")
    print("↩️  Chi trả sách, trễ", lib.return_book(loan3.id, today), "ngày")
    print("📊 Thống kê tác giả:", lib.author_stats())
    print("📦 Còn trên kệ:", [(b.title, b.available) for b in session.scalars(select(Book).order_by(Book.id))])
# Output:
# 📚 Nguyễn Nhật Ánh → [«Mắt biếc» (1990), «Cho tôi xin một vé đi tuổi thơ» (2008)]
# 🔍 Tìm 'tôi': [«Cho tôi xin một vé đi tuổi thơ» (2008)]
# 📖 An mượn «Mắt biếc» (1990), hạn trả 15/09/2026
# ❌ «Mắt biếc» (1990) đã được mượn hết
# ⏰ Quá hạn tại 25/09: [('An', 'Mắt biếc', 10), ('Bình', 'Dế Mèn phiêu lưu ký', 7)]
# ↩️  An trả sách, trễ 10 ngày
# ↩️  Chi trả sách, trễ 0 ngày
# 📊 Thống kê tác giả: [('Nguyễn Nhật Ánh', 2, 3), ('Tô Hoài', 1, 1), ('Ngô Tất Tố', 1, 0), ('Vũ Trọng Phụng', 1, 0)]
# 📦 Còn trên kệ: [('Dế Mèn phiêu lưu ký', 1), ('Mắt biếc', 1), ('Cho tôi xin một vé đi tuổi thơ', 1), ('Số đỏ', 1), ('Tắt đèn', 1)]
```

> ℹ️ `ilike` (không phân biệt hoa/thường) với chữ tiếng Việt có dấu: SQLite chỉ không phân biệt hoa/thường cho chữ **ASCII** (`a`/`A`), còn `Ô`/`ô` vẫn bị coi là khác nhau. PostgreSQL xử lý đúng Unicode. Đây là một ví dụ về khác biệt nhỏ giữa các database.

## ⚠️ Lỗi thường gặp

### 1. Quên `commit()` - dữ liệu "biến mất"

`INSERT` chạy không báo lỗi, nhưng mở lại database thì trống trơn. ✅ Gọi `conn.commit()` hoặc dùng `with conn:`; với SQLAlchemy là `session.commit()`.

### 2. Ghép chuỗi vào SQL (SQL Injection)

❌ `f"SELECT * FROM users WHERE name = '{name}'"` - ✅ `("SELECT * FROM users WHERE name = ?", (name,))`. Tên cột/bảng động → whitelist.

### 3. Tham số một phần tử thiếu dấu phẩy

```python
import sqlite3

conn = sqlite3.connect(":memory:")
conn.execute("CREATE TABLE t (name TEXT)")
try:
    conn.execute("SELECT * FROM t WHERE name = ?", ("An"))    # ❌ ("An") là chuỗi, không phải tuple
except sqlite3.ProgrammingError as error:
    print(error)
print(conn.execute("SELECT * FROM t WHERE name = ?", ("An",)).fetchall())   # ✅ Có dấu phẩy
# Output:
# Incorrect number of bindings supplied. The current statement uses 1, and there are 2 supplied.
# []
```

### 4. Khóa ngoại không có tác dụng trong SQLite

SQLite **mặc định tắt** kiểm tra khóa ngoại. ✅ Chạy `PRAGMA foreign_keys = ON` ngay sau mỗi lần `connect`.

### 5. So sánh với NULL bằng `=`

`WHERE email = NULL` **luôn không khớp gì** (NULL nghĩa là "không biết", không bằng cái gì kể cả NULL). ✅ `WHERE email IS NULL` / `IS NOT NULL`. Trong SQLAlchemy: `Model.email.is_(None)`.

### 6. `UPDATE`/`DELETE` quên `WHERE`

Xóa sạch cả bảng. ✅ Chạy thử `SELECT` với cùng điều kiện trước; làm việc với database thật thì luôn có **backup**.

### 7. `sqlite3.OperationalError: database is locked`

Một kết nối khác đang giữ transaction ghi quá lâu (hoặc quên commit/đóng kết nối). ✅ Giữ transaction **ngắn**, luôn đóng kết nối; `sqlite3.connect(path, timeout=10)` để chờ lâu hơn; ghi đồng thời nhiều → cân nhắc PostgreSQL.

### 8. Lỗi N+1 query với ORM

Truy cập `author.books` trong vòng lặp → mỗi vòng một truy vấn. ✅ `selectinload()`, và bật `echo=True` khi phát triển để thấy số truy vấn.

### 9. `DetachedInstanceError` - dùng object sau khi session đã đóng

```text
with Session(engine) as session:
    author = session.get(Author, 1)
print(author.books)      # ❌ Session đã đóng, không tải thêm được quan hệ
```

✅ Truy cập dữ liệu cần thiết **bên trong** session, hoặc tải trước bằng `selectinload`, hoặc chuyển sang Pydantic model/dict trước khi ra khỏi session.

### 10. Lưu tiền bằng `float`

`0.1 + 0.2 = 0.30000000000000004`. ✅ Lưu số nguyên (đồng) hoặc kiểu `NUMERIC`/`Decimal` với database hỗ trợ.

## 🏋️ Bài tập

### Bài tập 1 (Dễ): Truy vấn SQL

Với database mẫu `shop_db.py`, viết câu SQL:

1. Danh sách khách ở Hà Nội, sắp xếp theo tên
2. Sản phẩm có giá từ 300.000 đến 5.000.000
3. Tổng số lượng đã bán của từng sản phẩm (kể cả sản phẩm chưa bán được, hiển thị 0)
4. Khách hàng nào mua nhiều **loại** sản phẩm khác nhau nhất?

### Bài tập 2 (Dễ): Todo với SQLite

Viết lại phần lưu trữ của Todo CLI (Bài 10) bằng `sqlite3`: class `SqliteStorage` có `add`, `list`, `complete`, `delete`, dùng placeholder và `sqlite3.Row`.

### Bài tập 3 (Trung bình): Sổ chi tiêu

Bảng `expenses(id, amount, category, spent_on, note)`. Viết CLI (argparse - Bài 11) với lệnh:

- `add 45000 an-uong "Phở bò" --date 2026-09-25`
- `report --month 2026-09` → tổng theo danh mục, % mỗi danh mục, ngày chi nhiều nhất
- `export --month 2026-09 -o chi-tieu.csv`

### Bài tập 4 (Trung bình): Chuyển Ứng dụng 1 sang SQLAlchemy

Viết lại "kho hàng + đơn hàng" bằng SQLAlchemy ORM: model `Product`, `Order`, `OrderItem` (quan hệ một-nhiều Order → OrderItem), hàm `place_order` đảm bảo rollback khi thiếu hàng. Viết test pytest dùng database `sqlite://` trong RAM.

### Bài tập 5 (Khó): Product API với database

Thay `InMemoryProductRepo` trong Ứng dụng 2 của Bài 12 bằng SQLAlchemy (giữ nguyên toàn bộ endpoint và test). Thêm bảng `categories` (một danh mục - nhiều sản phẩm), endpoint `GET /categories/{id}/products`, và dùng Alembic tạo migration thêm cột `discount_percent`.

<details>
<summary>💡 Xem đáp án Bài tập 1</summary>

```python
from shop_db import create_sample_db, show

conn = create_sample_db()
show(conn, "SELECT name FROM customers WHERE city = 'Hà Nội' ORDER BY name")
show(conn, "SELECT name, price FROM products WHERE price BETWEEN 300000 AND 5000000")
show(conn, """
    SELECT p.name, COALESCE(SUM(o.quantity), 0) AS da_ban
    FROM products AS p LEFT JOIN orders AS o ON o.product_id = p.id
    GROUP BY p.id ORDER BY da_ban DESC, p.name
""")
show(conn, """
    SELECT c.name, COUNT(DISTINCT o.product_id) AS so_loai
    FROM customers AS c JOIN orders AS o ON o.customer_id = c.id
    GROUP BY c.id ORDER BY so_loai DESC LIMIT 1
""")
# Output:
# name
# ----
# An
# Dũng
# name     | price
# ---------+--------
# Bàn phím | 500000
# Màn hình | 3000000
# Tai nghe | 800000
# name     | da_ban
# ---------+-------
# Chuột    | 4
# Bàn phím | 2
# Tai nghe | 2
# Laptop   | 1
# Màn hình | 1
# name | so_loai
# -----+--------
# An   | 3
```

</details>

## ✅ Checklist hoàn thành

- [ ] Giải thích được bảng, hàng, cột, khóa chính, khóa ngoại
- [ ] Viết được `CREATE TABLE` có `NOT NULL`, `UNIQUE`, `CHECK`, `DEFAULT`, `REFERENCES`
- [ ] Viết `SELECT` với `WHERE`, `ORDER BY`, `LIMIT`, `GROUP BY`, `HAVING`
- [ ] Phân biệt `INNER JOIN` và `LEFT JOIN`
- [ ] Biết khi nào cần `INDEX` và kiểm tra bằng `EXPLAIN QUERY PLAN`
- [ ] Dùng `sqlite3`: placeholder `?`/`:ten`, `executemany`, `sqlite3.Row`, `lastrowid`, `rowcount`
- [ ] Dùng transaction với `with conn:` và hiểu rollback
- [ ] Giải thích và phòng tránh được SQL Injection
- [ ] Tổ chức code bằng Repository pattern
- [ ] Định nghĩa model SQLAlchemy 2.0 với `Mapped`, `mapped_column`, `relationship`
- [ ] Truy vấn bằng `select()`, `session.scalars`, `session.get`, join, group by
- [ ] Hiểu migration và các lệnh Alembic cơ bản
- [ ] Biết khi nào chuyển sang PostgreSQL
- [ ] Nối SQLAlchemy vào FastAPI bằng dependency `yield`
- [ ] Chạy thành công 3 ứng dụng thực tế

## 🚀 Tiếp theo

Ứng dụng của bạn giờ đã lưu dữ liệu bền vững và phục vụ được qua API. Khi số lượng người dùng tăng, câu hỏi tiếp theo là: làm sao xử lý **nhiều việc cùng lúc** - gọi 100 API song song, xử lý hàng nghìn file bằng nhiều nhân CPU? Bài tiếp theo sẽ đi sâu vào **đồng thời và song song** trong Python.

**Bài tiếp theo**: [Concurrency & Parallelism](./14-concurrency-parallelism.md)

---

💡 **Tips nhớ lâu**:

- **Dữ liệu người dùng → luôn qua placeholder**, không bao giờ ghép chuỗi
- **Nhiều bước phải cùng thành công → một transaction**
- **Database là tuyến phòng thủ cuối**: `NOT NULL`, `UNIQUE`, `CHECK`, `FOREIGN KEY`
- **Lọc và tổng hợp ở database, trình bày ở Python**
- **Index cột hay tìm kiếm**, nhưng đừng index mọi thứ
- **ORM giúp code gọn, nhưng hãy hiểu SQL nó sinh ra** (`echo=True`)
- **Thay đổi cấu trúc bảng → migration**, không sửa tay
