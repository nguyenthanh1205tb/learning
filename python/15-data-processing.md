# 📚 Bài 15: Xử lý dữ liệu & Tự động hóa

## 🎯 Mục tiêu bài học

- Xử lý file **CSV/JSON rất lớn** theo kiểu **stream** bằng generator - không nạp hết vào RAM
- Làm quen **pandas** từ cơ bản: `Series`, `DataFrame`, `read_csv`, lọc, `groupby`, `merge`, `pivot_table`, dữ liệu thiếu, ngày giờ, xuất CSV/Excel
- Vẽ biểu đồ cơ bản với **matplotlib** và lưu ra file ảnh
- Đọc/ghi và **định dạng file Excel** với **openpyxl**
- **Web scraping** với `requests` + **BeautifulSoup** - và làm điều đó một cách **có đạo đức** (robots.txt)
- Soạn và **gửi email báo cáo** tự động với `smtplib`
- **Lên lịch** chạy script: cron (Linux/macOS), Task Scheduler (Windows), thư viện `schedule`
- Kết hợp tất cả thành các **công cụ tự động hóa** thực tế: báo cáo doanh số, làm sạch dữ liệu khách hàng, so sánh giá, báo cáo hàng ngày

> 💡 Đây là bài "kiếm cơm" nhất khóa học: rất nhiều công việc văn phòng lặp đi lặp lại (gộp file Excel, làm báo cáo tuần, copy số liệu từ web...) có thể tự động hóa chỉ với vài chục dòng Python. Bài này dùng kiến thức về file/CSV/JSON ([Bài 7](./07-exceptions-files.md)), generator ([Bài 9](./09-advanced-python.md)), logging ([Bài 11](./11-stdlib-practical.md)) và HTTP ([Bài 12](./12-http-web-apis.md)).

### Cài đặt thư viện cho bài này

```bash
# Kích hoạt venv trước (xem Bài 1)
source .venv/bin/activate          # Windows: .venv\Scripts\activate

pip install pandas openpyxl matplotlib requests beautifulsoup4 schedule
python -c "import pandas, openpyxl, matplotlib, bs4, schedule; print('OK', pandas.__version__)"
# Output (ví dụ): OK 3.0.6
```

| Thư viện | Dùng để |
| --- | --- |
| `pandas` | Phân tích dữ liệu dạng bảng - "Excel trong Python" |
| `openpyxl` | Đọc/ghi file `.xlsx`, định dạng ô, công thức (pandas cũng dùng nó để ghi Excel) |
| `matplotlib` | Vẽ biểu đồ |
| `requests` | Gửi HTTP request (tải trang web) |
| `beautifulsoup4` | Phân tích (parse) HTML để lấy dữ liệu |
| `schedule` | Lên lịch chạy hàm trong Python với cú pháp dễ đọc |

> ⚠️ Ví dụ trong bài dùng **pandas 3.x**. Nếu bạn dùng pandas 2.x, kết quả gần như giống hệt, chỉ khác: cột chuỗi hiển thị kiểu `object` thay vì `str`.

## 📖 1. Xử lý CSV/JSON lớn theo stream

### Vấn đề: file lớn hơn RAM

Giả sử bạn nhận file `sales.csv` 5GB (50 triệu dòng) và máy chỉ có 8GB RAM. Nếu viết `rows = list(csv.DictReader(f))`, Python sẽ cố tạo 50 triệu dict trong bộ nhớ → tốn **gấp nhiều lần** 5GB → máy treo hoặc `MemoryError`.

> 🧠 **Ví dụ dễ hiểu**: Muốn đếm số xe đi qua một cây cầu trong ngày, bạn **đứng ở đầu cầu và đếm từng chiếc** khi nó đi qua. Bạn **không cần** gom tất cả xe vào một bãi đỗ khổng lồ rồi mới đếm! Stream = xử lý **từng dòng một** khi nó "đi qua", rồi quên nó đi.

Tin tốt: `open()` và `csv.reader`/`csv.DictReader` **vốn đã là iterator** - chúng đọc từng dòng khi bạn yêu cầu. Chỉ cần **đừng biến chúng thành list**.

### Pipeline generator xử lý CSV lớn

```python
import csv
import random
import tracemalloc
from collections import defaultdict
from pathlib import Path

# --- Tạo file mẫu 200.000 dòng (giả lập file lớn) ---
path = Path("sales_big.csv")
rng = random.Random(42)
with path.open("w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["order_id", "region", "amount"])
    for i in range(200_000):
        region = rng.choice(["Bắc", "Trung", "Nam"])
        amount = rng.randint(50, 5000) * 1000 if i % 1000 else "N/A"   # Vài dòng lỗi
        writer.writerow([i, region, amount])


# --- Các "công đoạn" của pipeline, mỗi công đoạn là một generator ---
def read_rows(p: Path):
    with p.open(newline="", encoding="utf-8") as f:
        yield from csv.DictReader(f)                # Mỗi lần chỉ giữ 1 dòng trong RAM


def parse_amount(rows):
    for row in rows:
        try:
            row["amount"] = int(row["amount"])
        except ValueError:
            continue                                # Bỏ qua dòng lỗi
        yield row


def total_by_region(rows) -> dict[str, int]:
    totals: dict[str, int] = defaultdict(int)
    for row in rows:
        totals[row["region"]] += row["amount"]
    return dict(totals)


tracemalloc.start()
totals = total_by_region(parse_amount(read_rows(path)))
_, peak_stream = tracemalloc.get_traced_memory()
tracemalloc.stop()

tracemalloc.start()
with path.open(newline="", encoding="utf-8") as f:
    all_rows = list(csv.DictReader(f))              # ❌ Nạp hết vào RAM
_, peak_list = tracemalloc.get_traced_memory()
tracemalloc.stop()

for region, total in sorted(totals.items()):
    print(f"{region:<6} {total:>18,}đ")
print(f"RAM đỉnh - stream: {peak_stream / 1024:,.0f} KB | list: {peak_list / 1024:,.0f} KB")
# Output (ví dụ):
# Bắc       168,637,568,000đ
# Nam       168,451,222,000đ
# Trung     167,449,669,000đ
# RAM đỉnh - stream: 68 KB | list: 71,194 KB
```

Cách stream dùng RAM **gần như không đổi** dù file 200 nghìn hay 200 triệu dòng. Cách list tăng **tỷ lệ thuận** với kích thước file.

### JSON Lines (.jsonl) - JSON cho dữ liệu lớn

File JSON thông thường là **một** object/array khổng lồ - phải đọc hết mới parse được. Định dạng **JSON Lines** (mỗi dòng là một JSON độc lập) được dùng rất nhiều cho log và dữ liệu lớn vì có thể **stream** từng dòng và **ghi nối thêm** (append) dễ dàng.

```python
import json
from pathlib import Path

path = Path("events.jsonl")

# Ghi: mỗi dòng một object JSON
events = [
    {"user": "an", "action": "login", "ms": 120},
    {"user": "binh", "action": "buy", "ms": 340, "amount": 250000},
    {"user": "an", "action": "buy", "ms": 280, "amount": 99000},
    {"user": "chi", "action": "login", "ms": 95},
]
with path.open("w", encoding="utf-8") as f:
    for event in events:
        f.write(json.dumps(event, ensure_ascii=False) + "\n")


def read_jsonl(p: Path):
    """Generator đọc từng dòng JSON - RAM không phụ thuộc kích thước file."""
    with p.open(encoding="utf-8") as f:
        for line_no, line in enumerate(f, start=1):
            if line.strip():
                try:
                    yield json.loads(line)
                except json.JSONDecodeError:
                    print(f"⚠️ Dòng {line_no} không phải JSON hợp lệ, bỏ qua")


revenue = sum(e.get("amount", 0) for e in read_jsonl(path) if e["action"] == "buy")
print(f"Doanh thu: {revenue:,}đ")
print(path.read_text(encoding="utf-8").splitlines()[1])
# Output:
# Doanh thu: 349,000đ
# {"user": "binh", "action": "buy", "ms": 340, "amount": 250000}
```

> 💡 Với file JSON **một khối** khổng lồ (vài GB), dùng thư viện `ijson` để parse theo stream. Với CSV lớn mà muốn dùng pandas, dùng `pd.read_csv(..., chunksize=100_000)` (mục 2).

## 📖 2. pandas - "Excel trong Python"

### Tại sao cần pandas?

Với module `csv`, để tính "doanh thu trung bình theo khu vực theo tháng" bạn phải tự viết vòng lặp, dict lồng dict, xử lý ô trống... Với pandas, đó là **một dòng**. pandas cung cấp cấu trúc dữ liệu dạng bảng (**DataFrame**) cùng hàng trăm thao tác được viết bằng C/NumPy nên **rất nhanh**.

> 🧠 **Ví dụ dễ hiểu**: `DataFrame` = **một sheet Excel**: có hàng, cột, tên cột. `Series` = **một cột** trong sheet đó. Những gì bạn làm trong Excel (lọc, sắp xếp, SUMIF, PivotTable, VLOOKUP) đều có trong pandas - nhưng tự động, lặp lại được và xử lý được hàng triệu dòng.

| Excel | pandas |
| --- | --- |
| Sheet | `DataFrame` |
| Cột | `Series` (`df["cột"]`) |
| Filter | `df[df["cột"] > 10]` |
| Sort | `df.sort_values("cột")` |
| SUMIF / COUNTIF | `df.groupby("cột")["giá trị"].sum()` |
| VLOOKUP | `pd.merge(df1, df2, on="khóa")` |
| PivotTable | `pd.pivot_table(...)` |

### Series - Một cột dữ liệu có nhãn

```python
import pandas as pd

prices = pd.Series([25_000, 18_000, 32_000], index=["phở", "bánh mì", "bún chả"], name="giá")
print(prices)
# Output:
# phở        25000
# bánh mì    18000
# bún chả    32000
# Name: giá, dtype: int64

print(prices["phở"])                # Truy cập theo nhãn (index)
print(prices.iloc[0])               # Truy cập theo vị trí
# Output:
# 25000
# 25000

# Phép toán "vector hóa": áp dụng cho CẢ cột, không cần vòng lặp
print((prices * 1.1).round(-3).tolist())      # Tăng giá 10%, làm tròn nghìn
print(prices[prices > 20_000].index.tolist()) # Lọc
print(prices.mean(), prices.max(), prices.idxmax())
# Output:
# [28000.0, 20000.0, 35000.0]
# ['phở', 'bún chả']
# 25000.0 32000 bún chả
```

### DataFrame - Bảng dữ liệu

```python
import pandas as pd

df = pd.DataFrame({
    "ten": ["An", "Bình", "Chi", "Dũng", "Em"],
    "phong_ban": ["IT", "Sales", "IT", "HR", "Sales"],
    "luong": [25_000_000, 18_000_000, 30_000_000, 15_000_000, 22_000_000],
    "nam_kn": [3, 5, 7, 2, 4],
})

print(df)
# Output:
#     ten phong_ban     luong  nam_kn
# 0    An        IT  25000000       3
# 1  Bình     Sales  18000000       5
# 2   Chi        IT  30000000       7
# 3  Dũng        HR  15000000       2
# 4    Em     Sales  22000000       4

print(df.shape)                 # (số hàng, số cột)
print(df.columns.tolist())
print(df.dtypes)
# Output:
# (5, 4)
# ['ten', 'phong_ban', 'luong', 'nam_kn']
# ten            str
# phong_ban      str
# luong        int64
# nam_kn       int64
# dtype: object
```

Các cách "nhìn" nhanh một DataFrame mới - hãy tập thói quen chạy chúng **đầu tiên** mỗi khi nhận dữ liệu lạ:

