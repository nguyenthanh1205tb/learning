# 🐍 Hướng dẫn học Python từ đầu

## 📋 Tổng quan

Chào mừng bạn đến với khóa học Python! Đây là tài liệu hướng dẫn đầy đủ để học Python từ con số 0 đến mức có thể **tự viết và đưa vào sử dụng** một ứng dụng thực tế. Khóa học tập trung vào những kiến thức **quan trọng nhất**, được giải thích **thật chi tiết và dễ hiểu**, kèm rất nhiều ví dụ có thể chạy ngay.

Khóa học gồm **2 phần**:

- **Phần 1: Cơ bản → Trung cấp** (Bài 1-10): nền tảng ngôn ngữ, OOP, xử lý lỗi, file, module, tính năng nâng cao và dự án tổng hợp Todo CLI
- **Phần 2: Nâng cao & Thực tế** (Bài 11-16): những công cụ dùng hằng ngày khi đi làm - thư viện chuẩn, Web API, database, concurrency, xử lý dữ liệu, đưa ứng dụng lên production

Python là một trong những ngôn ngữ lập trình phổ biến nhất thế giới vì cú pháp gần với tiếng Anh, dễ đọc, dễ viết và dùng được cho rất nhiều lĩnh vực: web, tự động hóa, phân tích dữ liệu, AI/Machine Learning, viết script, làm tool...

### 🎯 Mục tiêu khóa học

- Hiểu cách Python hoạt động và cài đặt môi trường làm việc chuẩn (VS Code, venv, pip)
- Nắm vững biến, kiểu dữ liệu, toán tử và cấu trúc điều khiển
- Viết hàm sạch, dễ tái sử dụng, có type hints và docstring
- Thành thạo list, tuple, dict, set và comprehensions
- Hiểu lập trình hướng đối tượng (OOP) theo cách "Pythonic"
- Xử lý lỗi, đọc/ghi file, làm việc với JSON và CSV
- Tổ chức code thành module, package; dùng standard library hiệu quả
- Làm quen với các tính năng nâng cao: generator, decorator, context manager, asyncio
- Tự xây dựng một ứng dụng CLI hoàn chỉnh có test
- Dùng thành thạo thư viện chuẩn trong công việc: regex, datetime, logging, enum...
- Gọi và xây dựng Web API (requests/httpx, FastAPI), làm việc với database (sqlite3, SQLAlchemy)
- Tăng tốc chương trình với concurrency & parallelism (threading, multiprocessing, asyncio)
- Xử lý dữ liệu và tự động hóa công việc với pandas, Excel, web scraping
- Đưa ứng dụng Python lên production qua dự án tổng kết Expense Tracker API

### ⏱️ Thời gian học tập

- **Tổng thời gian**: 7-8 tuần (1-2 giờ/ngày)
  - Phần 1 (Bài 1-10): khoảng 5 tuần
  - Phần 2 (Bài 11-16): khoảng 3 tuần
- **Cấp độ**: Người mới bắt đầu (không cần biết lập trình trước)
- **Kết quả**: Có thể tự viết script, tool dòng lệnh, Web API có database, script xử lý dữ liệu/tự động hóa và đọc hiểu code Python của người khác

## 🛠️ Yêu cầu hệ thống

### Phần mềm cần cài đặt

