# 📚 Bài 11: Thư viện chuẩn thực chiến

## 🎯 Mục tiêu bài học

- Hiểu vì sao Python được gọi là ngôn ngữ **"pin kèm sẵn"** (batteries included) và biết tận dụng thư viện chuẩn trước khi `pip install`
- Viết **biểu thức chính quy (regex)** với module `re`: pattern, group, named group, `findall`, `sub`, `compile`, flags
- Viết regex kiểm tra **email, số điện thoại Việt Nam, ngày tháng** kiểu `dd/mm/yyyy`
- Làm chủ `datetime`: `timedelta`, `strftime`/`strptime`, **múi giờ** với `zoneinfo` (`Asia/Ho_Chi_Minh`), phân biệt **naive** và **aware**
- Dùng **`logging`** thay cho `print`: level, handler, formatter, ghi file, `RotatingFileHandler`, logger theo module
- Dùng **`enum`**: `Enum`, `IntEnum`, `StrEnum`, `auto()`
- Tự động hóa thao tác file với **`pathlib` + `shutil` + `glob`**
- Viết CLI nhiều lệnh con (**subcommands**) với `argparse`
- Đọc cấu hình từ **biến môi trường** (`os.environ`)
- Dùng `textwrap`, `string.Template`, và các module bảo mật: `secrets`, `hashlib`, `hmac`, `uuid`
- Xây 3 chương trình thực tế: **phân tích log web server**, **dọn thư mục Downloads**, **nhắc deadline theo múi giờ**

> 🧠 **Ví dụ dễ hiểu**: Thư viện chuẩn giống **hộp đồ nghề đi kèm khi mua nhà** 🧰. Trước khi chạy ra tiệm mua kìm, búa (cài thư viện ngoài bằng `pip`), hãy mở hộp xem - rất có thể thứ bạn cần đã có sẵn, miễn phí, được bảo trì bởi chính đội ngũ Python và **chạy ở mọi máy có cài Python**.

## 📖 1. Biểu thức chính quy (Regular Expression) với `re`

### Regex là gì? Tại sao cần?

Giả sử bạn cần kiểm tra một chuỗi có phải **số điện thoại** hay không. Không có regex, bạn phải viết:

```python
def is_phone(text: str) -> bool:
    if len(text) != 10:
        return False
    if not text.startswith("0"):
        return False
    return all(ch.isdigit() for ch in text)


print(is_phone("0912345678"), is_phone("09123abc78"))
# Output: True False
```

Còn với regex, chỉ cần **một dòng mô tả "hình dạng"** của chuỗi:

```python
import re

print(bool(re.fullmatch(r"0\d{9}", "0912345678")))
# Output: True
print(bool(re.fullmatch(r"0\d{9}", "09123abc78")))
# Output: False
```

> 🧠 **Ví dụ dễ hiểu**: Regex giống **khuôn bánh** 🍪. Bạn không mô tả từng bước "cắt thế này, nặn thế kia", mà đưa ra **cái khuôn** - chuỗi nào lọt vừa khuôn thì khớp (match). `0\d{9}` nghĩa là: "số 0, theo sau là đúng 9 chữ số".

### Bảng ký hiệu cơ bản

| Ký hiệu | Ý nghĩa | Ví dụ khớp |
| --- | --- | --- |
| `.` | Một ký tự bất kỳ (trừ xuống dòng) | `a.c` → `abc`, `a-c` |
| `\d` | Một chữ số `0-9` | `\d\d` → `42` |
| `\w` | Chữ cái, chữ số hoặc `_` (có cả chữ tiếng Việt!) | `\w+` → `Hà_Nội` |
| `\s` | Khoảng trắng (space, tab, xuống dòng) | `a\sb` → `a b` |
| `\D`, `\W`, `\S` | Ngược lại của `\d`, `\w`, `\s` | `\D` → `x` |
| `[abc]` | Một ký tự trong tập | `[aeiou]` → `e` |
| `[^abc]` | Một ký tự **không** thuộc tập | `[^0-9]` → `x` |
| `[a-z]` | Khoảng ký tự | `[A-Z]` → `Q` |
| `^` / `$` | Đầu / cuối chuỗi | `^Xin` |
| `*` | Lặp 0 lần trở lên | `ab*` → `a`, `abbb` |
| `+` | Lặp 1 lần trở lên | `\d+` → `2026` |
| `?` | 0 hoặc 1 lần (có hoặc không) | `colou?r` → `color`, `colour` |
| `{n}` / `{n,m}` | Đúng n lần / từ n đến m lần | `\d{2,4}` |
| `a\|b` | a **hoặc** b | `cat\|dog` |
| `( )` | Nhóm (group) - để lấy ra hoặc lặp cả cụm | `(ha)+` → `hahaha` |
| `\.` | Dấu chấm thật (escape ký tự đặc biệt) | `\.com` |

### Luôn dùng raw string `r"..."`

Trong chuỗi thường, `\` là ký tự escape (`\n` = xuống dòng). Regex cũng dùng `\` rất nhiều → dễ loạn. Tiền tố `r` bảo Python **"giữ nguyên dấu `\`"**:

```python
print(len("\n"), len(r"\n"))     # "\n" là 1 ký tự xuống dòng, r"\n" là 2 ký tự \ và n
# Output: 1 2
print(r"\d+\.\d+")
# Output: \d+\.\d+
```

### `search`, `match`, `fullmatch` - khác nhau thế nào?

```python
import re

text = "Đơn hàng DH2026 đã giao"

print(re.search(r"DH\d+", text))       # Tìm ở BẤT KỲ đâu trong chuỗi
# Output: <re.Match object; span=(9, 15), match='DH2026'>
print(re.match(r"DH\d+", text))        # Chỉ khớp ở ĐẦU chuỗi
# Output: None
print(re.fullmatch(r"DH\d+", "DH2026"))  # Phải khớp TOÀN BỘ chuỗi
# Output: <re.Match object; span=(0, 6), match='DH2026'>

m = re.search(r"DH\d+", text)
if m:                                   # Luôn kiểm tra None trước khi dùng!
    print(m.group(), m.start(), m.end())
# Output: DH2026 9 15
```

> 💡 **Quy tắc chọn**: **kiểm tra dữ liệu nhập** (validate) → `fullmatch`. **Tìm trong văn bản** → `search`/`findall`.

### Group - "đóng gói" phần cần lấy ra

Dấu ngoặc `( )` đánh dấu phần bạn muốn **trích xuất**:

```python
import re

m = re.search(r"(\d{2})/(\d{2})/(\d{4})", "Hạn nộp: 30/09/2026 lúc 17h")
print(m.group(0))          # Toàn bộ phần khớp
# Output: 30/09/2026
print(m.group(1), m.group(2), m.group(3))
# Output: 30 09 2026
print(m.groups())          # Tuple tất cả group
# Output: ('30', '09', '2026')
```

### Named group - đặt tên cho group

Đếm `group(1)`, `group(2)` rất dễ nhầm. Đặt tên bằng `(?P<ten>...)`:

```python
import re

pattern = r"(?P<day>\d{2})/(?P<month>\d{2})/(?P<year>\d{4})"
m = re.search(pattern, "Sinh nhật: 12/05/2001")
print(m.group("day"), m["month"], m["year"])   # m["..."] là cách viết tắt
# Output: 12 05 2001
print(m.groupdict())
# Output: {'day': '12', 'month': '05', 'year': '2001'}
```

### `findall` và `finditer` - tìm tất cả

```python
import re

text = "Giá: áo 150000đ, quần 250000đ, mũ 50000đ"

print(re.findall(r"\d+", text))              # Không có group → list chuỗi khớp
# Output: ['150000', '250000', '50000']

print(re.findall(r"(\w+) (\d+)đ", text))     # Có group → list tuple các group
# Output: [('áo', '150000'), ('quần', '250000'), ('mũ', '50000')]

total = sum(int(price) for _, price in re.findall(r"(\w+) (\d+)đ", text))
print(f"Tổng: {total:,}đ")
# Output: Tổng: 450,000đ

for m in re.finditer(r"\d+", text):          # finditer trả về từng Match object (tiết kiệm bộ nhớ)
    print(m.group(), "ở vị trí", m.start())
# Output:
# 150000 ở vị trí 8
# 250000 ở vị trí 22
# 50000 ở vị trí 34
```

### `sub` - tìm và thay thế

```python
import re

# Chuẩn hóa khoảng trắng thừa
print(re.sub(r"\s+", " ", "Xin    chào   \t  Python"))
# Output: Xin chào Python

# Dùng group trong chuỗi thay thế: \1, \2 hoặc \g<ten>
print(re.sub(r"(\d{4})-(\d{2})-(\d{2})", r"\3/\2/\1", "Ngày 2026-09-25"))
# Output: Ngày 25/09/2026

# Thay thế bằng HÀM - mạnh nhất: mỗi lần khớp, hàm nhận Match và trả về chuỗi mới
def mask_phone(m: re.Match) -> str:
    phone = m.group()
    return phone[:3] + "****" + phone[-3:]


print(re.sub(r"0\d{9}", mask_phone, "Gọi An 0912345678 hoặc Bình 0987654321"))
# Output: Gọi An 091****678 hoặc Bình 098****321

# split theo nhiều ký tự phân cách
print(re.split(r"[,;|]\s*", "táo, cam;chuối|  xoài"))
# Output: ['táo', 'cam', 'chuối', 'xoài']
```

### `compile` và flags

Khi dùng một pattern **nhiều lần** (ví dụ trong vòng lặp đọc hàng triệu dòng log), hãy `compile` một lần để code gọn và rõ nghĩa:

```python
import re

# re.IGNORECASE (re.I): không phân biệt hoa/thường
ERROR_RE = re.compile(r"error|lỗi", re.IGNORECASE)
lines = ["ERROR: mất kết nối", "Info: ok", "Lỗi: sai mật khẩu", "warning"]
print([line for line in lines if ERROR_RE.search(line)])
# Output: ['ERROR: mất kết nối', 'Lỗi: sai mật khẩu']