```python
import pandas as pd

df = pd.DataFrame({
    "ten": ["An", "Bình", "Chi", "Dũng", "Em"],
    "luong": [25_000_000, 18_000_000, 30_000_000, 15_000_000, 22_000_000],
    "nam_kn": [3, 5, 7, 2, None],
})
print(df.head(2))               # 2 dòng đầu (tail() = cuối)
# Output:
#     ten     luong  nam_kn
# 0    An  25000000     3.0
# 1  Bình  18000000     5.0
df.info()                       # Kiểu dữ liệu, số ô không trống, RAM
# Output:
# <class 'pandas.DataFrame'>
# RangeIndex: 5 entries, 0 to 4
# Data columns (total 3 columns):
#  #   Column  Non-Null Count  Dtype
# ---  ------  --------------  -----
#  0   ten     5 non-null      str
#  1   luong   5 non-null      int64
#  2   nam_kn  4 non-null      float64
# dtypes: float64(1), int64(1), str(1)
# memory usage: 252.0 bytes
print(df.describe().round(1))   # Thống kê: count, mean, std, min, max, phân vị
# Output:
#             luong  nam_kn
# count         5.0     4.0
# mean   22000000.0     4.2
# std     5873670.1     2.2
# min    15000000.0     2.0
# 25%    18000000.0     2.8
# 50%    22000000.0     4.0
# 75%    25000000.0     5.5
# max    30000000.0     7.0
```

### Chọn dữ liệu: cột, hàng, loc, iloc

```python
import pandas as pd

df = pd.DataFrame({
    "ten": ["An", "Bình", "Chi", "Dũng"],
    "phong_ban": ["IT", "Sales", "IT", "HR"],
    "luong": [25, 18, 30, 15],
}, index=["NV01", "NV02", "NV03", "NV04"])

print(df["ten"].tolist())                 # Một cột → Series
print(df[["ten", "luong"]].shape)         # Nhiều cột → DataFrame (chú ý 2 lớp ngoặc)
# Output:
# ['An', 'Bình', 'Chi', 'Dũng']
# (4, 2)

# loc: theo NHÃN (tên hàng, tên cột) - lát cắt BAO GỒM điểm cuối
print(df.loc["NV02", "ten"])
print(df.loc["NV01":"NV03", ["ten", "luong"]])
# Output:
# Bình
#        ten  luong
# NV01    An     25
# NV02  Bình     18
# NV03   Chi     30

# iloc: theo VỊ TRÍ số (như list) - lát cắt KHÔNG gồm điểm cuối
print(df.iloc[0, 0], df.iloc[-1]["ten"])
# Output: An Dũng
```

### Lọc dữ liệu (Filter)

```python
import pandas as pd

df = pd.DataFrame({
    "ten": ["An", "Bình", "Chi", "Dũng", "Em"],
    "phong_ban": ["IT", "Sales", "IT", "HR", "Sales"],
    "luong": [25, 18, 30, 15, 22],
})

mask = df["luong"] > 20                  # Series True/False
print(mask.tolist())
# Output: [True, False, True, False, True]

print(df[mask]["ten"].tolist())           # Chỉ giữ hàng True
# Nhiều điều kiện: dùng & (và), | (hoặc), ~ (phủ định), BẮT BUỘC có ngoặc tròn
print(df[(df["phong_ban"] == "IT") & (df["luong"] >= 30)]["ten"].tolist())
print(df[df["phong_ban"].isin(["HR", "Sales"])]["ten"].tolist())
print(df[df["luong"].between(18, 25)]["ten"].tolist())
print(df[df["ten"].str.startswith("B")]["ten"].tolist())
# query(): viết điều kiện như chuỗi - dễ đọc với điều kiện dài
print(df.query("phong_ban == 'Sales' and luong > 20")["ten"].tolist())
# Output:
# ['An', 'Chi', 'Em']
# ['Chi']
# ['Bình', 'Dũng', 'Em']
# ['An', 'Bình', 'Em']
# ['Bình']
# ['Em']
```

> ⚠️ Không dùng `and`/`or` với Series (`df[df.a > 1 and df.b < 2]` → `ValueError: The truth value of a Series is ambiguous`). Luôn dùng `&`, `|` và **bọc từng điều kiện trong ngoặc**.

### Thêm cột, sắp xếp, đổi tên

```python
import pandas as pd

df = pd.DataFrame({
    "san_pham": ["Áo", "Quần", "Giày", "Mũ"],
    "don_gia": [150_000, 300_000, 800_000, 90_000],
    "so_luong": [4, 3, 2, 20],
})

df["thanh_tien"] = df["don_gia"] * df["so_luong"]              # Vector hóa: nhanh
df["loai"] = df["thanh_tien"].apply(lambda x: "Lớn" if x >= 1_500_000 else "Nhỏ")
df = df.rename(columns={"san_pham": "sản phẩm"})
print(df.sort_values("thanh_tien", ascending=False).to_string(index=False))
# Output:
# sản phẩm  don_gia  so_luong  thanh_tien loai
#       Mũ    90000        20     1800000  Lớn
#     Giày   800000         2     1600000  Lớn
#     Quần   300000         3      900000  Nhỏ
#       Áo   150000         4      600000  Nhỏ
```

> 💡 **Vector hóa trước, `apply` sau, vòng lặp `for` / `iterrows()` là phương án cuối cùng.** Phép toán trên cả cột chạy trong C, nhanh hơn vòng lặp Python hàng chục đến hàng trăm lần. Với điều kiện đơn giản, dùng `numpy.where` hoặc `pd.cut` thay cho `apply`.

### Đọc CSV với read_csv

`pd.read_csv` có rất nhiều tham số hữu ích cho dữ liệu "thực tế" (Việt Nam hay dùng dấu `;`, số có dấu chấm ngăn cách hàng nghìn...):

```python
import io

import pandas as pd

# io.StringIO giả lập một file - thực tế bạn truyền đường dẫn: pd.read_csv("orders.csv", ...)
raw = """ma_don;ngay;khach_hang;tong_tien
D001;05/01/2025;Nguyễn Văn An;1.250.000
D002;17/01/2025;Trần Thị Bình;980.000
D003;02/02/2025;Lê Chi;2.100.000
"""
df = pd.read_csv(
    io.StringIO(raw),
    sep=";",                  # Dấu phân cách cột
    thousands=".",            # "1.250.000" → 1250000
    parse_dates=["ngay"],     # Chuyển cột ngày sang kiểu datetime
    dayfirst=True,            # 05/01 là ngày 5 tháng 1 (kiểu Việt Nam), không phải 1/5
)
print(df)
print(df.dtypes)
# Output:
#   ma_don       ngay     khach_hang  tong_tien
# 0   D001 2025-01-05  Nguyễn Văn An    1250000
# 1   D002 2025-01-17  Trần Thị Bình     980000
# 2   D003 2025-02-02         Lê Chi    2100000
# ma_don                   str
# ngay          datetime64[us]
# khach_hang               str
# tong_tien              int64
# dtype: object
```

Các tham số hay dùng khác: `encoding="utf-8-sig"` (file từ Excel có BOM), `usecols=[...]` (chỉ đọc vài cột → nhanh, ít RAM), `dtype={"ma_kh": str}` (giữ số 0 đầu như `"0123"`), `na_values=["N/A", "-"]` (coi là ô trống), `chunksize=100_000` (đọc từng phần với file lớn).

### groupby - Nhóm và tổng hợp

`groupby` là thao tác **quan trọng nhất** trong phân tích dữ liệu. Nó làm 3 bước: **tách** (split) dữ liệu thành nhóm → **áp dụng** (apply) phép tính cho từng nhóm → **gộp** (combine) kết quả.

```python
import pandas as pd

sales = pd.DataFrame({
    "khu_vuc": ["Bắc", "Nam", "Bắc", "Trung", "Nam", "Nam", "Bắc"],
    "nhan_vien": ["An", "Bình", "Chi", "Dũng", "Bình", "Em", "An"],
    "doanh_so": [120, 200, 90, 150, 180, 60, 110],
})

# Tổng doanh số mỗi khu vực (giống SUMIF)
print(sales.groupby("khu_vuc")["doanh_so"].sum())
# Output:
# khu_vuc
# Bắc      320
# Nam      440
# Trung    150
# Name: doanh_so, dtype: int64

# Nhiều phép tính, đặt tên cột kết quả (named aggregation)
summary = sales.groupby("khu_vuc").agg(
    tong=("doanh_so", "sum"),
    trung_binh=("doanh_so", "mean"),
    so_don=("doanh_so", "count"),
    so_nv=("nhan_vien", "nunique"),       # Số nhân viên khác nhau
).sort_values("tong", ascending=False)
print(summary.round(1))
# Output:
#          tong  trung_binh  so_don  so_nv
# khu_vuc
# Nam       440       146.7       3      2
# Bắc       320       106.7       3      2
# Trung     150       150.0       1      1

# Nhóm theo nhiều cột; as_index=False → kết quả là bảng phẳng (giống .reset_index())
print(sales.groupby(["khu_vuc", "nhan_vien"], as_index=False)["doanh_so"].sum())
# Output:
#   khu_vuc nhan_vien  doanh_so
# 0     Bắc        An       230
# 1     Bắc       Chi        90
# 2     Nam      Bình       380
# 3     Nam        Em        60
# 4   Trung      Dũng       150
```

### merge - Ghép bảng (VLOOKUP)

```python
import pandas as pd

orders = pd.DataFrame({
    "ma_don": ["D1", "D2", "D3", "D4"],
    "ma_kh": ["KH1", "KH2", "KH1", "KH9"],     # KH9 không có trong bảng khách hàng
    "tien": [500, 300, 700, 200],
})
customers = pd.DataFrame({
    "ma_kh": ["KH1", "KH2", "KH3"],
    "ten": ["An", "Bình", "Chi"],
    "thanh_pho": ["Hà Nội", "Đà Nẵng", "TP.HCM"],
})

# inner (mặc định): chỉ giữ dòng khớp ở CẢ HAI bảng
print(pd.merge(orders, customers, on="ma_kh"))
# Output:
#   ma_don ma_kh  tien   ten thanh_pho
# 0     D1   KH1   500    An    Hà Nội
# 1     D2   KH2   300  Bình   Đà Nẵng
# 2     D3   KH1   700    An    Hà Nội

# left: giữ TẤT CẢ đơn hàng, thông tin khách thiếu → NaN. indicator=True cho biết nguồn gốc
merged = pd.merge(orders, customers, on="ma_kh", how="left", indicator=True)
print(merged[["ma_don", "ma_kh", "ten", "_merge"]])
# Output:
#   ma_don ma_kh   ten     _merge
# 0     D1   KH1    An       both
# 1     D2   KH2  Bình       both
# 2     D3   KH1    An       both
# 3     D4   KH9   NaN  left_only
```

| `how=` | Giữ lại | Giống SQL |
| --- | --- | --- |
| `"inner"` | Dòng khớp ở cả hai bảng | `INNER JOIN` |
| `"left"` | Mọi dòng bảng trái | `LEFT JOIN` |
| `"right"` | Mọi dòng bảng phải | `RIGHT JOIN` |
| `"outer"` | Mọi dòng cả hai bảng | `FULL OUTER JOIN` |

> 💡 Nếu bạn đã học SQL ở [Bài 13](./13-databases.md), `merge` chính là `JOIN`. pandas cũng đọc thẳng từ database: `pd.read_sql("SELECT ...", connection)`.

### pivot_table - PivotTable của Excel