1. **Python 3.11+** - Trình thông dịch (interpreter) Python, tải tại [python.org](https://www.python.org/downloads/)
2. **Visual Studio Code** - Editor miễn phí, nhẹ, rất phổ biến
3. **Python extension** cho VS Code (của Microsoft) - hỗ trợ gợi ý code, debug, chọn interpreter
4. **Terminal** - Command Prompt/PowerShell (Windows), Terminal (macOS/Linux)
5. **Thư viện bên ngoài cho Phần 2** (cài bằng `pip` trong venv khi tới bài tương ứng): requests/httpx, FastAPI, SQLAlchemy, pandas... - mỗi bài sẽ hướng dẫn cài đặt cụ thể

### Tài nguyên học tập

- Máy tính Windows/Mac/Linux (cấu hình thấp cũng chạy tốt)
- Kết nối internet để tải Python và thư viện
- Một cuốn sổ (hoặc file ghi chú) để ghi lại những gì học được

## 📚 Cấu trúc khóa học

### 🟢 Phần 1: Cơ bản → Trung cấp (Bài 1-10)

#### Tuần 1: Nền tảng

- [x] **Bài 1**: [Giới thiệu & Cài đặt môi trường](./01-introduction-setup.md) (Python là gì, REPL, venv, pip, PEP 8)
- [x] **Bài 2**: [Biến & Kiểu dữ liệu](./02-variables-types.md) (int, float, str, bool, None, f-strings, slicing)
- [x] **Bài 3**: [Cấu trúc điều khiển](./03-control-flow.md) (if/elif/else, for, while, match-case)

#### Tuần 2: Hàm & Cấu trúc dữ liệu

- [x] **Bài 4**: [Hàm (Functions)](./04-functions.md) (tham số, *args/**kwargs, lambda, scope, type hints, đệ quy)
- [x] **Bài 5**: [Cấu trúc dữ liệu](./05-data-structures.md) (list, tuple, dict, set, comprehensions, collections)

#### Tuần 3: Lập trình hướng đối tượng & Xử lý lỗi

- [x] **Bài 6**: [Lập trình hướng đối tượng (OOP)](./06-oop.md) (class, kế thừa, dunder methods, dataclass, abc)
- [x] **Bài 7**: [Exceptions & Làm việc với File](./07-exceptions-files.md) (try/except, with, pathlib, json, csv)

#### Tuần 4: Tổ chức code & Python nâng cao

- [x] **Bài 8**: [Modules & Packages](./08-modules-packages.md) (import, package, standard library, requirements.txt, typing, mypy)
- [x] **Bài 9**: [Python nâng cao](./09-advanced-python.md) (iterator, generator, decorator, context manager, closure, asyncio)

#### Tuần 5: Dự án tổng hợp Phần 1

- [x] **Bài 10**: [Dự án tổng hợp phần cơ bản - Ứng dụng Todo CLI](./10-final-project.md) (argparse, dataclass, JSON, module, pytest)

### 🔵 Phần 2: Nâng cao & Thực tế (Bài 11-16)

#### Tuần 6: Thư viện chuẩn & Web API

- [x] **Bài 11**: [Thư viện chuẩn thực chiến](./11-stdlib-practical.md) (regex, datetime, logging, enum...)
- [x] **Bài 12**: [HTTP & Web API](./12-http-web-apis.md) (requests/httpx, FastAPI)

#### Tuần 7: Database & Concurrency

- [x] **Bài 13**: [Làm việc với Database](./13-databases.md) (sqlite3, SQLAlchemy)
- [x] **Bài 14**: [Concurrency & Parallelism](./14-concurrency-parallelism.md) (threading, multiprocessing, asyncio)

#### Tuần 8: Dữ liệu, Tự động hóa & Production

- [x] **Bài 15**: [Xử lý dữ liệu & Tự động hóa](./15-data-processing.md) (pandas, Excel, scraping)
- [x] **Bài 16**: [Python trong Production](./16-production-ready.md) (dự án tổng kết: Expense Tracker API)

## 🚀 Bắt đầu học

### Bước 1: Cài đặt Python

1. Truy cập [python.org/downloads](https://www.python.org/downloads/) và tải bản Python 3 mới nhất
2. **Windows**: khi cài, nhớ tick ô **"Add python.exe to PATH"** ở màn hình đầu tiên (rất quan trọng!)
3. **macOS**: cài bằng file `.pkg` từ python.org hoặc `brew install python`
4. **Linux**: thường có sẵn, kiểm tra bằng `python3 --version`, nếu chưa có thì `sudo apt install python3 python3-venv python3-pip`

Kiểm tra cài đặt thành công:

```bash
# Windows
python --version
# macOS / Linux
python3 --version
# Output: Python 3.11.x (hoặc mới hơn)
```

### Bước 2: Cài đặt VS Code

1. Tải VS Code từ [code.visualstudio.com](https://code.visualstudio.com)
2. Mở VS Code → vào tab **Extensions** (Ctrl+Shift+X)
3. Tìm **"Python"** (của Microsoft) → Install
4. Nhấn `Ctrl+Shift+P` → gõ **"Python: Select Interpreter"** → chọn Python vừa cài

### Bước 3: Chạy chương trình đầu tiên

1. Tạo thư mục `python-practice` và mở bằng VS Code
2. Tạo file `hello.py` với nội dung:

```python
print("Xin chào Python! 🐍")
# Output: Xin chào Python! 🐍
```

3. Mở Terminal trong VS Code (`` Ctrl+` ``) và chạy:

```bash
python hello.py     # Windows
python3 hello.py    # macOS / Linux
```

### Bước 4: Làm quen với các công cụ

- **REPL** (gõ `python`/`python3` trong terminal): Thử nhanh từng dòng code
- **File `.py`**: Viết chương trình hoàn chỉnh
- **venv**: Môi trường ảo riêng cho từng project
- **pip**: Cài đặt thư viện từ [pypi.org](https://pypi.org)

## 📖 Cách sử dụng tài liệu

1. **Đọc tuần tự**: Các bài học được sắp xếp theo độ khó tăng dần, bài sau dùng kiến thức bài trước
2. **Gõ lại code**: Đừng copy-paste! Tự gõ giúp bạn nhớ cú pháp nhanh hơn rất nhiều
3. **So sánh output**: Mỗi ví dụ đều có `# Output:` - chạy thử và so sánh kết quả
4. **Xem phần "🌍 Ứng dụng thực tế"**: Mỗi bài có các chương trình hoàn chỉnh cho tình huống thật (tính tiền, xử lý dữ liệu, gọi API...) - chỉ dùng kiến thức đã học tới bài đó
5. **Đọc phần "⚠️ Lỗi thường gặp"**: Giúp bạn tránh những bẫy mà người mới hay mắc
6. **Làm bài tập**: Mỗi bài có phần "🏋️ Bài tập" - hãy tự làm trước khi tìm lời giải
7. **Đánh dấu checklist**: Cuối mỗi bài có "✅ Checklist" để tự kiểm tra

## ✅ Checklist theo dõi tiến độ

### Phần 1: Cơ bản → Trung cấp

#### Tuần 1

- [ ] Hoàn thành Bài 1: Cài đặt Python, VS Code, tạo được venv
- [ ] Hoàn thành Bài 2: Biến & Kiểu dữ liệu
- [ ] Hoàn thành Bài 3: Cấu trúc điều khiển
- [ ] Viết được chương trình "Đoán số" đơn giản

#### Tuần 2

- [ ] Hoàn thành Bài 4: Hàm
- [ ] Hoàn thành Bài 5: Cấu trúc dữ liệu
- [ ] Viết được chương trình quản lý danh bạ bằng dict

#### Tuần 3

- [ ] Hoàn thành Bài 6: OOP
- [ ] Hoàn thành Bài 7: Exceptions & File
- [ ] Viết được chương trình đọc/ghi dữ liệu JSON có xử lý lỗi

#### Tuần 4

- [ ] Hoàn thành Bài 8: Modules & Packages
- [ ] Hoàn thành Bài 9: Python nâng cao
- [ ] Tự viết được một decorator và một generator

#### Tuần 5

- [ ] Hoàn thành Bài 10: Dự án Todo CLI
- [ ] Tất cả test đều pass ✅
- [ ] Đưa code lên GitHub để làm portfolio

### Phần 2: Nâng cao & Thực tế

#### Tuần 6

- [ ] Hoàn thành Bài 11: Thư viện chuẩn thực chiến
- [ ] Hoàn thành Bài 12: HTTP & Web API
- [ ] Gọi được một API thật và viết được một API nhỏ bằng FastAPI

#### Tuần 7

- [ ] Hoàn thành Bài 13: Làm việc với Database
- [ ] Hoàn thành Bài 14: Concurrency & Parallelism
- [ ] Chuyển Todo CLI sang lưu bằng database

#### Tuần 8

- [ ] Hoàn thành Bài 15: Xử lý dữ liệu & Tự động hóa
- [ ] Hoàn thành Bài 16: Python trong Production
- [ ] Hoàn thiện và triển khai dự án Expense Tracker API 🚀

## 🎯 Tips học hiệu quả

1. **Code mỗi ngày**: 30 phút mỗi ngày tốt hơn 5 tiếng vào cuối tuần
2. **Dùng REPL thật nhiều**: Không chắc một đoạn code chạy thế nào? Gõ thử ngay trong REPL!
3. **Đọc thông báo lỗi**: Python báo lỗi rất rõ ràng - dòng cuối cùng của traceback thường nói chính xác vấn đề
4. **Tự làm project nhỏ**: Máy tính, đoán số, quản lý chi tiêu, đổi tên file hàng loạt...
5. **Dùng `help()` và `dir()`**: `help(str)` hiện tài liệu, `dir(list)` liệt kê các method
6. **Đừng sợ lỗi**: Lỗi là cách học tốt nhất! Mỗi lỗi sửa được là một bài học nhớ lâu

## 📞 Tài liệu tham khảo

- **Python Documentation (chính thức)**: [docs.python.org](https://docs.python.org/3/)
- **Python Tutorial (chính thức)**: [docs.python.org/3/tutorial](https://docs.python.org/3/tutorial/)
- **Real Python** (bài viết & tutorial chất lượng cao): [realpython.com](https://realpython.com)
- **PyPI** (kho thư viện Python): [pypi.org](https://pypi.org)
- **PEP 8** (quy tắc viết code đẹp): [peps.python.org/pep-0008](https://peps.python.org/pep-0008/)

---

**Chúc bạn học tập vui vẻ và thành công! 🐍✨**

> 💡 **Lưu ý**: Tài liệu này dùng **Python 3.11**. Hầu hết ví dụ Phần 1 chạy được từ Python 3.8 trở lên, riêng `match-case` cần 3.10+ và một số cú pháp type hints như `list[int]` cần 3.9+. Phần 2 dùng thêm một số thư viện bên ngoài - hãy luôn cài chúng trong venv của project. Khi cần tra cứu chi tiết, hãy mở [docs.python.org](https://docs.python.org/3/).