# re.MULTILINE (re.M): ^ và $ khớp ở đầu/cuối MỖI DÒNG thay vì cả chuỗi
text = "id: 1\nname: An\nid: 2\nname: Bình"
print(re.findall(r"^id: (\d+)$", text, re.MULTILINE))
# Output: ['1', '2']

# re.VERBOSE (re.X): cho phép xuống dòng + chú thích bên trong pattern → dễ đọc
PRICE_RE = re.compile(
    r"""
    (?P<amount>\d[\d.,]*)   # phần số: 150.000 hoặc 1,5
    \s*
    (?P<unit>k|đ|vnđ)       # đơn vị
    """,
    re.VERBOSE | re.IGNORECASE,     # Kết hợp nhiều flag bằng dấu |
)
print([m.groupdict() for m in PRICE_RE.finditer("Trà sữa 35k, bánh 20.000 VNĐ")])
# Output: [{'amount': '35', 'unit': 'k'}, {'amount': '20.000', 'unit': 'VNĐ'}]
```

### Greedy (tham lam) vs non-greedy

```python
import re

html = "<b>Python</b> và <b>Regex</b>"
print(re.findall(r"<b>(.*)</b>", html))    # .* tham lam: ăn nhiều nhất có thể
# Output: ['Python</b> và <b>Regex']
print(re.findall(r"<b>(.*?)</b>", html))   # .*? không tham lam: dừng sớm nhất có thể
# Output: ['Python', 'Regex']
```

> 🧠 **Ví dụ dễ hiểu**: `.*` giống người ăn buffet **lấy hết khay** rồi mới nhả bớt cho vừa. `.*?` lấy **từng miếng**, vừa đủ là dừng.

### Regex thực tế cho dữ liệu Việt Nam

```python
import re

# Email: phần tên @ tên miền . đuôi (đủ dùng cho validate form, không cần hoàn hảo tuyệt đối)
EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+(\.[\w-]+)*\.[a-zA-Z]{2,}")

# SĐT di động VN: 0 hoặc +84 hoặc 84, rồi đầu số 3/5/7/8/9, rồi 8 chữ số
# Cho phép dấu cách/chấm/gạch ngang giữa các cụm: 0912 345 678, 091.234.5678
PHONE_RE = re.compile(r"(?:\+84|84|0)[\s.-]?(?P<prefix>[35789])(?:[\s.-]?\d){8}")

# Ngày dd/mm/yyyy (kiểm tra hình dạng; kiểm tra ngày có thật hay không thì dùng datetime)
DATE_RE = re.compile(r"(0[1-9]|[12]\d|3[01])/(0[1-9]|1[0-2])/\d{4}")

for email in ["an.nguyen@gmail.com", "binh+shop@cong-ty.com.vn", "sai@", "a@b.c"]:
    print(f"{email:<28} {'✅' if EMAIL_RE.fullmatch(email) else '❌'}")
# Output:
# an.nguyen@gmail.com          ✅
# binh+shop@cong-ty.com.vn     ✅
# sai@                         ❌
# a@b.c                        ❌

for phone in ["0912345678", "+84 912 345 678", "091.234.5678", "0212345678", "091234567"]:
    print(f"{phone:<18} {'✅' if PHONE_RE.fullmatch(phone) else '❌'}")
# Output:
# 0912345678         ✅
# +84 912 345 678    ✅
# 091.234.5678       ✅
# 0212345678         ❌
# 091234567          ❌


def normalize_phone(raw: str) -> str | None:
    """Đưa mọi kiểu viết về dạng chuẩn 0xxxxxxxxx, không hợp lệ thì trả về None."""
    if not PHONE_RE.fullmatch(raw.strip()):
        return None
    digits = re.sub(r"\D", "", raw)          # Bỏ mọi thứ không phải chữ số
    if digits.startswith("84"):
        digits = "0" + digits[2:]
    return digits


print(normalize_phone("+84 912-345-678"), normalize_phone("12345"))
# Output: 0912345678 None

for d in ["25/09/2026", "31/12/2025", "32/01/2026", "15/13/2026"]:
    print(d, bool(DATE_RE.fullmatch(d)))
# Output:
# 25/09/2026 True
# 31/12/2025 True
# 32/01/2026 False
# 15/13/2026 False
```

> ⚠️ Regex `DATE_RE` vẫn chấp nhận `31/02/2026` (tháng 2 không có ngày 31). Regex chỉ kiểm tra **hình dạng**; muốn kiểm tra **ý nghĩa** hãy dùng `datetime.strptime` (phần tiếp theo). Đây là nguyên tắc chung: **regex lọc thô, code kiểm tra tinh**.

### 💡 Tips quan trọng

- Luôn viết pattern bằng **raw string** `r"..."` ✅
- Validate input → `fullmatch`; tìm trong văn bản → `search`/`findall`/`finditer` ✅
- Đặt tên group `(?P<ten>...)` khi có từ 2 group trở lên ✅
- Pattern phức tạp → dùng `re.VERBOSE` + chú thích ✅
- **Đừng dùng regex để parse HTML/JSON** - dùng thư viện chuyên dụng (`json`, `html.parser`, BeautifulSoup) ❌
- Thử regex trực quan tại [regex101.com](https://regex101.com) (chọn flavor **Python**) ✅

## 📖 2. `datetime` nâng cao

### Nhắc lại 4 kiểu chính

| Kiểu | Chứa gì | Ví dụ |
| --- | --- | --- |
| `date` | Ngày | `date(2026, 9, 25)` |
| `time` | Giờ trong ngày | `time(14, 30)` |
| `datetime` | Ngày + giờ | `datetime(2026, 9, 25, 14, 30)` |
| `timedelta` | **Khoảng thời gian** (độ dài) | `timedelta(days=3, hours=2)` |

### `timedelta` - cộng trừ thời gian

```python
from datetime import date, datetime, timedelta

order_time = datetime(2026, 9, 25, 14, 30)
print(order_time + timedelta(days=3))                 # Giao hàng sau 3 ngày
# Output: 2026-09-28 14:30:00
print(order_time - timedelta(hours=36, minutes=15))
# Output: 2026-09-24 02:15:00

# Trừ 2 datetime → được timedelta
deadline = datetime(2026, 10, 1, 17, 0)
remaining = deadline - order_time
print(remaining)
# Output: 6 days, 2:30:00
print(remaining.days, remaining.seconds, remaining.total_seconds())
# Output: 6 9000 527400.0
print(f"Còn {remaining.total_seconds() / 3600:.1f} giờ")
# Output: Còn 146.5 giờ

# Tính tuổi chính xác (chú ý: chưa tới sinh nhật năm nay thì trừ 1)
def age(birthday: date, today: date) -> int:
    had_birthday = (today.month, today.day) >= (birthday.month, birthday.day)
    return today.year - birthday.year - (0 if had_birthday else 1)


print(age(date(2000, 12, 20), date(2026, 9, 25)))
# Output: 25

# Ngày làm việc tiếp theo (bỏ qua thứ 7, chủ nhật) - weekday(): Thứ 2 = 0 ... Chủ nhật = 6
def next_workday(d: date) -> date:
    d += timedelta(days=1)
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d


print(next_workday(date(2026, 9, 25)))    # 25/09/2026 là thứ Sáu
# Output: 2026-09-28
```

> ⚠️ `timedelta` **không có** `months` hay `years` vì tháng dài 28-31 ngày, năm 365-366 ngày - không cố định. Cần "cộng 1 tháng" thì tự xử lý hoặc dùng thư viện `python-dateutil` (`relativedelta`).

### `strftime` và `strptime` - chuyển đổi datetime ↔ chuỗi

- **strftime** = **str**ing **f**rom **time**: datetime → chuỗi (để **hiển thị**)
- **strptime** = **str**ing **p**arse **time**: chuỗi → datetime (để **đọc dữ liệu**)

| Mã | Ý nghĩa | Ví dụ |
| --- | --- | --- |
| `%d` / `%m` / `%Y` / `%y` | Ngày / tháng / năm 4 số / năm 2 số | `25` / `09` / `2026` / `26` |
| `%H` / `%I` / `%M` / `%S` | Giờ 24h / giờ 12h / phút / giây | `14` / `02` / `30` / `05` |
| `%p` | AM/PM | `PM` |
| `%A` / `%a` | Thứ (đầy đủ / viết tắt, tiếng Anh) | `Friday` / `Fri` |
| `%B` / `%b` | Tháng (tiếng Anh) | `September` / `Sep` |
| `%j` | Ngày thứ mấy trong năm | `268` |
| `%z` / `%Z` | Độ lệch múi giờ / tên múi giờ | `+0700` / `+07` |

```python
from datetime import datetime

dt = datetime(2026, 9, 25, 14, 30, 5)
print(dt.strftime("%d/%m/%Y %H:%M"))
# Output: 25/09/2026 14:30
print(dt.strftime("%A, %d %B %Y - %I:%M %p"))
# Output: Friday, 25 September 2026 - 02:30 PM
print(dt.strftime("backup_%Y%m%d_%H%M%S.zip"))   # Tên file sắp xếp đúng thứ tự thời gian
# Output: backup_20260925_143005.zip

# Thứ tiếng Việt: tự ánh xạ (không phụ thuộc cài đặt ngôn ngữ của máy)
THU = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"]
print(f"{THU[dt.weekday()]}, ngày {dt:%d/%m/%Y}")    # f-string hiểu luôn mã định dạng!
# Output: Thứ Sáu, ngày 25/09/2026

# strptime: đọc chuỗi theo đúng khuôn
parsed = datetime.strptime("30/09/2026 08:15", "%d/%m/%Y %H:%M")
print(parsed, type(parsed).__name__)
# Output: 2026-09-30 08:15:00 datetime

# strptime kiểm tra được ngày KHÔNG có thật (điều regex không làm được)
for text in ["28/02/2026", "31/02/2026"]:
    try:
        datetime.strptime(text, "%d/%m/%Y")
        print(text, "✅ hợp lệ")
    except ValueError as error:
        print(text, "❌", error)