```python
import pandas as pd

sales = pd.DataFrame({
    "thang": ["T1", "T1", "T1", "T2", "T2", "T2", "T2"],
    "khu_vuc": ["Bắc", "Nam", "Bắc", "Bắc", "Nam", "Trung", "Nam"],
    "doanh_so": [120, 200, 90, 150, 180, 60, 110],
})

pivot = pd.pivot_table(
    sales,
    index="khu_vuc",          # Hàng
    columns="thang",          # Cột
    values="doanh_so",        # Giá trị
    aggfunc="sum",            # Phép tổng hợp
    fill_value=0,             # Ô không có dữ liệu → 0 thay vì NaN
    margins=True,             # Thêm hàng/cột tổng "All"
    margins_name="Tổng",
)
print(pivot)
# Output:
# thang     T1   T2  Tổng
# khu_vuc
# Bắc      210  150   360
# Nam      200  290   490
# Trung      0   60    60
# Tổng     410  500   910
```

### Xử lý dữ liệu thiếu (Missing data)

Dữ liệu thực tế **luôn** có ô trống. pandas biểu diễn chúng bằng `NaN` (Not a Number) hoặc `None`/`NaT` (với ngày giờ).

```python
import pandas as pd

df = pd.DataFrame({
    "ten": ["An", "Bình", None, "Dũng"],
    "tuoi": [25, None, 30, None],
    "thanh_pho": ["Hà Nội", "Đà Nẵng", "Huế", None],
})

print(df.isna().sum())                    # Đếm ô trống mỗi cột
# Output:
# ten          1
# tuoi         2
# thanh_pho    1
# dtype: int64

print(df.dropna().shape)                  # Bỏ mọi hàng có BẤT KỲ ô trống nào
print(df.dropna(subset=["ten"]).shape)    # Chỉ bỏ hàng thiếu tên
# Output:
# (1, 3)
# (3, 3)

filled = df.fillna({
    "tuoi": df["tuoi"].median(),          # Điền trung vị
    "thanh_pho": "Không rõ",
})
print(filled)
# Output:
#     ten  tuoi thanh_pho
# 0    An  25.0    Hà Nội
# 1  Bình  27.5   Đà Nẵng
# 2   NaN  30.0       Huế
# 3  Dũng  27.5  Không rõ
```

> ⚠️ Không có cách xử lý dữ liệu thiếu "đúng cho mọi trường hợp". Xóa hàng có thể mất nhiều dữ liệu; điền trung bình có thể làm sai lệch phân tích. Hãy **hỏi**: tại sao dữ liệu bị thiếu? Thiếu có ý nghĩa gì với nghiệp vụ?

### Làm việc với ngày giờ

```python
import pandas as pd

df = pd.DataFrame({
    "ngay": ["2025-01-05", "2025-01-20", "2025-02-03", "2025-02-14", "2025-03-01"],
    "doanh_so": [100, 150, 200, 120, 300],
})
df["ngay"] = pd.to_datetime(df["ngay"])                # Chuỗi → datetime

df["thang"] = df["ngay"].dt.month                      # .dt: truy cập thành phần ngày giờ
df["thu"] = df["ngay"].dt.day_name()
df["ky"] = df["ngay"].dt.to_period("M")                # Kỳ theo tháng: 2025-01
print(df)
# Output:
#         ngay  doanh_so  thang       thu       ky
# 0 2025-01-05       100      1    Sunday  2025-01
# 1 2025-01-20       150      1    Monday  2025-01
# 2 2025-02-03       200      2    Monday  2025-02
# 3 2025-02-14       120      2    Friday  2025-02
# 4 2025-03-01       300      3  Saturday  2025-03

# Tổng theo tháng bằng resample (cần cột ngày làm index)
monthly = df.set_index("ngay")["doanh_so"].resample("MS").sum()   # MS = đầu tháng
print(monthly)
# Output:
# ngay
# 2025-01-01    250
# 2025-02-01    320
# 2025-03-01    300
# Freq: MS, Name: doanh_so, dtype: int64

# Lọc theo khoảng thời gian
print(df[df["ngay"] >= "2025-02-01"]["doanh_so"].sum())
# Output: 620
```

### Xuất dữ liệu: CSV, Excel

```python
import pandas as pd

df = pd.DataFrame({"ten": ["An", "Bình"], "diem": [8.5, 9.0]})

# utf-8-sig: thêm BOM để Excel trên Windows hiển thị đúng tiếng Việt
df.to_csv("diem.csv", index=False, encoding="utf-8-sig")

# Ghi nhiều sheet vào một file Excel (cần openpyxl)
with pd.ExcelWriter("bao_cao.xlsx", engine="openpyxl") as writer:
    df.to_excel(writer, sheet_name="Điểm", index=False)
    df.describe().to_excel(writer, sheet_name="Thống kê")

back = pd.read_excel("bao_cao.xlsx", sheet_name="Điểm")
print(back)
print(pd.ExcelFile("bao_cao.xlsx").sheet_names)
# Output:
#     ten  diem
# 0    An   8.5
# 1  Bình   9.0
# ['Điểm', 'Thống kê']
```

### Đọc CSV lớn theo từng phần (chunksize)

Kết hợp ý tưởng stream của mục 1 với sức mạnh của pandas:

```python
import numpy as np
import pandas as pd

# Tạo file mẫu 300.000 dòng
rng = np.random.default_rng(0)
pd.DataFrame({
    "region": rng.choice(["Bắc", "Trung", "Nam"], size=300_000),
    "amount": rng.integers(50, 5000, size=300_000),
}).to_csv("big.csv", index=False)

totals = None
for chunk in pd.read_csv("big.csv", chunksize=100_000):     # Mỗi lần chỉ 100.000 dòng trong RAM
    part = chunk.groupby("region")["amount"].sum()
    totals = part if totals is None else totals.add(part, fill_value=0)

print(totals.sort_index())
# Output:
# region
# Bắc      251367310
# Nam      251764738
# Trung    254159866
# Name: amount, dtype: int64
```

### 💡 Tips quan trọng

- Mới nhận dữ liệu: luôn chạy `df.head()`, `df.info()`, `df.describe()`, `df.isna().sum()` ✅
- Dùng phép toán **vector hóa** trên cả cột, tránh `for` / `iterrows()` ✅
- Nhiều điều kiện lọc: `&`, `|`, `~` và **ngoặc tròn** cho từng điều kiện ✅
- Sửa dữ liệu dùng **`df.loc[điều_kiện, "cột"] = giá_trị`** - không dùng `df["cột"][điều_kiện] = ...` (chained assignment) ❌
- Ghi CSV cho người dùng Excel: `encoding="utf-8-sig"` ✅

## 📖 3. Vẽ biểu đồ với matplotlib

Một biểu đồ tốt truyền tải thông tin nhanh hơn 100 dòng số liệu. `matplotlib` là thư viện vẽ biểu đồ nền tảng của Python (pandas, seaborn đều dựa trên nó).

### Hai khái niệm: Figure và Axes

> 🧠 **Ví dụ dễ hiểu**: **Figure** = **tờ giấy** 📄. **Axes** = **một khung biểu đồ** vẽ trên tờ giấy đó (một tờ giấy có thể có nhiều khung). Bạn luôn tạo giấy + khung bằng `fig, ax = plt.subplots()`, rồi vẽ lên `ax`.

```python
import matplotlib

matplotlib.use("Agg")               # Backend không cần màn hình - chạy được trên server, trong cron
import matplotlib.pyplot as plt

months = ["T1", "T2", "T3", "T4", "T5", "T6"]
revenue = [120, 135, 128, 160, 172, 190]           # Triệu đồng
cost = [90, 95, 100, 110, 112, 125]

fig, ax = plt.subplots(figsize=(8, 4.5))            # Kích thước (inch)
ax.plot(months, revenue, marker="o", label="Doanh thu")
ax.plot(months, cost, marker="s", linestyle="--", label="Chi phí")
ax.set_title("Doanh thu và chi phí 6 tháng đầu năm")
ax.set_xlabel("Tháng")
ax.set_ylabel("Triệu đồng")
ax.grid(alpha=0.3)
ax.legend()

for x, y in zip(months, revenue):                   # Ghi số lên từng điểm
    ax.annotate(str(y), (x, y), textcoords="offset points", xytext=(0, 6), ha="center")

fig.tight_layout()                                  # Tự căn lề, tránh chữ bị cắt
fig.savefig("doanh_thu.png", dpi=150)               # Lưu file ảnh
plt.close(fig)                                      # ⚠️ Giải phóng bộ nhớ
print("Đã lưu doanh_thu.png")
# Output: Đã lưu doanh_thu.png
```

> 💡 `matplotlib.use("Agg")` phải gọi **trước** `import matplotlib.pyplot`. Khi viết script tự động chạy (cron, server), không có màn hình để hiện cửa sổ → dùng `Agg` và `savefig`. Khi học trên máy cá nhân, bạn có thể bỏ dòng đó và gọi `plt.show()` để xem trực tiếp.

### Nhiều biểu đồ trên một hình: cột, tròn, cột ngang

```python
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

regions = ["Bắc", "Trung", "Nam"]
sales = [420, 180, 560]

fig, (ax1, ax2, ax3) = plt.subplots(1, 3, figsize=(14, 4))   # 1 hàng, 3 cột

bars = ax1.bar(regions, sales, color=["#4C72B0", "#DD8452", "#55A868"])
ax1.bar_label(bars, fmt="%d tr")                              # Số trên đầu cột
ax1.set_title("Doanh số theo khu vực (cột)")

ax2.pie(sales, labels=regions, autopct="%1.0f%%", startangle=90)
ax2.set_title("Tỷ trọng (tròn)")

products = ["Áo", "Quần", "Giày", "Mũ", "Túi"]
units = [320, 250, 180, 90, 60]
ax3.barh(products[::-1], units[::-1])                         # Cột ngang: dễ đọc khi tên dài
ax3.set_title("Top sản phẩm (cột ngang)")

fig.tight_layout()
fig.savefig("tong_quan.png", dpi=120)
plt.close(fig)
print("Đã lưu tong_quan.png")
# Output: Đã lưu tong_quan.png
```

### Vẽ trực tiếp từ pandas

DataFrame/Series có sẵn method `.plot()` (dùng matplotlib bên dưới) - rất tiện khi đã có dữ liệu trong pandas:

```python
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

df = pd.DataFrame(
    {"Bắc": [120, 150, 170], "Trung": [60, 70, 65], "Nam": [200, 210, 260]},
    index=["T1", "T2", "T3"],
)
ax = df.plot(kind="bar", figsize=(7, 4), title="Doanh số theo tháng và khu vực", rot=0)
ax.set_ylabel("Triệu đồng")
ax.figure.tight_layout()
ax.figure.savefig("theo_thang.png")
plt.close(ax.figure)
print(type(ax).__name__)
# Output: Axes
```

| Loại biểu đồ | Dùng khi | Hàm |
| --- | --- | --- |
| Đường (line) | Xu hướng theo **thời gian** | `ax.plot` |
| Cột (bar) | **So sánh** giữa các nhóm | `ax.bar`, `ax.barh` |
| Tròn (pie) | **Tỷ trọng** (ít nhóm, tổng = 100%) | `ax.pie` |
| Phân tán (scatter) | **Tương quan** giữa 2 biến | `ax.scatter` |
| Histogram | **Phân bố** giá trị | `ax.hist` |

> 💡 Tiếng Việt có dấu hiển thị tốt với font mặc định (DejaVu Sans) của matplotlib. Nếu thấy ô vuông, đặt font khác: `plt.rcParams["font.family"] = "Arial"`.