# Output:
# 28/02/2026 ✅ hợp lệ
# 31/02/2026 ❌ day is out of range for month

# ISO 8601 - định dạng chuẩn quốc tế, dùng khi lưu file/JSON/API
print(dt.isoformat())
# Output: 2026-09-25T14:30:05
print(datetime.fromisoformat("2026-09-25T14:30:05"))
# Output: 2026-09-25 14:30:05
```

### Naive vs Aware - vấn đề múi giờ

- **Naive** datetime: **không biết** mình thuộc múi giờ nào. `14:30` là 14:30 ở Hà Nội hay ở London? Không ai biết.
- **Aware** datetime: **có gắn múi giờ** (`tzinfo`) → xác định **một thời điểm duy nhất** trên Trái Đất.

> 🧠 **Ví dụ dễ hiểu**: Bạn hẹn bạn ở Mỹ "gọi video lúc 8 giờ tối". Naive là chỉ nói "8 giờ tối" → bạn chờ 8 giờ tối Việt Nam, bạn kia gọi lúc 8 giờ tối ở Mỹ, lệch nhau 11-14 tiếng 😅. Aware là nói "8 giờ tối **giờ Hà Nội**" → không thể nhầm.

Từ Python 3.9, module **`zoneinfo`** có sẵn cơ sở dữ liệu múi giờ IANA:

```python
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

VN = ZoneInfo("Asia/Ho_Chi_Minh")        # Múi giờ Việt Nam (UTC+7)
TOKYO = ZoneInfo("Asia/Tokyo")
NEW_YORK = ZoneInfo("America/New_York")

naive = datetime(2026, 9, 25, 20, 0)
aware = datetime(2026, 9, 25, 20, 0, tzinfo=VN)
print(naive.tzinfo, "|", aware.tzinfo, aware.utcoffset())
# Output: None | Asia/Ho_Chi_Minh 7:00:00
print(aware.isoformat())
# Output: 2026-09-25T20:00:00+07:00

# astimezone: CÙNG một thời điểm, nhìn từ múi giờ khác
print("Tokyo:   ", aware.astimezone(TOKYO))
# Output: Tokyo:    2026-09-25 22:00:00+09:00
print("New York:", aware.astimezone(NEW_YORK))
# Output: New York: 2026-09-25 09:00:00-04:00
print("UTC:     ", aware.astimezone(timezone.utc))
# Output: UTC:      2026-09-25 13:00:00+00:00

# Hai aware datetime ở 2 múi giờ khác nhau nhưng là CÙNG thời điểm → bằng nhau
print(aware == aware.astimezone(NEW_YORK))
# Output: True

# ❌ Không so sánh/trừ được naive với aware
try:
    print(aware - naive)
except TypeError as error:
    print("Lỗi:", error)
# Output: Lỗi: can't subtract offset-naive and offset-aware datetimes

# Gắn múi giờ cho naive datetime đọc từ file: replace(tzinfo=...)
from_csv = datetime.strptime("2026-09-25 08:00", "%Y-%m-%d %H:%M")
print(from_csv.replace(tzinfo=VN))
# Output: 2026-09-25 08:00:00+07:00

# Lấy "bây giờ" có múi giờ (output thay đổi theo thời điểm chạy)
print(datetime.now(VN).strftime("%d/%m/%Y %H:%M %Z"))
# Output (ví dụ): 25/09/2026 14:30 +07
```

> 💡 **Quy tắc vàng trong ứng dụng thật**: **Lưu trữ bằng UTC** (database, log, API) → **chỉ đổi sang giờ địa phương khi hiển thị** cho người dùng. Tránh `datetime.utcnow()` (trả về naive, đã bị đánh dấu deprecated từ 3.12) - dùng `datetime.now(timezone.utc)`.
>
> 🪟 **Windows**: nếu gặp `ZoneInfoNotFoundError`, cài dữ liệu múi giờ: `python -m pip install tzdata`.

### 💡 Tips quan trọng

- Hiển thị → `strftime` / f-string `{dt:%d/%m/%Y}`; đọc chuỗi → `strptime` ✅
- Lưu và trao đổi dữ liệu → **ISO 8601** (`isoformat()` / `fromisoformat()`) ✅
- Ứng dụng có người dùng ở nhiều nơi → **luôn dùng aware datetime**, lưu UTC ✅
- Tên múi giờ dùng dạng `"Châu_lục/Thành_phố"` (`Asia/Ho_Chi_Minh`), đừng tự cộng `+7` giờ bằng tay ❌

## 📖 3. `logging` - Ghi nhật ký chuyên nghiệp

### Tại sao không dùng `print`?

Khi app chạy thật (trên server, chạy nền lúc 3 giờ sáng), không ai ngồi nhìn màn hình. `print` có nhiều hạn chế:

| | `print` | `logging` |
| --- | --- | --- |
| Mức độ nghiêm trọng | ❌ Không có | ✅ DEBUG, INFO, WARNING, ERROR, CRITICAL |
| Thời gian, vị trí | ❌ Tự viết | ✅ Tự động (giờ, module, dòng code) |
| Ghi ra file | ❌ Phải tự mở file | ✅ Cấu hình 1 lần |
| Tắt/bật theo môi trường | ❌ Phải xóa từng dòng | ✅ Đổi 1 dòng cấu hình level |
| Traceback khi lỗi | ❌ | ✅ `logger.exception(...)` |

> 🧠 **Ví dụ dễ hiểu**: `print` giống **hét lên** trong phòng - ai đang ở đó thì nghe, không thì mất. `logging` giống **hộp đen máy bay** ✈️ - ghi lại mọi thứ có giờ giấc, phân loại mức độ, lưu cẩn thận để điều tra khi có sự cố.

### 5 mức độ (level)

| Level | Giá trị | Khi nào dùng |
| --- | --- | --- |
| `DEBUG` | 10 | Chi tiết để gỡ lỗi (giá trị biến, từng bước) - chỉ bật khi dev |
| `INFO` | 20 | Sự kiện bình thường: "Server khởi động", "Đã gửi 30 email" |
| `WARNING` | 30 | Bất thường nhưng vẫn chạy: "Ổ đĩa còn 10%", "API chậm" |
| `ERROR` | 40 | Một thao tác thất bại: "Không gửi được email cho X" |
| `CRITICAL` | 50 | Cả hệ thống gặp nguy: "Mất kết nối database" |

Logger chỉ ghi các message có level **≥ level đã cấu hình**. Mặc định là `WARNING`.

### Bắt đầu nhanh với `basicConfig`

```python
import logging
import sys

logging.basicConfig(
    level=logging.DEBUG,                 # Ghi từ DEBUG trở lên
    format="%(levelname)-8s %(name)s: %(message)s",
    stream=sys.stdout,                   # Mặc định là stderr; ở đây in ra stdout cho dễ thấy
)

logger = logging.getLogger("shop")

logger.debug("Giỏ hàng có %d sản phẩm", 3)
logger.info("Khách %s đặt hàng", "An")
logger.warning("Kho chỉ còn %d chiếc", 2)
logger.error("Thanh toán thất bại cho đơn %s", "DH01")
# Output:
# DEBUG    shop: Giỏ hàng có 3 sản phẩm
# INFO     shop: Khách An đặt hàng
# WARNING  shop: Kho chỉ còn 2 chiếc
# ERROR    shop: Thanh toán thất bại cho đơn DH01

try:
    1 / 0
except ZeroDivisionError:
    logger.exception("Lỗi khi tính giảm giá")   # = error + tự đính kèm traceback
# Output: ERROR    shop: Lỗi khi tính giảm giá
```

> 💡 Viết `logger.info("Khách %s", name)` thay vì `logger.info(f"Khách {name}")`: chuỗi chỉ được ghép **khi message thực sự được ghi**. Với `logger.debug(...)` trong vòng lặp triệu lần mà DEBUG đang tắt → tiết kiệm đáng kể.

### Kiến trúc: Logger → Handler → Formatter

- **Logger**: nơi bạn gọi `.info()`, `.error()`... Mỗi module một logger.
- **Handler**: quyết định log **đi đâu** (màn hình, file, email...). Một logger có thể có nhiều handler.
- **Formatter**: quyết định log **trông thế nào**.

> 🧠 **Ví dụ dễ hiểu**: Logger là **phóng viên** viết tin 📝, Handler là **kênh phát** (báo giấy, TV, website), Formatter là **cách trình bày** của từng kênh. Một tin có thể lên cả báo giấy lẫn TV với hình thức khác nhau.

### Cấu hình đầy đủ: màn hình + file + xoay vòng file

```python
import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path


def setup_logging(log_dir: Path, level: int = logging.INFO) -> None:
    """Gọi MỘT lần ở điểm khởi động chương trình (main)."""
    log_dir.mkdir(parents=True, exist_ok=True)

    root = logging.getLogger()          # Root logger - "tổng đài" nhận log từ mọi logger con
    root.setLevel(logging.DEBUG)        # Cho mọi thứ đi qua, handler sẽ tự lọc

    # Handler 1: màn hình - ngắn gọn, chỉ từ INFO trở lên
    console = logging.StreamHandler(sys.stdout)
    console.setLevel(level)
    console.setFormatter(logging.Formatter("%(levelname)s: %(message)s"))

    # Handler 2: file - chi tiết, ghi cả DEBUG. Mỗi file tối đa 1 MB, giữ 3 file cũ
    file_handler = RotatingFileHandler(
        log_dir / "app.log", maxBytes=1_000_000, backupCount=3, encoding="utf-8"
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(logging.Formatter(
        "%(asctime)s | %(levelname)-8s | %(name)s:%(lineno)d | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    ))

    root.addHandler(console)
    root.addHandler(file_handler)


# Mỗi module tạo logger riêng bằng __name__ → biết log đến từ đâu
logger = logging.getLogger("orders.service")

setup_logging(Path("logs"))
logger.debug("Chi tiết chỉ nằm trong file")
logger.info("Đơn DH01 đã tạo")
logger.warning("Đơn DH02 thiếu địa chỉ")
# Output:
# INFO: Đơn DH01 đã tạo
# WARNING: Đơn DH02 thiếu địa chỉ

content = Path("logs/app.log").read_text(encoding="utf-8")
print(len(content.splitlines()), "dòng trong file; có DEBUG:", "DEBUG" in content)
# Output: 3 dòng trong file; có DEBUG: True
```

Nội dung `logs/app.log` (giờ sẽ khác khi bạn chạy):

```text
2026-09-25 14:30:05 | DEBUG    | orders.service:37 | Chi tiết chỉ nằm trong file
2026-09-25 14:30:05 | INFO     | orders.service:38 | Đơn DH01 đã tạo
2026-09-25 14:30:05 | WARNING  | orders.service:39 | Đơn DH02 thiếu địa chỉ
```

**RotatingFileHandler** hoạt động thế nào? Khi `app.log` vượt 1 MB, nó đổi tên thành `app.log.1` (file `.1` cũ thành `.2`...), rồi tạo `app.log` mới. Nhờ vậy log **không bao giờ đầy ổ đĩa**. Muốn xoay theo thời gian (mỗi ngày một file) thì dùng `TimedRotatingFileHandler(..., when="midnight", backupCount=30)`.

### Logger theo module - cách tổ chức chuẩn

```text
shop/
├── main.py          # setup_logging() gọi ở đây, DUY NHẤT một lần
├── orders.py        # logger = logging.getLogger(__name__)  → tên "shop.orders"
└── payment.py       # logger = logging.getLogger(__name__)  → tên "shop.payment"
```

```python
import logging
import sys

# Trong mỗi module: chỉ lấy logger, KHÔNG cấu hình handler
orders_logger = logging.getLogger("shop.orders")
payment_logger = logging.getLogger("shop.payment")

# Trong main.py: cấu hình một lần
logging.basicConfig(level=logging.INFO, stream=sys.stdout,
                    format="[%(name)s] %(levelname)s %(message)s")

orders_logger.info("Tạo đơn mới")
payment_logger.info("Nhận tiền")

# Tên logger có dấu chấm tạo thành CÂY: có thể chỉnh riêng một nhánh
logging.getLogger("shop.payment").setLevel(logging.WARNING)   # Tắt INFO của payment
payment_logger.info("Dòng này KHÔNG hiện")
orders_logger.info("Orders vẫn hiện INFO")
# Output:
# [shop.orders] INFO Tạo đơn mới
# [shop.payment] INFO Nhận tiền
# [shop.orders] INFO Orders vẫn hiện INFO
```

### 💡 Tips quan trọng

- Trong app/thư viện: **dùng `logging`, không dùng `print`** để báo trạng thái ✅ (`print` chỉ dành cho **kết quả** mà CLI trả cho người dùng)
- `logger = logging.getLogger(__name__)` ở đầu mỗi module ✅
- **Chỉ cấu hình logging ở điểm khởi động** (`main`), không cấu hình trong module/thư viện ❌
- Trong `except`, dùng `logger.exception(...)` để có traceback ✅
- **Không log mật khẩu, token, số thẻ** ❌

## 📖 4. `enum` - Tập hằng số có tên

Bạn đã gặp `Enum` ở Bài 10 (độ ưu tiên công việc). Tại sao không dùng chuỗi `"pending"`, `"paid"`? Vì gõ nhầm `"piad"` Python không báo lỗi - bug âm thầm. Với Enum, gõ nhầm `Status.PIAD` → lỗi ngay.

> 🧠 **Ví dụ dễ hiểu**: Enum giống **thực đơn cố định** 📋 của quán: khách chỉ được chọn món có trong thực đơn, không thể gọi món "tự chế".

```python
from enum import Enum, IntEnum, StrEnum, auto


class OrderStatus(Enum):
    PENDING = "pending"
    PAID = "paid"
    SHIPPED = "shipped"
    CANCELLED = "cancelled"


s = OrderStatus.PAID
print(s, s.name, s.value)
# Output: OrderStatus.PAID PAID paid
print(OrderStatus("shipped"))          # Tra theo VALUE (vd: đọc từ database/JSON)
# Output: OrderStatus.SHIPPED
print(OrderStatus["CANCELLED"])        # Tra theo NAME
# Output: OrderStatus.CANCELLED
print([st.value for st in OrderStatus])   # Duyệt qua tất cả thành viên
# Output: ['pending', 'paid', 'shipped', 'cancelled']
print(s == "paid")                     # ⚠️ Enum thường KHÔNG bằng chuỗi
# Output: False

try:
    OrderStatus("refunded")
except ValueError as error:
    print("Lỗi:", error)
# Output: Lỗi: 'refunded' is not a valid OrderStatus


# auto(): tự sinh giá trị khi bạn không quan tâm giá trị cụ thể
class Color(Enum):
    RED = auto()
    GREEN = auto()


print(Color.RED.value, Color.GREEN.value)
# Output: 1 2


# IntEnum: vừa là Enum vừa là int → so sánh được với số, sắp xếp được
class Priority(IntEnum):
    LOW = 1
    MEDIUM = 2
    HIGH = 3


print(Priority.HIGH > Priority.LOW, Priority.MEDIUM == 2, sorted([3, Priority.LOW]))
# Output: True True [<Priority.LOW: 1>, 3]


# StrEnum (Python 3.11+): vừa là Enum vừa là str → dùng trực tiếp như chuỗi (JSON, API, SQL)
class Role(StrEnum):
    ADMIN = auto()        # Với StrEnum, auto() sinh ra tên viết thường: "admin"
    STAFF = auto()


print(Role.ADMIN == "admin", f"role={Role.STAFF}", Role.ADMIN.upper())
# Output: True role=staff ADMIN


# Enum có thể có method và dùng rất đẹp với match-case
class OrderStatusVN(Enum):
    PENDING = "pending"
    PAID = "paid"

    @property
    def label(self) -> str:
        return {"pending": "⏳ Chờ thanh toán", "paid": "✅ Đã thanh toán"}[self.value]


def next_action(status: OrderStatusVN) -> str:
    match status:
        case OrderStatusVN.PENDING:
            return "Nhắc khách thanh toán"
        case OrderStatusVN.PAID:
            return "Chuyển cho kho đóng gói"


print(OrderStatusVN.PAID.label, "→", next_action(OrderStatusVN.PAID))
# Output: ✅ Đã thanh toán → Chuyển cho kho đóng gói
```

| Loại | Dùng khi |
| --- | --- |
| `Enum` | Mặc định - an toàn nhất, không lẫn với kiểu khác |
| `IntEnum` | Cần so sánh lớn/nhỏ hoặc tương thích với code cũ dùng số |
| `StrEnum` | Giá trị đi ra ngoài dưới dạng chuỗi: JSON, API, cột database |

## 📖 5. Tự động hóa file: `pathlib` + `shutil` + `glob`

Bài 7 đã giới thiệu `pathlib`. Ở đây ta dùng nó cho **tự động hóa**: tìm, sao chép, di chuyển, nén hàng loạt file.

| Module | Vai trò |
| --- | --- |
| `pathlib.Path` | Đường dẫn: ghép, tách tên/đuôi, tạo thư mục, tìm file (`glob`, `rglob`) |
| `shutil` | Thao tác "nặng": copy, move, xóa cả cây thư mục, nén zip |
| `glob` | Tìm file theo mẫu `*.txt` (kiểu cũ, trả về chuỗi; `Path.glob` thường tiện hơn) |

```python
import glob
import shutil
from pathlib import Path

# Tạo dữ liệu mẫu
root = Path("demo_files")
(root / "reports" / "2026").mkdir(parents=True, exist_ok=True)
for name in ["a.txt", "b.csv", "reports/q1.csv", "reports/2026/q3.csv", "reports/note.md"]:
    (root / name).write_text(f"nội dung {name}\n", encoding="utf-8")

# Tách các phần của đường dẫn
p = root / "reports" / "2026" / "q3.csv"
print(p.name, p.stem, p.suffix, p.parent.name)
# Output: q3.csv q3 .csv 2026

# glob: tìm trong 1 thư mục; rglob: tìm ĐỆ QUY mọi thư mục con
print(sorted(f.name for f in root.glob("*.csv")))
# Output: ['b.csv']
print(sorted(f.relative_to(root).as_posix() for f in root.rglob("*.csv")))
# Output: ['b.csv', 'reports/2026/q3.csv', 'reports/q1.csv']

# Module glob (trả về chuỗi), ** + recursive=True để tìm đệ quy
print(len(glob.glob("demo_files/**/*.csv", recursive=True)))
# Output: 3

# shutil: copy2 giữ cả thời gian sửa đổi; copytree chép cả thư mục
backup = Path("backup")
shutil.copytree(root / "reports", backup / "reports", dirs_exist_ok=True)
shutil.copy2(root / "a.txt", backup / "a_copy.txt")
print(sorted(f.relative_to(backup).as_posix() for f in backup.rglob("*") if f.is_file()))
# Output: ['a_copy.txt', 'reports/2026/q3.csv', 'reports/note.md', 'reports/q1.csv']

# move: di chuyển / đổi tên (kể cả sang ổ đĩa khác)
shutil.move(backup / "a_copy.txt", backup / "a_renamed.txt")
print((backup / "a_renamed.txt").exists())
# Output: True

# make_archive: nén cả thư mục thành zip → trả về đường dẫn file zip
zip_path = shutil.make_archive("reports_backup", "zip", root_dir=root / "reports")
print(Path(zip_path).name)
# Output: reports_backup.zip

# Tổng dung lượng thư mục
total = sum(f.stat().st_size for f in root.rglob("*") if f.is_file())
print(f"{total} bytes")
# Output: 118 bytes

# rmtree: xóa CẢ cây thư mục - KHÔNG vào thùng rác, cẩn thận!
shutil.rmtree(backup)
print(backup.exists())
# Output: False
```

> ⚠️ `shutil.rmtree` và `Path.unlink` xóa **vĩnh viễn**. Script tự động hóa nên có chế độ **`--dry-run`** (chạy thử: chỉ in ra sẽ làm gì, không làm thật) - xem ứng dụng thực tế số 2.

## 📖 6. `argparse` nâng cao - Subcommands

Bài 10 đã dùng argparse với subcommands cho Todo CLI. Ở đây ta xem kỹ hơn các kỹ thuật hay dùng: **`set_defaults(func=...)`** để gắn hàm xử lý cho từng lệnh con, **nhóm loại trừ nhau**, `choices`, `type`, và cách **test parser** bằng cách truyền list vào `parse_args`.

> 🧠 **Ví dụ dễ hiểu**: `git` là CLI có subcommand: `git add`, `git commit -m "..."`, `git push`. Mỗi lệnh con có **bộ tham số riêng**, như các quầy khác nhau trong ngân hàng 🏦: quầy gửi tiền cần số tiền, quầy mở thẻ cần CMND.

```python
import argparse
from pathlib import Path


def cmd_backup(args: argparse.Namespace) -> None:
    mode = "nén zip" if args.zip else "sao chép"
    print(f"Backup {args.source} → {args.dest} ({mode}), giữ {args.keep} bản")


def cmd_clean(args: argparse.Namespace) -> None:
    action = "Chạy thử" if args.dry_run else "Xóa thật"
    print(f"{action}: file cũ hơn {args.days} ngày trong {args.folder}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="filetool", description="Công cụ quản lý file")
    parser.add_argument("-v", "--verbose", action="count", default=0,
                        help="Tăng độ chi tiết (-v, -vv)")
    sub = parser.add_subparsers(dest="command", required=True)

    # Lệnh con: backup
    p_backup = sub.add_parser("backup", help="Sao lưu thư mục")
    p_backup.add_argument("source", type=Path)
    p_backup.add_argument("dest", type=Path)
    p_backup.add_argument("--keep", type=int, default=5, help="Số bản giữ lại")
    p_backup.add_argument("--zip", action="store_true")
    p_backup.set_defaults(func=cmd_backup)          # Gắn hàm xử lý cho lệnh này

    # Lệnh con: clean
    p_clean = sub.add_parser("clean", help="Dọn file cũ")
    p_clean.add_argument("folder", type=Path)
    p_clean.add_argument("--days", type=int, choices=[7, 30, 90], default=30)
    group = p_clean.add_mutually_exclusive_group()   # Chỉ được chọn MỘT trong hai
    group.add_argument("--dry-run", action="store_true")
    group.add_argument("--force", action="store_true")
    p_clean.set_defaults(func=cmd_clean)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)   # argv=None → đọc sys.argv thật
    if args.verbose:
        print(f"[verbose={args.verbose}] lệnh = {args.command}")
    args.func(args)                          # Gọi đúng hàm, không cần if/elif dài dòng
    return 0


# Truyền list để thử (và để viết test) thay vì gõ trong terminal
main(["backup", "photos", "/mnt/usb", "--zip", "--keep", "3"])
# Output: Backup photos → /mnt/usb (nén zip), giữ 3 bản
main(["-vv", "clean", "Downloads", "--days", "7", "--dry-run"])
# Output:
# [verbose=2] lệnh = clean
# Chạy thử: file cũ hơn 7 ngày trong Downloads

try:
    main(["clean", "Downloads", "--dry-run", "--force"])   # Vi phạm nhóm loại trừ
except SystemExit as error:
    print("argparse thoát với mã", error.code)             # Thông báo lỗi in ra stderr
# Output: argparse thoát với mã 2
```

Trong file thật, cuối file sẽ là:

```text
if __name__ == "__main__":
    raise SystemExit(main())
```

Và `python filetool.py clean --help` sẽ tự in hướng dẫn cho riêng lệnh `clean`.

## 📖 7. Biến môi trường & cấu hình (`os.environ`)

### Tại sao không viết cứng cấu hình trong code?

```text
# ❌ Mật khẩu nằm trong code → đẩy lên GitHub là lộ!
DB_PASSWORD = "matkhau123"
```

Nguyên tắc **"12-factor app"**: cấu hình (địa chỉ database, API key, chế độ debug...) được truyền vào qua **biến môi trường** - cùng một code chạy ở máy dev, máy test, server thật chỉ khác biến môi trường.

> 🧠 **Ví dụ dễ hiểu**: Code là **chiếc xe**, biến môi trường là **chìa khóa + cài đặt ghế** của từng tài xế. Không ai hàn chết chìa khóa vào xe cả 🔑.

Đặt biến môi trường trong terminal:

```bash
# macOS / Linux
export APP_DEBUG=true
# Windows PowerShell
$env:APP_DEBUG = "true"
```

```python
import os
from dataclasses import dataclass

# Giả lập biến môi trường (thực tế được đặt từ terminal / server / Docker)
os.environ["APP_DEBUG"] = "true"
os.environ["APP_PORT"] = "8080"
os.environ.pop("APP_DB_URL", None)       # Đảm bảo biến này KHÔNG tồn tại để minh họa

print(os.environ["APP_PORT"])            # Truy cập kiểu dict - thiếu thì KeyError
# Output: 8080
print(os.environ.get("APP_DB_URL", "sqlite:///dev.db"))   # Có giá trị mặc định
# Output: sqlite:///dev.db
print(os.getenv("APP_DB_URL"))           # Không có thì trả về None
# Output: None
print(type(os.environ["APP_PORT"]))      # ⚠️ Biến môi trường LUÔN là chuỗi
# Output: <class 'str'>


def env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    debug: bool
    port: int
    db_url: str

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            debug=env_bool("APP_DEBUG"),
            port=int(os.getenv("APP_PORT", "8000")),       # Ép kiểu ngay khi đọc
            db_url=os.getenv("APP_DB_URL", "sqlite:///dev.db"),
        )


settings = Settings.from_env()      # Đọc MỘT lần lúc khởi động, sau đó truyền đi dùng
print(settings)
# Output: Settings(debug=True, port=8080, db_url='sqlite:///dev.db')
```

### File `.env` - tiện khi phát triển

Gõ `export` mỗi lần mở terminal rất mệt. Người ta thường để cấu hình dev trong file `.env` (**nhớ thêm `.env` vào `.gitignore`!**) rồi nạp lúc khởi động. Thư viện phổ biến là `python-dotenv`, nhưng tự viết bản đơn giản cũng chỉ vài dòng:

```python
import os
from pathlib import Path

Path(".env").write_text(
    "# Cấu hình dev - KHÔNG commit file này\nAPI_KEY=abc123\nAPP_NAME=\"Cửa hàng Mini\"\n",
    encoding="utf-8",
)


def load_dotenv(path: str = ".env") -> None:
    """Nạp file .env vào os.environ; biến đã có sẵn thì KHÔNG ghi đè (môi trường thật ưu tiên)."""
    file = Path(path)
    if not file.exists():
        return
    for line in file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_dotenv()
print(os.environ["API_KEY"], "|", os.environ["APP_NAME"])
# Output: abc123 | Cửa hàng Mini
```

> 💡 Thứ tự ưu tiên chuẩn: **tham số dòng lệnh > biến môi trường > file `.env`/config > giá trị mặc định trong code**.

## 📖 8. `textwrap` và `string` - Xử lý văn bản

```python
import string
import textwrap

long_text = ("Python là ngôn ngữ lập trình bậc cao, dễ đọc, dễ học và được dùng "
             "rộng rãi trong web, dữ liệu, AI và tự động hóa.")

# wrap/fill: ngắt dòng theo độ rộng (không cắt đôi từ)
print(textwrap.fill(long_text, width=40))
# Output:
# Python là ngôn ngữ lập trình bậc cao, dễ
# đọc, dễ học và được dùng rộng rãi trong
# web, dữ liệu, AI và tự động hóa.

# shorten: rút gọn kèm dấu "..." - hợp để hiển thị preview
print(textwrap.shorten(long_text, width=45, placeholder="..."))
# Output: Python là ngôn ngữ lập trình bậc cao, dễ...

# indent: thụt lề mọi dòng
print(textwrap.indent("dòng 1\ndòng 2", prefix="  > "))
# Output:
#   > dòng 1
#   > dòng 2

# dedent: bỏ thụt lề chung - hữu ích với chuỗi nhiều dòng viết trong hàm
def usage() -> str:
    return textwrap.dedent("""\
        Cách dùng:
          app run
          app stop""")


print(usage())
# Output:
# Cách dùng:
#   app run
#   app stop

# string.Template: chèn biến an toàn với $ten - hợp cho mẫu do NGƯỜI DÙNG soạn
# (f-string/format có thể truy cập thuộc tính object → không an toàn với mẫu từ bên ngoài)
email_tpl = string.Template("Chào $name, đơn $order_id của bạn trị giá ${total}đ.")
print(email_tpl.substitute(name="An", order_id="DH01", total="250,000"))
# Output: Chào An, đơn DH01 của bạn trị giá 250,000đ.
print(email_tpl.safe_substitute(name="Bình"))      # Thiếu biến → giữ nguyên, không báo lỗi
# Output: Chào Bình, đơn $order_id của bạn trị giá ${total}đ.

# Hằng số tiện dụng
print(string.ascii_uppercase[:5], string.digits, len(string.punctuation))
# Output: ABCDE 0123456789 32
```

## 📖 9. Bảo mật & định danh: `secrets`, `hashlib`, `hmac`, `uuid`

### `secrets` vs `random`

`random` dùng thuật toán **dự đoán được** - tốt cho game, mô phỏng. Với **mật khẩu, token, mã OTP** phải dùng `secrets` (sinh số ngẫu nhiên an toàn mật mã).

> 🧠 **Ví dụ dễ hiểu**: `random` giống **xáo bài theo một công thức** - ai biết công thức và điểm bắt đầu thì đoán được lá tiếp theo. `secrets` giống **tung xúc xắc thật** 🎲 - không ai đoán được.

```python
import secrets
import string

print(len(secrets.token_hex(16)))          # 16 byte → 32 ký tự hex (API key, token)
# Output: 32
print(len(secrets.token_urlsafe(32)) >= 40)  # An toàn để đặt trong URL (link reset mật khẩu)
# Output: True

otp = "".join(secrets.choice(string.digits) for _ in range(6))
print(len(otp), otp.isdigit())             # Mã OTP 6 số
# Output: 6 True


def generate_password(length: int = 12) -> str:
    """Mật khẩu ngẫu nhiên có đủ chữ thường, chữ hoa, số, ký tự đặc biệt."""
    alphabet = string.ascii_letters + string.digits + "!@#$%&*"
    while True:
        pwd = "".join(secrets.choice(alphabet) for _ in range(length))
        if (any(c.islower() for c in pwd) and any(c.isupper() for c in pwd)
                and any(c.isdigit() for c in pwd) and any(c in "!@#$%&*" for c in pwd)):
            return pwd


print(len(generate_password(16)))
# Output: 16
```

### `hashlib` - "Dấu vân tay" của dữ liệu

Hàm băm (hash) biến dữ liệu bất kỳ thành một chuỗi độ dài cố định. Cùng đầu vào → cùng kết quả; đổi 1 ký tự → kết quả khác hoàn toàn; **không thể đảo ngược**.

```python
import hashlib
from pathlib import Path

print(hashlib.sha256(b"xin chao").hexdigest()[:16])
# Output: f9b197ffdaa45e4f
print(hashlib.sha256(b"xin chao!").hexdigest()[:16])     # Chỉ thêm "!" → khác hẳn
# Output: 67fac6d42ab901bd
print(hashlib.sha256("xin chào".encode("utf-8")).hexdigest() == hashlib.sha256("xin chào".encode()).hexdigest())
# Output: True


# Ứng dụng 1: kiểm tra file tải về có bị hỏng/bị sửa không (checksum), đọc từng khúc để file lớn không tốn RAM
def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


Path("data.bin").write_bytes(b"A" * 100_000)
print(file_sha256(Path("data.bin"))[:16])
# Output: e6631225e83d23bf

# Ứng dụng 2: băm mật khẩu - dùng thuật toán CHẬM có muối (salt), KHÔNG dùng sha256 trực tiếp
import hmac
import secrets


def hash_password(password: str, salt: bytes | None = None) -> tuple[bytes, bytes]:
    salt = salt or secrets.token_bytes(16)       # Muối ngẫu nhiên: 2 người cùng mật khẩu vẫn khác hash
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 200_000)
    return salt, digest


def verify_password(password: str, salt: bytes, expected: bytes) -> bool:
    _, digest = hash_password(password, salt)
    return hmac.compare_digest(digest, expected)  # So sánh "thời gian hằng" - chống tấn công đo giờ


salt, stored = hash_password("MatKhau@2026")
print(verify_password("MatKhau@2026", salt, stored), verify_password("sai", salt, stored))
# Output: True False
```

> ⚠️ Các giá trị hash trong ví dụ đầu được rút gọn 16 ký tự cho dễ đọc. Hãy chạy thử để thấy chuỗi đầy đủ 64 ký tự.

### `uuid` - Mã định danh duy nhất toàn cầu

```python
import uuid

order_id = uuid.uuid4()                  # Ngẫu nhiên - gần như không bao giờ trùng
print(len(str(order_id)), str(order_id).count("-"), order_id.version)
# Output: 36 4 4

# uuid5: TẤT ĐỊNH - cùng namespace + tên → luôn cùng UUID (hữu ích để tạo ID ổn định từ email, URL)
print(uuid.uuid5(uuid.NAMESPACE_URL, "https://example.com/san-pham/1"))
# Output: ff6fa10f-cbce-5e71-a6b0-22da5252b4a0
print(uuid.UUID("12345678-1234-5678-1234-567812345678").hex)
# Output: 12345678123456781234567812345678
```

> 💡 Dùng `uuid4` làm ID khi dữ liệu được tạo ở **nhiều nơi** (nhiều server, app offline) mà không muốn tranh nhau số tự tăng `1, 2, 3...`. Ngoài ra ID ngẫu nhiên không để lộ "shop đã có bao nhiêu đơn hàng".

## 🌍 Ứng dụng thực tế

### Ứng dụng 1: Phân tích log web server → báo cáo

Web server (Nginx/Apache) ghi mỗi request thành một dòng log theo định dạng "combined". Nhiệm vụ: đọc log, dùng **regex** tách từng trường, dùng **`Counter`** thống kê, in báo cáo **top IP**, **mã lỗi**, **URL lỗi nhiều nhất**, và phát hiện IP có dấu hiệu dò mật khẩu.

```python
"""log_report.py - Phân tích access log của web server."""

import logging
import re
import sys
from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

logger = logging.getLogger("log_report")

LOG_RE = re.compile(
    r"""
    (?P<ip>\d{1,3}(?:\.\d{1,3}){3})\s-\s\S+\s     # IP, dấu -, user
    \[(?P<time>[^\]]+)\]\s                        # [25/Sep/2026:10:00:01 +0700]
    "(?P<method>[A-Z]+)\s(?P<path>\S+)\s[^"]*"\s   # "GET /index.html HTTP/1.1"
    (?P<status>\d{3})\s(?P<size>\d+|-)            # 200 5120
    """,
    re.VERBOSE,
)


@dataclass
class Request:
    ip: str
    time: datetime
    method: str
    path: str
    status: int
    size: int


def parse_line(line: str) -> Request | None:
    m = LOG_RE.match(line)
    if not m:
        return None
    return Request(
        ip=m["ip"],
        time=datetime.strptime(m["time"], "%d/%b/%Y:%H:%M:%S %z"),   # Có %z → aware datetime
        method=m["method"],
        path=m["path"].split("?")[0],         # Bỏ query string
        status=int(m["status"]),
        size=0 if m["size"] == "-" else int(m["size"]),
    )


def analyze(path: Path) -> None:
    requests: list[Request] = []
    with path.open(encoding="utf-8") as f:
        for lineno, line in enumerate(f, start=1):
            req = parse_line(line)
            if req is None:
                logger.warning("Bỏ qua dòng %d không đúng định dạng", lineno)
                continue
            requests.append(req)

    ip_counter = Counter(r.ip for r in requests)
    status_counter = Counter(r.status for r in requests)
    error_paths = Counter(r.path for r in requests if r.status >= 400)
    failed_logins = Counter(r.ip for r in requests if r.path == "/login" and r.status == 401)
    total_mb = sum(r.size for r in requests) / 1024 / 1024
    start, end = min(r.time for r in requests), max(r.time for r in requests)

    print("📊 BÁO CÁO TRUY CẬP")
    print(f"   Khoảng thời gian: {start:%d/%m/%Y %H:%M} → {end:%H:%M} ({len(requests)} request)")
    print(f"   Dung lượng trả về: {total_mb:.2f} MB")
    print("🏆 Top 3 IP:")
    for ip, count in ip_counter.most_common(3):
        print(f"   {ip:<15} {count:>3} request")
    print("📈 Mã trạng thái:")
    for status, count in sorted(status_counter.items()):
        bar = "█" * count
        print(f"   {status} {bar} {count}")
    error_rate = sum(c for s, c in status_counter.items() if s >= 400) / len(requests)
    print(f"❗ Tỷ lệ lỗi: {error_rate:.0%}")
    print("🔍 URL lỗi nhiều nhất:", error_paths.most_common(2))
    suspects = [ip for ip, n in failed_logins.items() if n >= 3]
    print("🚨 Nghi dò mật khẩu (≥3 lần 401 ở /login):", suspects or "không có")


def make_sample_log(path: Path) -> None:
    rows = [
        ('113.160.1.10', '10:00:01', 'GET /', 200, 5120),
        ('113.160.1.10', '10:00:02', 'GET /static/app.css', 200, 20480),
        ('42.118.7.7', '10:01:00', 'POST /login', 401, 310),
        ('42.118.7.7', '10:01:02', 'POST /login', 401, 310),
        ('42.118.7.7', '10:01:04', 'POST /login', 401, 310),
        ('42.118.7.7', '10:01:06', 'POST /login', 401, 310),
        ('27.72.100.5', '10:02:00', 'GET /san-pham?page=2', 200, 8192),
        ('27.72.100.5', '10:02:30', 'GET /anh/logo.png', 404, 153),
        ('113.160.1.10', '10:03:00', 'GET /anh/logo.png', 404, 153),
        ('14.161.2.2', '10:04:00', 'GET /api/don-hang', 500, 0),
        ('113.160.1.10', '10:05:00', 'GET /gio-hang', 200, 4096),
    ]
    lines = [
        f'{ip} - - [25/Sep/2026:{t} +0700] "{req} HTTP/1.1" {st} {size} "-" "Mozilla/5.0"'
        for ip, t, req, st, size in rows
    ]
    lines.insert(5, "dòng rác do lỗi ghi log")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, stream=sys.stdout, format="%(levelname)s: %(message)s")
    log_file = Path("access.log")
    make_sample_log(log_file)          # Thực tế: đọc /var/log/nginx/access.log
    analyze(log_file)