## 📖 4. Làm việc với Excel bằng openpyxl

`df.to_excel()` rất tiện nhưng chỉ ghi **dữ liệu thô**. Báo cáo gửi sếp thì cần: tiêu đề in đậm, màu nền, định dạng tiền tệ, độ rộng cột, công thức, cố định dòng tiêu đề, chèn biểu đồ... → dùng **openpyxl**.

> 🧠 **Ví dụ dễ hiểu**: pandas là **nhà máy sản xuất số liệu**; openpyxl là **bộ phận đóng gói, trang trí** trước khi giao hàng. Quy trình thường gặp: tính toán bằng pandas → ghi ra Excel → "trang điểm" bằng openpyxl.

### Tạo file Excel có định dạng

```python
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

wb = Workbook()
ws = wb.active                                  # Sheet mặc định
ws.title = "Bảng lương"

headers = ["Mã NV", "Họ tên", "Lương cơ bản", "Thưởng", "Tổng"]
rows = [
    ["NV01", "Nguyễn Văn An", 15_000_000, 2_000_000],
    ["NV02", "Trần Thị Bình", 18_000_000, 3_500_000],
    ["NV03", "Lê Văn Chi", 12_000_000, 1_000_000],
]

ws.append(headers)                              # append: thêm một hàng vào cuối
for r in rows:
    ws.append(r)

# Công thức Excel: Excel sẽ tự tính khi mở file
for row in range(2, len(rows) + 2):
    ws[f"E{row}"] = f"=C{row}+D{row}"
total_row = len(rows) + 2
ws[f"B{total_row}"] = "TỔNG CỘNG"
ws[f"E{total_row}"] = f"=SUM(E2:E{total_row - 1})"

# Định dạng tiêu đề
header_fill = PatternFill("solid", fgColor="1F4E78")
thin = Side(style="thin", color="999999")
for cell in ws[1]:                              # ws[1] = hàng 1
    cell.font = Font(bold=True, color="FFFFFF")
    cell.fill = header_fill
    cell.alignment = Alignment(horizontal="center")

# Định dạng số tiền + viền
for row in ws.iter_rows(min_row=2, max_row=total_row, min_col=1, max_col=5):
    for cell in row:
        cell.border = Border(top=thin, bottom=thin, left=thin, right=thin)
        if cell.column >= 3:
            cell.number_format = "#,##0"        # 15000000 → 15,000,000
ws[f"B{total_row}"].font = Font(bold=True)

# Độ rộng cột, cố định hàng tiêu đề khi cuộn
for col, width in zip(range(1, 6), [8, 20, 15, 12, 15]):
    ws.column_dimensions[get_column_letter(col)].width = width
ws.freeze_panes = "A2"

wb.save("bang_luong.xlsx")
print(f"Đã lưu {ws.max_row} hàng × {ws.max_column} cột")
# Output: Đã lưu 5 hàng × 5 cột
```

### Đọc file Excel

```python
from openpyxl import Workbook, load_workbook

# Tạo file mẫu
wb = Workbook()
ws = wb.active
ws.title = "Kho"
ws.append(["Sản phẩm", "Tồn kho", "Giá"])
ws.append(["Bút bi", 120, 5000])
ws.append(["Vở", 45, 12000])
ws.append(["Thước", 8, 7000])
wb.save("kho.xlsx")

# Đọc lại
wb = load_workbook("kho.xlsx")                 # data_only=True: đọc GIÁ TRỊ thay vì công thức
ws = wb["Kho"]
print(wb.sheetnames, ws["A2"].value, ws.cell(row=2, column=2).value)
# Output: ['Kho'] Bút bi 120

for name, stock, price in ws.iter_rows(min_row=2, values_only=True):   # values_only: chỉ lấy giá trị
    warning = "⚠️ sắp hết" if stock < 10 else ""
    print(f"{name:<8} {stock:>4} {price:>7,}đ {warning}")
# Output:
# Bút bi    120   5,000đ
# Vở         45  12,000đ
# Thước       8   7,000đ ⚠️ sắp hết
```

> ⚠️ openpyxl **không tính công thức**. Nếu file được tạo bởi openpyxl và chưa từng mở bằng Excel, `load_workbook(..., data_only=True)` trả về `None` cho ô công thức (vì chưa có ai tính và lưu kết quả). Hãy tính giá trị trong Python nếu cần dùng lại.

### Khi nào dùng gì?

| Nhu cầu | Công cụ |
| --- | --- |
| Đọc dữ liệu Excel để phân tích | `pd.read_excel` |
| Ghi bảng kết quả ra Excel nhanh | `df.to_excel` |
| Định dạng đẹp, công thức, chèn ảnh/biểu đồ | `openpyxl` (có thể kết hợp sau `to_excel`) |
| Sửa vài ô trong file mẫu có sẵn (template) | `openpyxl.load_workbook` → sửa → `save` |
| File `.xls` rất cũ | `pd.read_excel(..., engine="xlrd")` (cài `xlrd`) |

## 📖 5. Web scraping với requests + BeautifulSoup

**Web scraping** = viết chương trình tự động đọc trang web và **trích xuất dữ liệu** (giá sản phẩm, tin tức, lịch chiếu phim...).

### ⚖️ Đạo đức và pháp lý - Đọc trước khi scrape!

> 🧠 **Ví dụ dễ hiểu**: Scraping giống như **vào cửa hàng ghi chép giá**. Vào xem, ghi vài món thì bình thường. Nhưng đứng chắn cửa, hỏi nhân viên 1.000 câu mỗi phút, lén chụp sổ sách nội bộ, hay vào khu vực có biển "Không phận sự miễn vào" thì **không ổn**.

1. **Ưu tiên API chính thức** nếu có - ổn định hơn, hợp pháp hơn
2. **Đọc `robots.txt`** (ví dụ `https://example.com/robots.txt`) - file nơi website nói bot nào được vào đâu. Tôn trọng `Disallow` và `Crawl-delay`
3. **Đọc Điều khoản sử dụng** (Terms of Service) - nhiều trang cấm scraping
4. **Đừng làm quá tải server**: chờ 1-2 giây giữa các request, không chạy song song ồ ạt (nhớ rate limiter ở [Bài 14](./14-concurrency-parallelism.md))
5. **Tự giới thiệu**: đặt `User-Agent` có tên bot và email liên hệ
6. **Không thu thập dữ liệu cá nhân** (tên, số điện thoại, email người dùng...) - ở Việt Nam, việc này chịu sự điều chỉnh của pháp luật về bảo vệ dữ liệu cá nhân (Nghị định 13/2023/NĐ-CP)
7. **Không vượt qua** đăng nhập, CAPTCHA, paywall

### Kiểm tra robots.txt bằng Python

```python
from urllib.robotparser import RobotFileParser

# Thực tế: rp.set_url("https://shop.example/robots.txt"); rp.read()
# Ở đây parse nội dung mẫu để chạy offline
robots_txt = """
User-agent: *
Disallow: /admin/
Disallow: /cart
Crawl-delay: 2

User-agent: BadBot
Disallow: /
"""
rp = RobotFileParser()
rp.parse(robots_txt.splitlines())

for url in ["https://shop.example/products/1", "https://shop.example/admin/users"]:
    print(url, "→", "✅ được phép" if rp.can_fetch("PriceBot", url) else "⛔ cấm")
print("BadBot được vào trang chủ?", rp.can_fetch("BadBot", "https://shop.example/"))
print("Crawl-delay:", rp.crawl_delay("PriceBot"), "giây")
# Output:
# https://shop.example/products/1 → ✅ được phép
# https://shop.example/admin/users → ⛔ cấm
# BadBot được vào trang chủ? False
# Crawl-delay: 2 giây
```

### Tải trang với requests

Khi làm thật (có internet), bạn tải HTML như sau:

```text
import requests

HEADERS = {"User-Agent": "PriceBot/1.0 (contact: ban@example.com)"}

def fetch_html(url: str) -> str:
    response = requests.get(url, headers=HEADERS, timeout=10)   # LUÔN có timeout
    response.raise_for_status()                                 # 4xx/5xx → exception
    response.encoding = response.apparent_encoding              # Đoán encoding đúng cho tiếng Việt
    return response.text
```

Các ví dụ dưới đây dùng **chuỗi HTML có sẵn** để bạn chạy offline. Khi làm thật, chỉ cần thay chuỗi đó bằng `fetch_html(url)`.

### BeautifulSoup - Tìm dữ liệu trong HTML

HTML là một **cây** các thẻ lồng nhau. BeautifulSoup biến chuỗi HTML thành object để bạn "đi" trên cây đó.

```python
from bs4 import BeautifulSoup

html = """
<html><body>
  <h1 class="title">Cửa hàng Sách Hay</h1>
  <ul id="books">
    <li class="book" data-id="101">
      <a href="/sach/python-co-ban">Python Cơ Bản</a>
      <span class="price">150.000₫</span>
    </li>
    <li class="book sale" data-id="102">
      <a href="/sach/python-nang-cao">Python Nâng Cao</a>
      <span class="price">220.000₫</span>
      <span class="badge">Giảm giá</span>
    </li>
  </ul>
</body></html>
"""
soup = BeautifulSoup(html, "html.parser")       # "html.parser" có sẵn, không cần cài thêm

# find: phần tử ĐẦU TIÊN khớp; find_all: TẤT CẢ
print(soup.find("h1").get_text(strip=True))
print(len(soup.find_all("li", class_="book")))  # class_ (có gạch dưới) vì class là từ khóa Python
# Output:
# Cửa hàng Sách Hay
# 2

# select / select_one: dùng CSS selector - mạnh và ngắn gọn
for li in soup.select("ul#books li.book"):
    title = li.select_one("a").get_text(strip=True)
    link = li.select_one("a")["href"]                      # Lấy thuộc tính như dict
    price = li.select_one(".price").get_text(strip=True)
    on_sale = li.select_one(".badge") is not None
    print(f"[{li['data-id']}] {title} | {price} | {link} | sale={on_sale}")
# Output:
# [101] Python Cơ Bản | 150.000₫ | /sach/python-co-ban | sale=False
# [102] Python Nâng Cao | 220.000₫ | /sach/python-nang-cao | sale=True
```

| Cần tìm | CSS selector |
| --- | --- |
| Thẻ `<a>` | `a` |
| class `price` | `.price` |
| id `books` | `#books` |
| `<li>` có class `book` bên trong `#books` | `#books li.book` |
| Con trực tiếp | `ul > li` |
| Có thuộc tính | `a[href]`, `li[data-id="102"]` |

> 💡 Mẹo tìm selector: mở trang trong Chrome → chuột phải vào phần tử → **Inspect** → xem class/id. Nếu dữ liệu **không có** trong HTML khi xem "View Page Source" (do JavaScript tải sau), hãy tìm API mà trang gọi trong tab **Network**, hoặc dùng công cụ trình duyệt tự động như **Playwright**.

### Đọc bảng HTML

```python
from bs4 import BeautifulSoup

html = """
<table id="rates">
  <tr><th>Ngoại tệ</th><th>Mua</th><th>Bán</th></tr>
  <tr><td>USD</td><td>25.100</td><td>25.460</td></tr>
  <tr><td>EUR</td><td>27.050</td><td>28.480</td></tr>
</table>
"""
soup = BeautifulSoup(html, "html.parser")
rows = soup.select("#rates tr")
headers = [th.get_text(strip=True) for th in rows[0].find_all("th")]
data = [
    dict(zip(headers, [td.get_text(strip=True) for td in tr.find_all("td")]))
    for tr in rows[1:]
]
print(data)
# Output: [{'Ngoại tệ': 'USD', 'Mua': '25.100', 'Bán': '25.460'}, {'Ngoại tệ': 'EUR', 'Mua': '27.050', 'Bán': '28.480'}]
```