# Output:
# WARNING: Bỏ qua dòng 6 không đúng định dạng
# 📊 BÁO CÁO TRUY CẬP
#    Khoảng thời gian: 25/09/2026 10:00 → 10:05 (11 request)
#    Dung lượng trả về: 0.04 MB
# 🏆 Top 3 IP:
#    113.160.1.10      4 request
#    42.118.7.7        4 request
#    27.72.100.5       2 request
# 📈 Mã trạng thái:
#    200 ████ 4
#    401 ████ 4
#    404 ██ 2
#    500 █ 1
# ❗ Tỷ lệ lỗi: 64%
# 🔍 URL lỗi nhiều nhất: [('/login', 4), ('/anh/logo.png', 2)]
# 🚨 Nghi dò mật khẩu (≥3 lần 401 ở /login): ['42.118.7.7']
```

> 💡 **Tại sao dùng `LOG_RE.match` từng dòng thay vì đọc cả file rồi `findall`?** Vì log thật có thể nặng hàng GB - đọc từng dòng (như generator ở Bài 9) chỉ tốn bộ nhớ cho một dòng tại một thời điểm, và ta còn biết được **dòng nào** hỏng để ghi warning.

### Ứng dụng 2: Tự động sắp xếp thư mục Downloads

Thư mục Downloads lộn xộn đủ loại file? Script sau phân loại file vào thư mục con theo đuôi file, **không ghi đè** file trùng tên, có chế độ **`--dry-run`** và ghi log.

```python
"""organize.py - Sắp xếp file trong một thư mục theo loại.

Cách dùng:  python organize.py ~/Downloads --dry-run
            python organize.py ~/Downloads
"""

import argparse
import logging
import shutil
import sys
from collections import Counter
from pathlib import Path

logger = logging.getLogger("organize")

CATEGORIES: dict[str, set[str]] = {
    "Ảnh": {".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic"},
    "Tài liệu": {".pdf", ".docx", ".doc", ".txt", ".md", ".pptx"},
    "Bảng tính": {".xlsx", ".xls", ".csv"},
    "Nén": {".zip", ".rar", ".7z", ".tar", ".gz"},
    "Video": {".mp4", ".mkv", ".mov"},
    "Nhạc": {".mp3", ".wav", ".flac"},
    "Cài đặt": {".exe", ".msi", ".dmg", ".deb"},
}
# Đảo ngược thành dict tra nhanh: ".jpg" → "Ảnh"
EXT_TO_CATEGORY = {ext: cat for cat, exts in CATEGORIES.items() for ext in exts}


def unique_destination(dest: Path) -> Path:
    """Nếu 'a.pdf' đã tồn tại → thử 'a (1).pdf', 'a (2).pdf'..."""
    candidate = dest
    counter = 1
    while candidate.exists():
        candidate = dest.with_name(f"{dest.stem} ({counter}){dest.suffix}")
        counter += 1
    return candidate


def organize(folder: Path, dry_run: bool = False) -> Counter:
    stats: Counter = Counter()
    for item in sorted(folder.iterdir()):
        if not item.is_file() or item.name.startswith("."):
            continue                                   # Bỏ qua thư mục và file ẩn
        category = EXT_TO_CATEGORY.get(item.suffix.lower(), "Khác")
        target = unique_destination(folder / category / item.name)
        if dry_run:
            print(f"[dry-run] {item.name} → {category}/{target.name}")
        else:
            target.parent.mkdir(exist_ok=True)
            shutil.move(item, target)
            logger.info("Đã chuyển %s → %s/%s", item.name, category, target.name)
        stats[category] += 1
    return stats


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Sắp xếp file theo loại")
    parser.add_argument("folder", type=Path)
    parser.add_argument("--dry-run", action="store_true", help="Chỉ hiển thị, không di chuyển")
    args = parser.parse_args(argv)

    if not args.folder.is_dir():
        logger.error("Không tìm thấy thư mục: %s", args.folder)
        return 1
    stats = organize(args.folder, dry_run=args.dry_run)
    summary = ", ".join(f"{cat}: {n}" for cat, n in stats.most_common())
    print(f"📦 Tổng cộng {sum(stats.values())} file ({summary})")
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, stream=sys.stdout, format="%(message)s")
    # Tạo thư mục mẫu để thử an toàn (thực tế: main() đọc tham số từ dòng lệnh)
    demo = Path("Downloads_demo")
    demo.mkdir(exist_ok=True)
    for name in ["hoa-don.pdf", "anh-cuoi.JPG", "bao-cao.xlsx", "setup.exe",
                 "nhac.mp3", "ghi-chu.txt", "du-lieu.csv", "la.xyz"]:
        (demo / name).write_text("demo", encoding="utf-8")
    (demo / "Tài liệu").mkdir(exist_ok=True)
    (demo / "Tài liệu" / "hoa-don.pdf").write_text("bản cũ", encoding="utf-8")

    main([str(demo), "--dry-run"])
    print("-" * 40)
    main([str(demo)])
    print(sorted(p.relative_to(demo).as_posix() for p in demo.rglob("*") if p.is_file())[:3])