## 📖 6. Gửi email báo cáo với smtplib

Python có sẵn `smtplib` (gửi mail qua giao thức SMTP) và `email.message.EmailMessage` (soạn email có tiêu đề, nội dung HTML, file đính kèm).

### Chuẩn bị tài khoản (ví dụ Gmail)

1. Bật **xác minh 2 bước** cho tài khoản Google
2. Vào **Google Account → Security → App passwords**, tạo "mật khẩu ứng dụng" 16 ký tự
3. **Không bao giờ** ghi mật khẩu vào code. Lưu trong **biến môi trường** (hoặc file `.env` - [Bài 16](./16-production-ready.md)):

```bash
# macOS/Linux
export SMTP_USER="baocao.congty@gmail.com"
export SMTP_PASSWORD="abcd efgh ijkl mnop"
# Windows PowerShell
$env:SMTP_USER = "baocao.congty@gmail.com"
```

### Soạn và gửi email

Ví dụ dưới đây **soạn** email đầy đủ (HTML + file đính kèm) và chỉ **gửi thật** khi bạn đặt `DRY_RUN = False`. Mặc định nó in email ra màn hình để bạn kiểm tra - một thói quen tốt khi viết script tự động gửi mail.

```python
import os
import smtplib
import ssl
from email.message import EmailMessage
from pathlib import Path

DRY_RUN = True                     # True: chỉ in ra, KHÔNG gửi. Đổi thành False khi đã sẵn sàng


def build_report_email(to: list[str], subject: str, html_body: str,
                       attachments: list[Path]) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = os.environ.get("SMTP_USER", "bot@example.com")
    msg["To"] = ", ".join(to)
    msg["Subject"] = subject
    msg.set_content("Email này cần trình đọc hỗ trợ HTML.")    # Bản text dự phòng
    msg.add_alternative(html_body, subtype="html")             # Bản HTML
    for path in attachments:
        msg.add_attachment(
            path.read_bytes(),
            maintype="application",
            subtype="octet-stream",
            filename=path.name,
        )
    return msg


def send_email(msg: EmailMessage) -> None:
    host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
    user = os.environ["SMTP_USER"]                  # KeyError nếu chưa cấu hình → lỗi rõ ràng
    password = os.environ["SMTP_PASSWORD"]
    context = ssl.create_default_context()
    with smtplib.SMTP_SSL(host, 465, context=context, timeout=30) as server:   # Cổng 465 = SSL
        server.login(user, password)
        server.send_message(msg)


Path("bao_cao.csv").write_text("khu_vuc,doanh_so\nBắc,420\nNam,560\n", encoding="utf-8")
msg = build_report_email(
    to=["sep@example.com", "ketoan@example.com"],
    subject="[Báo cáo] Doanh số ngày 15/03/2025",
    html_body="<h2>Doanh số hôm nay</h2><p>Tổng: <b>980 triệu</b> 🎉</p>",
    attachments=[Path("bao_cao.csv")],
)

if DRY_RUN:
    print("🧪 DRY RUN - không gửi. Nội dung email:")
    print("  To:     ", msg["To"])
    print("  Subject:", msg["Subject"])
    print("  Đính kèm:", [p.get_filename() for p in msg.iter_attachments()])
else:
    send_email(msg)
    print("📧 Đã gửi!")
# Output:
# 🧪 DRY RUN - không gửi. Nội dung email:
#   To:      sep@example.com, ketoan@example.com
#   Subject: [Báo cáo] Doanh số ngày 15/03/2025
#   Đính kèm: ['bao_cao.csv']
```

> 💡 Muốn thử gửi mail mà không làm phiền ai: dùng dịch vụ "hộp thư giả" như **Mailtrap**, hoặc chạy SMTP server giả trên máy (`pip install aiosmtpd` rồi `python -m aiosmtpd -n -l localhost:1025`) và gửi bằng `smtplib.SMTP("localhost", 1025)` - mail sẽ được in ra terminal thay vì gửi đi.

| Nhà cung cấp | Host | Cổng |
| --- | --- | --- |
| Gmail | `smtp.gmail.com` | 465 (SSL) hoặc 587 (STARTTLS) |
| Outlook/Office 365 | `smtp.office365.com` | 587 (STARTTLS) |
| Dịch vụ gửi mail hàng loạt | SendGrid, Mailgun, Amazon SES... | Theo tài liệu |

Với cổng 587, dùng `smtplib.SMTP(host, 587)` rồi gọi `server.starttls(context=context)` trước `login`.

## 📖 7. Lên lịch chạy script tự động

Script báo cáo viết xong, bước cuối là để nó **tự chạy** lúc 7 giờ sáng mỗi ngày mà không cần bạn bấm nút.

### Cách 1: cron (Linux/macOS)

`cron` là "đồng hồ báo thức" của hệ điều hành. Mở bảng lịch bằng `crontab -e` và thêm dòng:

```bash
# ┌───────── phút (0-59)
# │ ┌─────── giờ (0-23)
# │ │ ┌───── ngày trong tháng (1-31)
# │ │ │ ┌─── tháng (1-12)
# │ │ │ │ ┌─ thứ trong tuần (0-6, 0 = Chủ nhật)
# │ │ │ │ │
  0 7 * * 1-5  cd /home/an/bao-cao && /home/an/bao-cao/.venv/bin/python daily_report.py >> logs/cron.log 2>&1
```

| Biểu thức | Ý nghĩa |
| --- | --- |
| `0 7 * * *` | 7:00 mỗi ngày |
| `0 7 * * 1-5` | 7:00 thứ Hai đến thứ Sáu |
| `*/15 * * * *` | Mỗi 15 phút |
| `0 8 1 * *` | 8:00 ngày 1 hàng tháng |
| `30 17 * * 5` | 17:30 mỗi thứ Sáu |