# Output:
# [dry-run] anh-cuoi.JPG → Ảnh/anh-cuoi.JPG
# [dry-run] bao-cao.xlsx → Bảng tính/bao-cao.xlsx
# [dry-run] du-lieu.csv → Bảng tính/du-lieu.csv
# [dry-run] ghi-chu.txt → Tài liệu/ghi-chu.txt
# [dry-run] hoa-don.pdf → Tài liệu/hoa-don (1).pdf
# [dry-run] la.xyz → Khác/la.xyz
# [dry-run] nhac.mp3 → Nhạc/nhac.mp3
# [dry-run] setup.exe → Cài đặt/setup.exe
# 📦 Tổng cộng 8 file (Bảng tính: 2, Tài liệu: 2, Ảnh: 1, Khác: 1, Nhạc: 1, Cài đặt: 1)
# ----------------------------------------
# Đã chuyển anh-cuoi.JPG → Ảnh/anh-cuoi.JPG
# Đã chuyển bao-cao.xlsx → Bảng tính/bao-cao.xlsx
# Đã chuyển du-lieu.csv → Bảng tính/du-lieu.csv
# Đã chuyển ghi-chu.txt → Tài liệu/ghi-chu.txt
# Đã chuyển hoa-don.pdf → Tài liệu/hoa-don (1).pdf
# Đã chuyển la.xyz → Khác/la.xyz
# Đã chuyển nhac.mp3 → Nhạc/nhac.mp3
# Đã chuyển setup.exe → Cài đặt/setup.exe
# 📦 Tổng cộng 8 file (Bảng tính: 2, Tài liệu: 2, Ảnh: 1, Khác: 1, Nhạc: 1, Cài đặt: 1)
# ['Bảng tính/bao-cao.xlsx', 'Bảng tính/du-lieu.csv', 'Cài đặt/setup.exe']
```

> 💡 Lưu ý `item.suffix.lower()`: file `anh-cuoi.JPG` (đuôi viết hoa, hay gặp với ảnh chụp từ điện thoại) vẫn được nhận là ảnh. Và nhờ `unique_destination`, `hoa-don.pdf` mới **không ghi đè** bản cũ đã có trong `Tài liệu/`.

### Ứng dụng 3: Nhắc lịch/deadline theo múi giờ

Nhóm làm việc từ xa: bạn ở Việt Nam, đồng nghiệp ở Tokyo và Berlin. Deadline lưu bằng **UTC**, mỗi người thấy giờ **của mình**, và chương trình phân loại deadline: quá hạn, sắp tới (trong 24h), còn xa.

```python
"""deadlines.py - Nhắc deadline cho nhóm làm việc ở nhiều múi giờ."""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import StrEnum
from zoneinfo import ZoneInfo


class Urgency(StrEnum):
    OVERDUE = "🔴 Quá hạn"
    SOON = "🟡 Sắp tới"
    LATER = "🟢 Còn xa"


@dataclass
class Deadline:
    title: str
    due_utc: datetime              # LUÔN lưu bằng UTC (aware)

    @classmethod
    def from_local(cls, title: str, local_text: str, tz_name: str) -> "Deadline":
        """Người dùng nhập giờ theo múi giờ của HỌ → đổi về UTC để lưu."""
        naive = datetime.strptime(local_text, "%d/%m/%Y %H:%M")
        local = naive.replace(tzinfo=ZoneInfo(tz_name))
        return cls(title, local.astimezone(timezone.utc))

    def urgency(self, now: datetime) -> Urgency:
        left = self.due_utc - now
        if left < timedelta(0):
            return Urgency.OVERDUE
        if left <= timedelta(hours=24):
            return Urgency.SOON
        return Urgency.LATER


def humanize(delta: timedelta) -> str:
    """timedelta → 'còn 1 ngày 3 giờ' / 'trễ 2 giờ 15 phút'."""
    seconds = int(delta.total_seconds())
    prefix = "còn" if seconds >= 0 else "trễ"
    seconds = abs(seconds)
    days, seconds = divmod(seconds, 86_400)
    hours, seconds = divmod(seconds, 3_600)
    minutes = seconds // 60
    parts = [f"{days} ngày"] if days else []
    parts += [f"{hours} giờ"] if hours else []
    parts += [f"{minutes} phút"] if minutes and not days else []
    return f"{prefix} {' '.join(parts) or 'dưới 1 phút'}"


def report(deadlines: list[Deadline], viewer_tz: str, now: datetime) -> None:
    tz = ZoneInfo(viewer_tz)
    print(f"📅 Lịch của bạn ({viewer_tz}) - bây giờ: {now.astimezone(tz):%d/%m %H:%M}")
    for d in sorted(deadlines, key=lambda d: d.due_utc):
        local_due = d.due_utc.astimezone(tz)
        print(f"   {d.urgency(now)}  {d.title:<22} {local_due:%a %d/%m %H:%M}  ({humanize(d.due_utc - now)})")


deadlines = [
    Deadline.from_local("Nộp báo cáo tháng", "25/09/2026 17:00", "Asia/Ho_Chi_Minh"),
    Deadline.from_local("Review code sprint", "26/09/2026 10:00", "Asia/Tokyo"),
    Deadline.from_local("Demo cho khách", "30/09/2026 09:00", "Europe/Berlin"),
    Deadline.from_local("Gửi hợp đồng", "25/09/2026 09:00", "Asia/Ho_Chi_Minh"),
]
print("Lưu trong DB:", deadlines[1].due_utc.isoformat())

# Cố định "bây giờ" để kết quả lặp lại được (thực tế: datetime.now(timezone.utc))
now = datetime(2026, 9, 25, 14, 30, tzinfo=ZoneInfo("Asia/Ho_Chi_Minh"))
report(deadlines, "Asia/Ho_Chi_Minh", now)
report(deadlines, "Europe/Berlin", now)
# Output:
# Lưu trong DB: 2026-09-26T01:00:00+00:00
# 📅 Lịch của bạn (Asia/Ho_Chi_Minh) - bây giờ: 25/09 14:30
#    🔴 Quá hạn  Gửi hợp đồng           Fri 25/09 09:00  (trễ 5 giờ 30 phút)
#    🟡 Sắp tới  Nộp báo cáo tháng      Fri 25/09 17:00  (còn 2 giờ 30 phút)
#    🟡 Sắp tới  Review code sprint     Sat 26/09 08:00  (còn 17 giờ 30 phút)
#    🟢 Còn xa  Demo cho khách         Wed 30/09 14:00  (còn 4 ngày 23 giờ)
# 📅 Lịch của bạn (Europe/Berlin) - bây giờ: 25/09 09:30
#    🔴 Quá hạn  Gửi hợp đồng           Fri 25/09 04:00  (trễ 5 giờ 30 phút)
#    🟡 Sắp tới  Nộp báo cáo tháng      Fri 25/09 12:00  (còn 2 giờ 30 phút)
#    🟡 Sắp tới  Review code sprint     Sat 26/09 03:00  (còn 17 giờ 30 phút)
#    🟢 Còn xa  Demo cho khách         Wed 30/09 09:00  (còn 4 ngày 23 giờ)
```

> 💡 Để ý: "Review code sprint" được nhập là **10:00 giờ Tokyo** → lưu thành **01:00 UTC** → người Việt Nam thấy **08:00**, người Berlin thấy **03:00**. Cùng một thời điểm, ba cách hiển thị - và "còn bao lâu" thì **giống hệt nhau** với mọi người. Đó là sức mạnh của aware datetime.

## ⚠️ Lỗi thường gặp

### 1. Quên raw string trong regex

```python
import re

print(re.findall("\bcat\b", "cat catalog"))    # ❌ "\b" trong chuỗi thường là ký tự backspace!
# Output: []
print(re.findall(r"\bcat\b", "cat catalog"))   # ✅ \b = ranh giới từ
# Output: ['cat']
```

### 2. Dùng kết quả `re.search` mà không kiểm tra `None`

```python
import re

m = re.search(r"\d+", "không có số")
try:
    print(m.group())
except AttributeError as error:
    print("Lỗi:", error)
# Output: Lỗi: 'NoneType' object has no attribute 'group'
```

✅ Luôn viết `if m:` trước khi dùng, hoặc dùng walrus: `if (m := re.search(...)):`.

### 3. Nhầm `re.match` với `re.fullmatch` khi validate

`re.match(r"\d{3}", "123abc")` **khớp** (vì chỉ kiểm tra phần đầu) → dữ liệu rác lọt qua. Validate phải dùng `fullmatch`.

### 4. Nhầm `%m` (tháng) và `%M` (phút)

```python
from datetime import datetime

dt = datetime(2026, 9, 25, 14, 5)
print(dt.strftime("%d/%M/%Y"), "vs", dt.strftime("%d/%m/%Y"))
# Output: 25/05/2026 vs 25/09/2026
```

### 5. Trộn naive và aware datetime

`TypeError: can't compare offset-naive and offset-aware datetimes` → thống nhất: mọi datetime trong app đều aware (gắn `tzinfo` ngay khi đọc vào).

### 6. Cấu hình logging nhiều lần → log bị in lặp

Gọi `logger.addHandler(...)` ở cấp module (mỗi lần import lại thêm handler) hoặc trong hàm được gọi nhiều lần → mỗi dòng log in ra 2, 3 lần. ✅ Chỉ cấu hình **một lần** trong `main()`.

### 7. `logging.basicConfig` "không có tác dụng"

`basicConfig` **không làm gì** nếu root logger đã có handler (ví dụ một thư viện đã cấu hình trước). Dùng `logging.basicConfig(..., force=True)` để ghi đè.

### 8. Quên biến môi trường là chuỗi

```python
import os

os.environ["DEBUG"] = "False"
print(bool(os.environ["DEBUG"]))      # ❌ Chuỗi không rỗng luôn là True!
# Output: True
print(os.environ["DEBUG"].lower() in {"1", "true", "yes"})   # ✅
# Output: False
```

### 9. Dùng `random` cho mật khẩu/token, hoặc băm mật khẩu bằng `sha256` trần

❌ `random.choice` dự đoán được; `sha256(password)` quá nhanh → kẻ tấn công thử hàng tỷ mật khẩu/giây. ✅ `secrets` + `hashlib.pbkdf2_hmac` có salt (hoặc thư viện `argon2-cffi`, `bcrypt`).

## 🏋️ Bài tập

### Bài tập 1 (Dễ): Trích xuất thông tin liên hệ

Cho một đoạn văn bản (ví dụ nội dung email). Viết hàm `extract_contacts(text)` trả về dict `{"emails": [...], "phones": [...]}`, số điện thoại được chuẩn hóa về dạng `0xxxxxxxxx` và không trùng lặp.

### Bài tập 2 (Dễ): Đếm ngược

Viết hàm `countdown(target: str)` nhận ngày dạng `"dd/mm/yyyy"`, in ra "Còn X ngày nữa đến Tết" (hoặc "Đã qua X ngày"). Xử lý ngày nhập sai (`31/02/2026`) bằng thông báo thân thiện.

### Bài tập 3 (Trung bình): Đổi tên ảnh hàng loạt

Viết script đổi tên mọi file `.jpg/.png` trong thư mục thành `YYYYMMDD_HHMMSS_<số thứ tự>.jpg` dựa trên thời gian sửa đổi (`path.stat().st_mtime` → `datetime.fromtimestamp`). Có `--dry-run`, ghi log ra file `rename.log` bằng `RotatingFileHandler`.

### Bài tập 4 (Trung bình): Tìm file trùng lặp

Duyệt đệ quy một thư mục, nhóm các file có **cùng SHA-256** (gợi ý: lọc trước theo kích thước file cho nhanh), in ra các nhóm trùng và tổng dung lượng có thể giải phóng.

### Bài tập 5 (Khó): CLI quản lý log

Viết CLI `logtool` với subcommands:

- `logtool stats access.log --top 5` → top IP, top URL
- `logtool errors access.log --since "25/09/2026 10:00" --tz Asia/Ho_Chi_Minh` → chỉ các request lỗi từ thời điểm đó
- `logtool export access.log --format csv -o out.csv` → xuất ra CSV

Dùng `StrEnum` cho `--format` (`csv`, `json`), cấu hình mức log qua biến môi trường `LOGTOOL_LEVEL`.

<details>
<summary>💡 Xem đáp án Bài tập 1</summary>

```python
import re

EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[a-zA-Z]{2,}")
PHONE_RE = re.compile(r"(?:\+84|84|0)[\s.-]?[35789](?:[\s.-]?\d){8}")


def extract_contacts(text: str) -> dict[str, list[str]]:
    emails = list(dict.fromkeys(m.lower() for m in EMAIL_RE.findall(text)))   # Bỏ trùng, giữ thứ tự
    phones = []
    for raw in PHONE_RE.findall(text):
        digits = re.sub(r"\D", "", raw)
        if digits.startswith("84"):
            digits = "0" + digits[2:]
        if digits not in phones:
            phones.append(digits)
    return {"emails": emails, "phones": phones}


text = """Liên hệ An: an@shop.vn, 0912 345 678.
Bình: BINH@gmail.com hoặc +84 912.345.678 (cùng số với An), fax 0243 123 456."""
print(extract_contacts(text))
# Output: {'emails': ['an@shop.vn', 'binh@gmail.com'], 'phones': ['0912345678']}
```

</details>

## ✅ Checklist hoàn thành

- [ ] Viết được regex với `\d`, `\w`, `[]`, `+`, `*`, `?`, `{n,m}`, `^`, `$`
- [ ] Phân biệt `search`, `match`, `fullmatch`; dùng `findall`, `finditer`, `sub` (kể cả với hàm)
- [ ] Dùng named group `(?P<ten>...)` và flags `IGNORECASE`, `MULTILINE`, `VERBOSE`
- [ ] Validate được email, số điện thoại VN, ngày tháng
- [ ] Cộng trừ thời gian với `timedelta`, định dạng với `strftime`/`strptime`
- [ ] Giải thích được naive vs aware, dùng `ZoneInfo("Asia/Ho_Chi_Minh")`, lưu UTC
- [ ] Cấu hình logging với nhiều handler, formatter, `RotatingFileHandler`
- [ ] Dùng `logging.getLogger(__name__)` trong mỗi module
- [ ] Chọn đúng `Enum` / `IntEnum` / `StrEnum`
- [ ] Tự động hóa file với `pathlib`, `shutil`, `rglob`, có `--dry-run`
- [ ] Viết CLI có subcommands với `set_defaults(func=...)`
- [ ] Đọc cấu hình từ biến môi trường, ép kiểu đúng
- [ ] Dùng `secrets` cho token/mật khẩu, `hashlib` cho checksum, `uuid4` cho ID
- [ ] Chạy thành công 3 ứng dụng thực tế và làm ít nhất 3 bài tập

## 🚀 Tiếp theo

Bạn đã có "hộp đồ nghề" thư viện chuẩn để viết script tự động hóa trên máy mình. Bước tiếp theo là **kết nối với thế giới bên ngoài**: gọi API của dịch vụ khác (tỷ giá, thời tiết, thanh toán) và tự xây dựng Web API cho ứng dụng web/mobile dùng.

**Bài tiếp theo**: [HTTP & Web API](./12-http-web-apis.md)

---

💡 **Tips nhớ lâu**:

- **Regex lọc hình dạng, code kiểm tra ý nghĩa**
- **Lưu UTC, hiển thị giờ địa phương**
- **App dùng `logging`, CLI mới `print` kết quả**
- **Chuỗi "ma thuật" lặp lại → biến thành `Enum`**
- **Script xóa/di chuyển file → luôn có `--dry-run`**
- **Bí mật nằm trong biến môi trường, không nằm trong code**
- **Mật khẩu/token → `secrets`, không phải `random`**