> ⚠️ Ba lỗi kinh điển với cron: (1) cron **không** kích hoạt venv → dùng **đường dẫn tuyệt đối** tới `.venv/bin/python`; (2) thư mục làm việc không phải thư mục project → `cd` trước hoặc dùng đường dẫn tuyệt đối trong code (`Path(__file__).parent`); (3) không thấy lỗi → luôn ghi log (`>> file.log 2>&1`). Dùng [crontab.guru](https://crontab.guru) để kiểm tra biểu thức.

### Cách 2: Task Scheduler (Windows)

1. Mở **Task Scheduler** → **Create Basic Task...**
2. Đặt tên, chọn **Trigger**: Daily, 7:00 AM
3. **Action**: Start a program
   - Program: `C:\bao-cao\.venv\Scripts\python.exe`
   - Arguments: `daily_report.py`
   - Start in: `C:\bao-cao` (**quan trọng** - thư mục làm việc)
4. Tab **General**: tick "Run whether user is logged on or not" nếu muốn chạy cả khi chưa đăng nhập

Hoặc bằng một lệnh trong Command Prompt:

```bash
schtasks /Create /SC DAILY /ST 07:00 /TN "BaoCaoHangNgay" /TR "C:\bao-cao\.venv\Scripts\python.exe C:\bao-cao\daily_report.py"
```

### Cách 3: Thư viện `schedule` (trong Python)

`schedule` cho phép lên lịch **ngay trong code** với cú pháp đọc như tiếng Anh. Chương trình phải **luôn chạy** (vòng lặp `while True`), nên thường dùng cho script chạy nền trên server hoặc trong Docker.

```python
import time

import schedule


def job(name: str) -> None:
    print(f"⏰ Chạy {name}")


# Cú pháp thật khi dùng:
schedule.every().day.at("07:00").do(job, name="báo cáo sáng")
schedule.every().monday.at("08:30").do(job, name="báo cáo tuần")
schedule.every(10).minutes.do(job, name="kiểm tra đơn hàng")
print("Số job đã đăng ký:", len(schedule.get_jobs()))
schedule.clear()                                    # Xóa để demo phần dưới

# Demo chạy nhanh: mỗi 1 giây, dừng sau ~3 giây
schedule.every(1).seconds.do(job, name="demo")
end = time.monotonic() + 3.5
while time.monotonic() < end:                       # Thực tế: while True:
    schedule.run_pending()                          # Chạy các job đã đến giờ
    time.sleep(0.1)
# Output:
# Số job đã đăng ký: 3
# ⏰ Chạy demo
# ⏰ Chạy demo
# ⏰ Chạy demo
```

| | cron / Task Scheduler | `schedule` |
| --- | --- | --- |
| Cần chương trình chạy liên tục | ❌ Không - HĐH tự khởi động script | ✅ Có |
| Máy khởi động lại | Vẫn chạy đúng lịch | Script phải được khởi động lại |
| Cấu hình | Ngoài code | Trong code Python |
| Phù hợp | **Hầu hết** trường hợp trên máy/server | Trong container, app đang chạy sẵn |

> 💡 Ở quy mô lớn hơn (nhiều job phụ thuộc nhau, cần retry, giao diện theo dõi), người ta dùng **Airflow**, **Prefect**, **Celery beat**, hoặc lịch của nền tảng cloud/CI (**GitHub Actions `schedule`**).

## 🌍 Ứng dụng thực tế

Bốn chương trình hoàn chỉnh dưới đây tự tạo dữ liệu mẫu nên bạn chạy được ngay. Khi áp dụng vào công việc, chỉ cần thay phần "tạo dữ liệu mẫu" bằng file/trang web thật.

### Ứng dụng 1: Báo cáo doanh số theo tháng và khu vực (CSV → Excel + biểu đồ)

Bài toán: cuối mỗi quý, phòng kinh doanh xuất file `sales.csv` (hàng nghìn đơn hàng) và nhờ bạn làm báo cáo: doanh thu theo tháng × khu vực, tăng trưởng, top sản phẩm, kèm biểu đồ, tất cả trong **một file Excel** đẹp. Làm tay mất nửa ngày; script dưới đây làm trong 2 giây.

```python
"""sales_report.py - Báo cáo doanh số: CSV → pandas → Excel có định dạng + biểu đồ."""
import random
from datetime import date, timedelta
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
from openpyxl import load_workbook
from openpyxl.drawing.image import Image as XLImage
from openpyxl.styles import Font, PatternFill

OUT = Path("report_output")
PRODUCTS = {"Laptop": 18_000_000, "Điện thoại": 9_000_000, "Tai nghe": 1_200_000,
            "Chuột": 350_000, "Bàn phím": 800_000}
REGIONS = ["Bắc", "Trung", "Nam"]


def create_sample_csv(path: Path, n: int = 3000) -> None:
    """Tạo dữ liệu mẫu 6 tháng. Thực tế: bạn đã có sẵn file này."""
    rng = random.Random(2025)
    start = date(2025, 1, 1)
    rows = []
    for i in range(n):
        product = rng.choice(list(PRODUCTS))
        rows.append({
            "ma_don": f"DH{i:05d}",
            "ngay": (start + timedelta(days=rng.randint(0, 180))).isoformat(),
            "khu_vuc": rng.choices(REGIONS, weights=[4, 2, 5])[0],
            "san_pham": product,
            "so_luong": rng.randint(1, 5),
            "don_gia": PRODUCTS[product],
        })
    pd.DataFrame(rows).to_csv(path, index=False, encoding="utf-8")


def analyze(csv_path: Path) -> dict[str, pd.DataFrame]:
    df = pd.read_csv(csv_path, parse_dates=["ngay"])
    df["doanh_thu"] = df["so_luong"] * df["don_gia"]
    df["thang"] = df["ngay"].dt.to_period("M").astype(str)       # "2025-01"

    by_month_region = pd.pivot_table(
        df, index="thang", columns="khu_vuc", values="doanh_thu",
        aggfunc="sum", fill_value=0,
    )[REGIONS]                                                    # Sắp xếp cột theo ý muốn
    by_month_region.columns.name = None                          # Bỏ nhãn "khu_vuc" trên tiêu đề cột
    by_month_region["Tổng"] = by_month_region.sum(axis=1)
    by_month_region["Tăng trưởng %"] = (by_month_region["Tổng"].pct_change() * 100).round(1)

    top_products = (
        df.groupby("san_pham")
        .agg(so_luong=("so_luong", "sum"), doanh_thu=("doanh_thu", "sum"))
        .sort_values("doanh_thu", ascending=False)
    )
    return {"raw": df, "monthly": by_month_region, "products": top_products}


def make_charts(result: dict[str, pd.DataFrame]) -> list[Path]:
    monthly = result["monthly"]
    fig, ax = plt.subplots(figsize=(8, 4))
    for region in REGIONS:
        ax.plot(monthly.index, monthly[region] / 1e9, marker="o", label=region)
    ax.set_title("Doanh thu theo tháng và khu vực")
    ax.set_ylabel("Tỷ đồng")
    ax.legend()
    ax.grid(alpha=0.3)
    fig.tight_layout()
    line_path = OUT / "doanh_thu_thang.png"
    fig.savefig(line_path, dpi=100)
    plt.close(fig)

    products = result["products"]
    fig, ax = plt.subplots(figsize=(8, 4))
    bars = ax.barh(products.index[::-1], products["doanh_thu"][::-1] / 1e9, color="#55A868")
    ax.bar_label(bars, fmt="%.1f")
    ax.set_title("Doanh thu theo sản phẩm (tỷ đồng)")
    fig.tight_layout()
    bar_path = OUT / "san_pham.png"
    fig.savefig(bar_path, dpi=100)
    plt.close(fig)
    return [line_path, bar_path]


def write_excel(result: dict[str, pd.DataFrame], charts: list[Path], path: Path) -> None:
    # Bước 1: pandas ghi dữ liệu
    with pd.ExcelWriter(path, engine="openpyxl") as writer:
        result["monthly"].to_excel(writer, sheet_name="Theo tháng")
        result["products"].to_excel(writer, sheet_name="Sản phẩm")
        result["raw"].to_excel(writer, sheet_name="Dữ liệu gốc", index=False)

    # Bước 2: openpyxl "trang điểm"
    wb = load_workbook(path)
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="1F4E78")
    for ws in wb.worksheets:
        for cell in ws[1]:
            cell.font = header_font
            cell.fill = header_fill
        for col in ws.columns:
            letter = col[0].column_letter
            ws.column_dimensions[letter].width = max(len(str(c.value or "")) for c in col) + 3
            for cell in col[1:]:
                if isinstance(cell.value, (int, float)) and abs(cell.value) >= 1000:
                    cell.number_format = "#,##0"
        ws.freeze_panes = "B2"
    wb["Theo tháng"].add_image(XLImage(str(charts[0])), "A10")    # Chèn biểu đồ vào sheet
    wb["Sản phẩm"].add_image(XLImage(str(charts[1])), "E2")
    wb.save(path)


def main() -> None:
    OUT.mkdir(exist_ok=True)
    csv_path = OUT / "sales.csv"
    create_sample_csv(csv_path)

    result = analyze(csv_path)
    charts = make_charts(result)
    excel_path = OUT / "bao_cao_doanh_so.xlsx"
    write_excel(result, charts, excel_path)

    monthly = result["monthly"]
    print(f"📊 Đã phân tích {len(result['raw']):,} đơn hàng")
    print((monthly[["Tổng", "Tăng trưởng %"]].assign(Tổng=monthly["Tổng"] // 1_000_000)
           .rename(columns={"Tổng": "Tổng (triệu)"})).to_string())
    best = result["products"].index[0]
    print(f"🏆 Sản phẩm doanh thu cao nhất: {best}")
    print(f"📁 Đã tạo: {excel_path.name}, {', '.join(c.name for c in charts)}")


if __name__ == "__main__":
    main()
# Output:
# 📊 Đã phân tích 3,000 đơn hàng
#          Tổng (triệu)  Tăng trưởng %
# thang
# 2025-01          9087            NaN
# 2025-02          7933          -12.7
# 2025-03          8019            1.1
# 2025-04          8503            6.0
# 2025-05         10654           25.3
# 2025-06          8669          -18.6
# 🏆 Sản phẩm doanh thu cao nhất: Laptop
# 📁 Đã tạo: bao_cao_doanh_so.xlsx, doanh_thu_thang.png, san_pham.png
```

Mở file `report_output/bao_cao_doanh_so.xlsx` bằng Excel: bạn sẽ thấy 3 sheet có tiêu đề màu xanh, số có dấu phân cách hàng nghìn, và biểu đồ được chèn sẵn. Quý sau chỉ cần thay file CSV và chạy lại.

### Ứng dụng 2: Làm sạch dữ liệu khách hàng

Bài toán: gộp danh sách khách hàng từ 3 nguồn (form website, file Excel của sales, hệ thống cũ) để gửi tin nhắn chăm sóc. Dữ liệu "bẩn" kinh điển: tên viết hoa lung tung, số điện thoại đủ kiểu (`+84`, dấu chấm, dấu cách), email thừa khoảng trắng, **trùng lặp**. Gửi trùng tin nhắn = tốn tiền + khách khó chịu.

```python
"""clean_customers.py - Chuẩn hóa và loại trùng dữ liệu khách hàng."""
import io
import re

import pandas as pd

RAW_CSV = """ho_ten,so_dien_thoai,email,thanh_pho,ngay_cap_nhat
  nguyễn văn AN ,0912 345 678, An.Nguyen@Gmail.com ,Hà Nội,2025-01-10
Trần Thị Bình,+84 987.654.321,binh.tran@yahoo.com,hà nội,2025-02-01
NGUYỄN VĂN AN,84912345678,an.nguyen@gmail.com,Ha Noi,2025-03-05
Lê   Chi,0356-789-012,chi.le@outlook.com,,2025-01-20
Phạm Dũng,12345,dung.pham@,Đà Nẵng,2025-02-15
Hoàng Em,(+84) 708 111 222,EM.HOANG@GMAIL.COM,TP HCM,2025-03-01
trần thị bình,0987654321,,Hà Nội,2025-03-10
Võ Giang,912345000,giang.vo@gmail.com,Tp.HCM,2025-02-20
"""

VALID_PREFIXES = ("03", "05", "07", "08", "09")       # Đầu số di động Việt Nam
EMAIL_RE = re.compile(r"^[\w.+-]+@[\w-]+(\.[\w-]+)+$")
CITY_MAP = {"ha noi": "Hà Nội", "hà nội": "Hà Nội", "tp hcm": "TP.HCM", "tp.hcm": "TP.HCM",
            "đà nẵng": "Đà Nẵng"}


def normalize_phone(raw: str | float) -> str | None:
    """'+84 912.345.678' / '84912345678' / '912345678' → '0912345678'. Không hợp lệ → None."""
    if pd.isna(raw):
        return None
    digits = re.sub(r"\D", "", str(raw))            # Chỉ giữ chữ số
    if digits.startswith("84") and len(digits) == 11:
        digits = "0" + digits[2:]                     # 84xxxxxxxxx → 0xxxxxxxxx
    elif len(digits) == 9:
        digits = "0" + digits                         # Thiếu số 0 đầu (Excel hay "ăn" mất)
    if len(digits) == 10 and digits.startswith(VALID_PREFIXES):
        return digits
    return None


def normalize_name(raw: str) -> str:
    return " ".join(str(raw).split()).title()        # Bỏ khoảng trắng thừa + viết hoa chữ đầu


def normalize_email(raw: str | float) -> str | None:
    if pd.isna(raw):
        return None
    email = str(raw).strip().lower()
    return email if EMAIL_RE.match(email) else None


def normalize_city(raw: str | float) -> str:
    if pd.isna(raw) or not str(raw).strip():
        return "Không rõ"
    key = " ".join(str(raw).lower().split())
    return CITY_MAP.get(key, str(raw).strip().title())


def clean(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    df = df.copy()
    df["ho_ten"] = df["ho_ten"].map(normalize_name)
    df["so_dien_thoai"] = df["so_dien_thoai"].map(normalize_phone)
    df["email"] = df["email"].map(normalize_email)
    df["thanh_pho"] = df["thanh_pho"].map(normalize_city)
    df["ngay_cap_nhat"] = pd.to_datetime(df["ngay_cap_nhat"])

    # Dòng không có SĐT hợp lệ → tách riêng để người kiểm tra thủ công
    invalid = df[df["so_dien_thoai"].isna()]
    valid = df[df["so_dien_thoai"].notna()]

    # Trùng SĐT → giữ bản cập nhật MỚI NHẤT, nhưng bổ sung email từ bản cũ nếu bản mới thiếu
    valid = valid.sort_values("ngay_cap_nhat")
    valid = valid.assign(email=valid.groupby("so_dien_thoai")["email"].transform("last"))
    deduped = valid.drop_duplicates(subset="so_dien_thoai", keep="last")
    return deduped.sort_values("ho_ten").reset_index(drop=True), invalid


def main() -> None:
    raw = pd.read_csv(io.StringIO(RAW_CSV), dtype={"so_dien_thoai": str})  # dtype=str: giữ số 0 đầu!
    cleaned, invalid = clean(raw)

    print(f"Ban đầu: {len(raw)} dòng → sạch: {len(cleaned)} khách hàng, "
          f"cần kiểm tra tay: {len(invalid)}")
    print(cleaned[["ho_ten", "so_dien_thoai", "email", "thanh_pho"]].to_string())
    print("⚠️ Cần kiểm tra:", invalid["ho_ten"].tolist())

    cleaned.to_csv("khach_hang_sach.csv", index=False, encoding="utf-8-sig")
    invalid.to_csv("khach_hang_can_kiem_tra.csv", index=False, encoding="utf-8-sig")


if __name__ == "__main__":
    main()
# Output:
# Ban đầu: 8 dòng → sạch: 5 khách hàng, cần kiểm tra tay: 1
#           ho_ten so_dien_thoai                email thanh_pho
# 0       Hoàng Em    0708111222   em.hoang@gmail.com    TP.HCM
# 1         Lê Chi    0356789012   chi.le@outlook.com  Không rõ
# 2  Nguyễn Văn An    0912345678  an.nguyen@gmail.com    Hà Nội
# 3  Trần Thị Bình    0987654321  binh.tran@yahoo.com    Hà Nội
# 4       Võ Giang    0912345000   giang.vo@gmail.com    TP.HCM
# ⚠️ Cần kiểm tra: ['Phạm Dũng']
```

Điểm đáng học:

- **`dtype={"so_dien_thoai": str}`**: nếu để pandas tự đoán, `0912345678` thành số `912345678` - mất số 0!
- Mỗi quy tắc làm sạch là **một hàm nhỏ** → dễ đọc, dễ viết test (Bài 16), dễ tái sử dụng
- **Không xóa** dữ liệu lỗi - tách ra file riêng để con người quyết định
- Khi loại trùng, quyết định rõ ràng **giữ bản nào** (mới nhất) và **gộp thông tin** (email từ bản cũ)

### Ứng dụng 3: Scrape danh sách sản phẩm và so sánh giá

Bài toán: bạn bán laptop và muốn mỗi sáng biết giá của **2 đối thủ** cho cùng mẫu máy. Hai website có cấu trúc HTML **khác nhau**, cách ghi giá cũng khác (`25.990.000₫` vs `25,490,000 VND`).

```python
"""price_compare.py - Thu thập giá từ 2 cửa hàng và so sánh."""
import re
import time
from urllib.robotparser import RobotFileParser

import pandas as pd
from bs4 import BeautifulSoup

# ---------- "Internet giả" để chạy offline ----------
FAKE_WEB = {
    "https://shop-a.example/robots.txt": "User-agent: *\nDisallow: /admin/\n",
    "https://shop-a.example/laptop": """
      <div class="product-list">
        <div class="item"><h3>MacBook Air M3 13 inch</h3><p class="price">27.990.000₫</p></div>
        <div class="item"><h3>Dell XPS 13 9340</h3><p class="price">32.490.000₫</p></div>
        <div class="item"><h3>Asus Zenbook 14 OLED</h3><p class="price">21.990.000₫</p></div>
        <div class="item out-of-stock"><h3>Lenovo ThinkPad X1</h3><p class="price">Liên hệ</p></div>
      </div>""",
    "https://shop-b.example/robots.txt": "User-agent: *\nDisallow: /checkout\n",
    "https://shop-b.example/c/laptops": """
      <table id="products">
        <tr><th>Tên</th><th>Giá</th></tr>
        <tr><td><a href="/p/1">Macbook Air M3 13"</a></td><td data-price="26990000">26,990,000 VND</td></tr>
        <tr><td><a href="/p/2">ASUS ZenBook 14 OLED</a></td><td data-price="22490000">22,490,000 VND</td></tr>
        <tr><td><a href="/p/3">HP Spectre x360</a></td><td data-price="35990000">35,990,000 VND</td></tr>
      </table>""",
}
USER_AGENT = "PriceBot/1.0 (contact: ban@example.com)"
DELAY_SECONDS = 0.1          # Thực tế: 1-2 giây, hoặc theo Crawl-delay của robots.txt


def fetch(url: str) -> str:
    """Offline: đọc từ FAKE_WEB. Online: requests.get(url, headers=..., timeout=10).text"""
    time.sleep(DELAY_SECONDS)                         # Lịch sự: không dồn dập
    return FAKE_WEB[url]


def allowed(url: str) -> bool:
    base = "/".join(url.split("/")[:3])               # https://shop-a.example
    rp = RobotFileParser()
    rp.parse(fetch(f"{base}/robots.txt").splitlines())
    return rp.can_fetch(USER_AGENT, url)


def parse_price(text: str) -> int | None:
    digits = re.sub(r"\D", "", text)                  # "27.990.000₫" → "27990000"
    return int(digits) if digits else None            # "Liên hệ" → None


def normalize_name(name: str) -> str:
    """Tên để ghép giữa các shop: chữ thường, bỏ ký tự đặc biệt, bỏ 'inch'."""
    name = name.lower().replace("inch", "")
    return " ".join(re.sub(r"[^a-z0-9 ]", " ", name).split())


def scrape_shop_a(url: str) -> list[dict]:
    soup = BeautifulSoup(fetch(url), "html.parser")
    return [
        {"shop": "A", "ten": item.h3.get_text(strip=True),
         "gia": parse_price(item.select_one(".price").get_text())}
        for item in soup.select("div.item")
    ]


def scrape_shop_b(url: str) -> list[dict]:
    soup = BeautifulSoup(fetch(url), "html.parser")
    results = []
    for tr in soup.select("#products tr")[1:]:        # Bỏ hàng tiêu đề
        name_td, price_td = tr.find_all("td")
        results.append({"shop": "B", "ten": name_td.get_text(strip=True),
                        "gia": int(price_td["data-price"])})    # Thuộc tính data-* sạch hơn text
    return results


def main() -> None:
    sources = [("https://shop-a.example/laptop", scrape_shop_a),
               ("https://shop-b.example/c/laptops", scrape_shop_b)]
    rows = []
    for url, scraper in sources:
        if not allowed(url):
            print(f"⛔ robots.txt không cho phép: {url}")
            continue
        rows.extend(scraper(url))

    df = pd.DataFrame(rows).dropna(subset=["gia"])    # Bỏ sản phẩm "Liên hệ"
    df["key"] = df["ten"].map(normalize_name)
    table = df.pivot_table(index="key", columns="shop", values="gia", aggfunc="min")
    both = table.dropna().astype(int)                 # Chỉ so sánh mẫu có ở cả 2 shop
    both["chenh_lech"] = both["A"] - both["B"]
    both["re_hon"] = both["chenh_lech"].map(lambda d: "B" if d > 0 else ("A" if d < 0 else "="))

    print(f"Thu thập {len(df)} sản phẩm có giá từ {df['shop'].nunique()} cửa hàng")
    print(both.to_string(formatters={c: "{:,}".format for c in ["A", "B", "chenh_lech"]}))
    only = table[table.isna().any(axis=1)].index.tolist()
    print("Chỉ có ở một shop:", only)
    df.to_csv("gia_doi_thu.csv", index=False, encoding="utf-8-sig")


if __name__ == "__main__":
    main()
# Output:
# Thu thập 6 sản phẩm có giá từ 2 cửa hàng
# shop                          A          B chenh_lech re_hon
# key
# asus zenbook 14 oled 21,990,000 22,490,000   -500,000      A
# macbook air m3 13    27,990,000 26,990,000  1,000,000      B
# Chỉ có ở một shop: ['dell xps 13 9340', 'hp spectre x360']
```

> ⚠️ Scraper **rất dễ gãy**: website đổi class CSS một chút là code không tìm thấy gì. Hãy (1) kiểm tra kết quả rỗng và báo lỗi rõ ràng, (2) ghi log, (3) ưu tiên thuộc tính ổn định như `data-price`, `id` thay vì class trang trí.

### Ứng dụng 4: Tự động tạo báo cáo hàng ngày

Bài toán: mỗi sáng 7:00, tự động tổng hợp đơn hàng **hôm qua**, tính các chỉ số (KPI), vẽ biểu đồ, xuất Excel và gửi email cho sếp. Script này kết hợp **mọi thứ** trong bài: pandas, matplotlib, Excel, email, logging, lên lịch.

```python
"""daily_report.py - Báo cáo tự động hằng ngày.

Chạy một lần:        python daily_report.py --date 2025-03-15
Chạy theo lịch:      python daily_report.py --schedule      (hoặc dùng cron: 0 7 * * *)
"""
import argparse
import logging
import random
import sys
import time
from datetime import date, datetime, timedelta
from email.message import EmailMessage
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent            # Đường dẫn tuyệt đối → chạy đúng dưới cron
REPORT_DIR = BASE_DIR / "daily_reports"
RECIPIENTS = ["sep@example.com"]
DRY_RUN = True

logging.basicConfig(level=logging.INFO, format="%(levelname)-7s %(message)s", stream=sys.stdout)
log = logging.getLogger("daily_report")


def load_orders(day: date) -> pd.DataFrame:
    """Thực tế: pd.read_sql("SELECT ... WHERE ngay = ?", conn) hoặc đọc file export."""
    rng = random.Random(day.toordinal())              # Cùng ngày → cùng dữ liệu (dễ kiểm tra)
    rows = [{
        "gio": rng.randint(8, 21),
        "kenh": rng.choice(["Website", "Shopee", "Cửa hàng"]),
        "tien": rng.randint(1, 40) * 50_000,
        "trang_thai": rng.choices(["Hoàn thành", "Hủy"], weights=[9, 1])[0],
    } for _ in range(rng.randint(150, 250))]
    return pd.DataFrame(rows)


def compute_kpis(df: pd.DataFrame, prev: pd.DataFrame) -> dict:
    done = df[df["trang_thai"] == "Hoàn thành"]
    prev_revenue = prev.loc[prev["trang_thai"] == "Hoàn thành", "tien"].sum()
    revenue = done["tien"].sum()
    return {
        "so_don": len(df),
        "ty_le_huy": (df["trang_thai"] == "Hủy").mean() * 100,
        "doanh_thu": revenue,
        "gia_tri_tb": done["tien"].mean(),
        "so_voi_hom_truoc": (revenue / prev_revenue - 1) * 100 if prev_revenue else 0.0,
        "theo_kenh": done.groupby("kenh")["tien"].sum().sort_values(ascending=False),
        "theo_gio": done.groupby("gio")["tien"].sum(),
    }


def make_chart(kpis: dict, day: date) -> Path:
    fig, ax = plt.subplots(figsize=(8, 3.5))
    (kpis["theo_gio"] / 1e6).plot(kind="bar", ax=ax, color="#4C72B0", rot=0)
    ax.set_title(f"Doanh thu theo giờ - {day:%d/%m/%Y}")
    ax.set_xlabel("Giờ")
    ax.set_ylabel("Triệu đồng")
    fig.tight_layout()
    path = REPORT_DIR / f"chart_{day}.png"
    fig.savefig(path, dpi=100)
    plt.close(fig)
    return path


def write_excel(df: pd.DataFrame, kpis: dict, day: date) -> Path:
    path = REPORT_DIR / f"bao_cao_{day}.xlsx"
    summary = pd.DataFrame({
        "Chỉ số": ["Số đơn", "Tỷ lệ hủy (%)", "Doanh thu", "Giá trị TB/đơn", "So với hôm trước (%)"],
        "Giá trị": [kpis["so_don"], round(kpis["ty_le_huy"], 1), kpis["doanh_thu"],
                    round(kpis["gia_tri_tb"]), round(kpis["so_voi_hom_truoc"], 1)],
    })
    with pd.ExcelWriter(path, engine="openpyxl") as writer:
        summary.to_excel(writer, sheet_name="Tóm tắt", index=False)
        kpis["theo_kenh"].to_excel(writer, sheet_name="Theo kênh")
        df.to_excel(writer, sheet_name="Chi tiết", index=False)
    return path


def build_email(kpis: dict, day: date, files: list[Path]) -> EmailMessage:
    trend = "📈" if kpis["so_voi_hom_truoc"] >= 0 else "📉"
    msg = EmailMessage()
    msg["To"] = ", ".join(RECIPIENTS)
    msg["Subject"] = f"[Báo cáo ngày] {day:%d/%m/%Y} - Doanh thu {kpis['doanh_thu'] / 1e6:,.1f} triệu"
    rows = "".join(f"<li>{k}: {v / 1e6:,.1f} triệu</li>" for k, v in kpis["theo_kenh"].items())
    msg.set_content("Xem bản HTML.")
    msg.add_alternative(
        f"<h2>Báo cáo {day:%d/%m/%Y}</h2>"
        f"<p>Doanh thu: <b>{kpis['doanh_thu']:,}đ</b> {trend} "
        f"{kpis['so_voi_hom_truoc']:+.1f}% so với hôm trước</p><ul>{rows}</ul>",
        subtype="html",
    )
    for f in files:
        msg.add_attachment(f.read_bytes(), maintype="application",
                           subtype="octet-stream", filename=f.name)
    return msg


def run_report(day: date) -> None:
    log.info("Bắt đầu báo cáo ngày %s", day)
    REPORT_DIR.mkdir(exist_ok=True)
    try:
        df = load_orders(day)
        prev = load_orders(day - timedelta(days=1))
        kpis = compute_kpis(df, prev)
        files = [write_excel(df, kpis, day), make_chart(kpis, day)]
        msg = build_email(kpis, day, files)
        log.info("Tiêu đề email: %s", msg["Subject"])
        if DRY_RUN:
            log.info("DRY_RUN: không gửi email, đính kèm %d file", len(files))
        else:
            ...                                       # send_email(msg) như mục 6
        log.info("✅ Hoàn thành (%d đơn, tỷ lệ hủy %.1f%%)", kpis["so_don"], kpis["ty_le_huy"])
    except Exception:
        log.exception("❌ Báo cáo thất bại")          # Ghi cả traceback để debug
        raise                                         # Exit code ≠ 0 → cron/CI biết là lỗi


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Báo cáo doanh số hằng ngày")
    parser.add_argument("--date", help="Ngày cần báo cáo (YYYY-MM-DD), mặc định: hôm qua")
    parser.add_argument("--schedule", action="store_true", help="Chạy mãi, mỗi ngày lúc 07:00")
    args = parser.parse_args(argv)

    if args.schedule:
        import schedule
        schedule.every().day.at("07:00").do(lambda: run_report(date.today() - timedelta(days=1)))
        log.info("Đang chờ tới 07:00 mỗi ngày... (Ctrl+C để dừng)")
        while True:
            schedule.run_pending()
            time.sleep(30)
    else:
        day = datetime.strptime(args.date, "%Y-%m-%d").date() if args.date else \
            date.today() - timedelta(days=1)
        run_report(day)


if __name__ == "__main__":
    main(["--date", "2025-03-15"])                    # Demo. Thực tế: main() đọc từ dòng lệnh
# Output:
# INFO    Bắt đầu báo cáo ngày 2025-03-15
# INFO    Tiêu đề email: [Báo cáo ngày] 15/03/2025 - Doanh thu 147.8 triệu
# INFO    DRY_RUN: không gửi email, đính kèm 2 file
# INFO    ✅ Hoàn thành (163 đơn, tỷ lệ hủy 14.1%)
```

Để chạy tự động lúc 7:00 các ngày trong tuần trên Linux/macOS, thêm vào `crontab -e`:

```bash
0 7 * * 1-5 /home/an/bao-cao/.venv/bin/python /home/an/bao-cao/daily_report.py >> /home/an/bao-cao/cron.log 2>&1
```

## ⚠️ Lỗi thường gặp

### 1. Nạp cả file lớn vào RAM

`f.readlines()`, `list(csv.reader(f))`, `pd.read_csv("50GB.csv")` → `MemoryError`. Dùng **generator** (mục 1), `chunksize`, `usecols` hoặc công cụ chuyên cho dữ liệu lớn (Polars, DuckDB).

### 2. Chained assignment trong pandas

```text
df[df["tuoi"] > 60]["nhom"] = "Cao tuổi"
# ❌ Không sửa gì df gốc! pandas 2.x: SettingWithCopyWarning; pandas 3.x: ChainedAssignmentError

df.loc[df["tuoi"] > 60, "nhom"] = "Cao tuổi"     # ✅ Một bước, với .loc
```

### 3. Mất số 0 đầu / sai kiểu dữ liệu

Mã khách hàng `"00123"`, số điện thoại `"0912..."` bị đọc thành số. Luôn chỉ định `dtype={"cột": str}` khi đọc cột **định danh** (mã, số điện thoại, CMND/CCCD, mã bưu điện).

### 4. Ngày tháng bị hiểu sai

`"05/01/2025"` mặc định có thể bị hiểu là **1 tháng 5** (kiểu Mỹ). Dùng `dayfirst=True` hoặc tốt hơn là `format="%d/%m/%Y"` rõ ràng: `pd.to_datetime(df["ngay"], format="%d/%m/%Y")`.

### 5. File CSV tiếng Việt bị lỗi font khi mở bằng Excel

Excel trên Windows không tự nhận UTF-8. Ghi file bằng `encoding="utf-8-sig"`. Khi **đọc** file do Excel xuất ra mà gặp `UnicodeDecodeError`, thử `encoding="utf-8-sig"` hoặc `encoding="cp1258"` (bảng mã Windows tiếng Việt).

### 6. Quên `plt.close()`

Script vẽ hàng trăm biểu đồ trong vòng lặp mà không `plt.close(fig)` → RAM tăng dần, matplotlib cảnh báo `More than 20 figures have been opened`.

### 7. Dữ liệu scrape rỗng mà không biết

Website đổi giao diện, `soup.select(".price")` trả về `[]`, script vẫn "chạy thành công" và gửi báo cáo trống. Luôn **kiểm tra** (`if not items: raise RuntimeError("Không tìm thấy sản phẩm - HTML đã thay đổi?")`).

### 8. Ghi mật khẩu email vào code

Code bị đẩy lên GitHub → mật khẩu bị lộ trong vài phút (có bot chuyên quét). Dùng **biến môi trường** / `.env` (được liệt kê trong `.gitignore`) - xem [Bài 16](./16-production-ready.md).

### 9. Script chạy tay thì được, chạy bằng cron thì lỗi

Nguyên nhân: cron dùng thư mục làm việc khác, `PATH` khác, không có venv. Dùng **đường dẫn tuyệt đối** cho Python và file dữ liệu (`Path(__file__).resolve().parent`), và ghi log ra file.

## 🏋️ Bài tập

### Bài tập 1 (Dễ): Thống kê điểm thi

Tạo DataFrame điểm thi 20 học sinh (tên, lớp, toán, văn, anh). Tính điểm trung bình, xếp loại (Giỏi ≥ 8, Khá ≥ 6.5, TB ≥ 5, Yếu) bằng `pd.cut`, đếm số học sinh mỗi loại theo lớp (`pd.crosstab`), xuất ra Excel.

### Bài tập 2 (Dễ): Biểu đồ chi tiêu cá nhân

Từ file CSV chi tiêu (ngày, danh mục, số tiền) của một tháng, vẽ: biểu đồ tròn tỷ trọng theo danh mục, biểu đồ cột chi tiêu theo tuần. Lưu vào một file PNG có 2 biểu đồ.

### Bài tập 3 (Trung bình): Gộp nhiều file Excel

Tạo 5 file `chi_nhanh_1.xlsx` ... `chi_nhanh_5.xlsx` (cùng cấu trúc). Viết script dùng `Path.glob("chi_nhanh_*.xlsx")` đọc tất cả, thêm cột "chi nhánh" lấy từ tên file, gộp bằng `pd.concat`, và xuất file tổng hợp có sheet riêng cho mỗi chi nhánh + sheet tổng.

### Bài tập 4 (Trung bình): Làm sạch dữ liệu nâng cao

Mở rộng Ứng dụng 2: chuẩn hóa ngày sinh nhiều định dạng (`15/03/1990`, `1990-03-15`, `15-3-90`), phát hiện trùng lặp **gần đúng** theo tên (bỏ dấu tiếng Việt bằng `unicodedata.normalize("NFD", ...)`), và viết `pytest` cho từng hàm `normalize_*`.

### Bài tập 5 (Khó): Theo dõi giá tự động

Mở rộng Ứng dụng 3: mỗi lần chạy, **lưu lịch sử giá** vào SQLite (Bài 13) với thời gian thu thập. Khi giá của đối thủ **giảm quá 5%** so với lần trước, gửi email cảnh báo (dry-run). Lên lịch chạy mỗi ngày bằng `schedule`. Vẽ biểu đồ đường lịch sử giá của một sản phẩm.

### Bài tập 6 (Khó): Báo cáo tuần dạng pipeline

Viết `weekly_report.py` gồm các bước tách rời: `extract()` (đọc 7 file CSV hằng ngày), `transform()` (làm sạch, tổng hợp), `load()` (Excel + biểu đồ), `notify()` (email). Mỗi bước ghi log thời gian chạy. Nếu một bước lỗi, ghi log và gửi email báo lỗi thay vì báo cáo.

<details>
<summary>💡 Xem đáp án Bài tập 1</summary>

```python
import random

import pandas as pd

rng = random.Random(1)
df = pd.DataFrame({
    "ten": [f"HS{i:02d}" for i in range(1, 21)],
    "lop": [rng.choice(["10A", "10B"]) for _ in range(20)],
    "toan": [rng.randint(30, 100) / 10 for _ in range(20)],
    "van": [rng.randint(30, 100) / 10 for _ in range(20)],
    "anh": [rng.randint(30, 100) / 10 for _ in range(20)],
})
df["tb"] = df[["toan", "van", "anh"]].mean(axis=1).round(2)
df["xep_loai"] = pd.cut(
    df["tb"],
    bins=[0, 5, 6.5, 8, 10.01],                   # Khoảng [0,5), [5,6.5), [6.5,8), [8,10]
    labels=["Yếu", "TB", "Khá", "Giỏi"],
    right=False,
)
print(pd.crosstab(df["lop"], df["xep_loai"]))
df.to_excel("diem_thi.xlsx", index=False)
# Output:
# xep_loai  Yếu  TB  Khá  Giỏi
# lop
# 10A         1   3    3     2
# 10B         1   3    4     3
```

</details>

## ✅ Checklist hoàn thành

- [ ] Xử lý file CSV/JSON Lines lớn bằng generator mà RAM không tăng
- [ ] Tạo `Series`, `DataFrame`; dùng `head`, `info`, `describe`
- [ ] Chọn dữ liệu với `[]`, `loc`, `iloc`; lọc với `&`, `|`, `isin`, `between`, `query`
- [ ] Dùng `read_csv` với `sep`, `thousands`, `parse_dates`, `dayfirst`, `dtype`
- [ ] Tổng hợp với `groupby().agg()`, ghép bảng với `merge`, tạo `pivot_table`
- [ ] Xử lý dữ liệu thiếu (`isna`, `dropna`, `fillna`) và ngày giờ (`to_datetime`, `.dt`, `resample`)
- [ ] Xuất CSV (`utf-8-sig`) và Excel nhiều sheet
- [ ] Vẽ biểu đồ đường, cột, tròn với matplotlib và lưu ra file
- [ ] Tạo file Excel có định dạng, công thức bằng openpyxl
- [ ] Hiểu đạo đức scraping, kiểm tra `robots.txt`, parse HTML bằng BeautifulSoup
- [ ] Soạn email có HTML + đính kèm, biết cách gửi an toàn qua SMTP
- [ ] Lên lịch bằng cron / Task Scheduler / `schedule`
- [ ] Chạy lại được 4 ứng dụng thực tế và hoàn thành ít nhất 3 bài tập

## 🚀 Tiếp theo

Bạn đã có trong tay bộ công cụ để tự động hóa hàng loạt công việc dữ liệu. Nhưng script "chạy được trên máy tôi" và phần mềm **chạy ổn định cho người khác dùng** là hai chuyện khác nhau. Bài cuối cùng sẽ dạy bạn đưa code Python lên **production**: cấu trúc project chuẩn, kiểm tra chất lượng code, test chuyên nghiệp, cấu hình, logging, bảo mật, Docker, CI - và tổng hợp tất cả trong một dự án API hoàn chỉnh.

**Bài tiếp theo**: [Python trong Production](./16-production-ready.md)

---

💡 **Tips nhớ lâu**:

- **File lớn → stream**, đừng nạp hết vào RAM
- **`head` / `info` / `describe` / `isna().sum()`** - bốn câu chào hỏi mọi DataFrame
- **Vector hóa > apply > vòng lặp**
- **`groupby` = SUMIF, `merge` = VLOOKUP, `pivot_table` = PivotTable**
- **pandas tính, openpyxl trang trí**
- **Scrape lịch sự**: robots.txt, delay, User-Agent, không lấy dữ liệu cá nhân
- **Script tự động: đường dẫn tuyệt đối + log + mật khẩu ngoài code**
