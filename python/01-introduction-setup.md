# 📚 Bài 1: Giới thiệu Python & Cài đặt môi trường

## 🎯 Mục tiêu bài học

- Hiểu Python là gì, tại sao Python phổ biến và dùng để làm gì
- Cài đặt Python đúng cách trên Windows, macOS và Linux
- Cài đặt và cấu hình VS Code + Python extension
- Biết dùng REPL (chế độ tương tác) để thử code nhanh
- Viết và chạy file `.py` đầu tiên
- Hiểu và sử dụng thành thạo **virtual environment (venv)**
- Cài đặt thư viện bằng **pip**
- Nắm quy tắc **indentation** (thụt lề) và phong cách code **PEP 8**

## 📖 1. Python là gì?

### Định nghĩa đơn giản

**Python** là một ngôn ngữ lập trình **bậc cao** (high-level), **thông dịch** (interpreted) và **đa mục đích** (general-purpose), được Guido van Rossum tạo ra năm 1991.

Giải thích từng từ khóa:

- **Bậc cao**: Bạn viết code gần với ngôn ngữ con người, không cần quan tâm tới bộ nhớ, thanh ghi CPU...
- **Thông dịch**: Code được một chương trình tên là **interpreter** đọc và thực thi từng dòng, không cần bước "biên dịch" (compile) ra file `.exe` như C/C++
- **Đa mục đích**: Dùng được cho gần như mọi thứ - web, dữ liệu, AI, game, tự động hóa...

> 🧠 **Ví dụ dễ hiểu**: Hãy tưởng tượng bạn đưa một công thức nấu ăn (code) cho một đầu bếp (interpreter). Đầu bếp đọc từng bước và làm ngay. Nếu bước 5 viết sai, đầu bếp sẽ làm xong bước 1-4 rồi mới dừng lại báo lỗi ở bước 5. Đó chính là cách Python chạy code!

### So sánh nhanh: Python vs các ngôn ngữ khác

In ra "Hello World" bằng Java:

```java
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello World");
    }
}
```

Bằng C++:

```cpp
#include <iostream>
int main() {
    std::cout << "Hello World" << std::endl;
    return 0;
}
```

Bằng Python:

```python
print("Hello World")
# Output: Hello World
```

Chỉ **một dòng**! Đó là lý do Python được xem là ngôn ngữ dễ học nhất cho người mới.

### Tại sao nên học Python?

| Lý do | Giải thích |
| --- | --- |
| **Dễ đọc, dễ học** | Cú pháp gần tiếng Anh, không cần dấu `;` hay `{}` |
| **Cộng đồng khổng lồ** | Gặp lỗi gì cũng có người đã hỏi trên Stack Overflow |
| **Thư viện phong phú** | Hơn 500.000 package trên [pypi.org](https://pypi.org) |
| **"Batteries included"** | Standard library có sẵn rất nhiều module: đọc file, JSON, ngày giờ, mạng... |
| **Cơ hội việc làm** | Top đầu trong các khảo sát ngôn ngữ phổ biến nhiều năm liền |
| **Đa nền tảng** | Cùng một code chạy trên Windows, macOS, Linux |

### Python được dùng để làm gì?

```text
🌐 Web Backend        → Django, Flask, FastAPI (Instagram, Pinterest dùng Python)
📊 Phân tích dữ liệu   → pandas, NumPy, Matplotlib
🤖 AI / Machine Learning → PyTorch, TensorFlow, scikit-learn
⚙️ Tự động hóa (script) → đổi tên hàng loạt file, gửi email, crawl web
🧪 Testing / DevOps    → pytest, Ansible, script CI/CD
🎮 Game đơn giản       → pygame
🔬 Khoa học            → SciPy, Jupyter Notebook
```

### Python 2 vs Python 3

- **Python 2** đã **ngừng hỗ trợ từ 01/01/2020** - KHÔNG học Python 2 nữa!
- **Python 3** là phiên bản hiện tại. Khóa học này dùng **Python 3.11**.
- Nếu thấy code có `print "hello"` (không có ngoặc) → đó là code Python 2 cũ.

### 💡 Tips quan trọng

- Python là ngôn ngữ **phân biệt hoa/thường** (case-sensitive): `name` và `Name` là 2 biến khác nhau ✅
- Python **dùng thụt lề (indentation)** thay cho `{}` để nhóm code - sai thụt lề là lỗi ❌
- Không cần dấu `;` ở cuối dòng ✅
- Luôn cài **Python 3**, không phải Python 2 ✅

## 📖 2. Cài đặt Python

### 🪟 Windows

**Bước 1**: Vào [python.org/downloads](https://www.python.org/downloads/) → bấm nút **"Download Python 3.x.x"**

**Bước 2**: Chạy file cài đặt. Ở màn hình **đầu tiên**, bạn sẽ thấy 2 ô checkbox ở dưới cùng:

```text
┌─────────────────────────────────────────────────┐
│  Install Python 3.11                            │
│                                                 │
│  → Install Now                                  │
│  → Customize installation                       │
│                                                 │
│  ☑ Use admin privileges when installing py.exe  │
│  ☑ Add python.exe to PATH     ← TICK Ô NÀY!!!   │
└─────────────────────────────────────────────────┘
```

> ⚠️ **CỰC KỲ QUAN TRỌNG**: Phải tick **"Add python.exe to PATH"**. Nếu quên, khi gõ `python` trong terminal sẽ báo lỗi `'python' is not recognized as an internal or external command`.

**PATH là gì?** PATH là danh sách các thư mục mà hệ điều hành sẽ tìm khi bạn gõ một lệnh. Giống như danh bạ điện thoại: nếu tên "python" không có trong danh bạ, máy không biết "gọi" cho ai.

**Bước 3**: Bấm **"Install Now"** và chờ cài xong. Nếu có dòng **"Disable path length limit"**, bấm vào để tắt giới hạn 260 ký tự của đường dẫn (nên làm).

**Bước 4**: Mở **Command Prompt** hoặc **PowerShell** (MỚI - phải mở lại sau khi cài) và kiểm tra:

```bash
python --version
# Output: Python 3.11.9

pip --version
# Output: pip 24.0 from C:\Users\...\Python311\Lib\site-packages\pip (python 3.11)
```

Trên Windows còn có lệnh `py` (Python Launcher), rất tiện khi có nhiều phiên bản:

```bash
py --version        # Phiên bản mặc định
py -3.11 --version  # Chọn đúng bản 3.11
py --list           # Liệt kê các bản Python đã cài
```

**Lỡ quên tick "Add to PATH" thì sao?**

- Cách 1 (dễ nhất): Chạy lại file cài đặt → chọn **"Modify"** → Next → tick **"Add Python to environment variables"**
- Cách 2: Gỡ Python và cài lại, lần này nhớ tick ô PATH
- Cách 3: Dùng lệnh `py` thay cho `python` (Python Launcher thường vẫn hoạt động)

> 💡 Trên Windows, nếu gõ `python` mà nó mở **Microsoft Store**, đó là "alias" giả của Windows. Vào **Settings → Apps → Advanced app settings → App execution aliases** và tắt 2 mục `python.exe`, `python3.exe`.

### 🍎 macOS

macOS có thể đã có sẵn `python3` (bản cũ đi kèm Xcode Command Line Tools). Nên cài bản mới:

**Cách 1 - Installer chính thức (dễ nhất)**:

1. Tải file `.pkg` tại [python.org/downloads](https://www.python.org/downloads/)
2. Mở file và bấm Continue → Install
3. Sau khi cài, chạy file **"Install Certificates.command"** trong thư mục `/Applications/Python 3.11/` (để Python tải được dữ liệu qua HTTPS)

**Cách 2 - Homebrew (dành cho ai đã dùng brew)**:

```bash
brew install python@3.11
```

Kiểm tra:

```bash
python3 --version
# Output: Python 3.11.9

pip3 --version
```

> ⚠️ Trên macOS/Linux, lệnh là `python3` và `pip3`. Lệnh `python` (không có số 3) có thể không tồn tại hoặc trỏ tới Python 2 cũ.

### 🐧 Linux (Ubuntu/Debian)

Hầu hết bản Linux đều có sẵn Python 3:

```bash
python3 --version
# Output: Python 3.10.12 (tùy phiên bản Ubuntu)
```

Cài thêm các gói cần thiết (venv và pip thường **không** có sẵn):

```bash
sudo apt update
sudo apt install python3 python3-pip python3-venv
```

Với Fedora:

```bash
sudo dnf install python3 python3-pip
```

> ⚠️ **Đừng gỡ hay "nâng cấp đè" Python hệ thống trên Linux!** Nhiều công cụ của hệ điều hành phụ thuộc vào nó. Nếu cần bản mới hơn, dùng `pyenv` hoặc `deadsnakes PPA` để cài song song.

### ✅ Kiểm tra cài đặt thành công

Sau khi cài xong, bạn nên chạy được các lệnh sau (Windows dùng `python`, Mac/Linux dùng `python3`):

```bash
python3 --version        # Phiên bản Python
python3 -m pip --version # Phiên bản pip
python3 -c "print(1 + 1)"
# Output: 2
```

`-c` cho phép chạy một đoạn code ngắn ngay trên dòng lệnh mà không cần tạo file.

### 💡 Tips quan trọng

- Windows: **luôn tick "Add python.exe to PATH"** ✅
- Sau khi cài, **mở terminal mới** để PATH được cập nhật ✅
- Mac/Linux: dùng `python3`, `pip3` thay vì `python`, `pip` ✅
- Không dùng `sudo pip install ...` trên Linux/Mac ❌ (dùng venv thay thế - xem phần 6)

## 📖 3. Cài đặt VS Code + Python extension

### Tại sao dùng VS Code?

Bạn có thể viết Python bằng Notepad, nhưng một editor tốt sẽ giúp bạn:

- **Tô màu cú pháp** (syntax highlighting) → dễ đọc
- **Gợi ý code** (IntelliSense / autocomplete) → gõ nhanh, ít sai
- **Báo lỗi ngay khi gõ** → phát hiện lỗi trước khi chạy
- **Debug** → chạy từng dòng, xem giá trị biến
- **Terminal tích hợp** → không cần mở cửa sổ khác

Các lựa chọn khác: **PyCharm** (mạnh, nặng hơn), **Jupyter Notebook** (cho data science), **Thonny** (siêu đơn giản cho người mới).

### Các bước cài đặt

**Bước 1**: Tải VS Code tại [code.visualstudio.com](https://code.visualstudio.com) và cài đặt.

**Bước 2**: Mở VS Code → bấm biểu tượng **Extensions** ở thanh bên trái (hoặc `Ctrl+Shift+X` / `Cmd+Shift+X` trên Mac).

**Bước 3**: Tìm và cài các extension:

| Extension | Tác giả | Công dụng |
| --- | --- | --- |
| **Python** | Microsoft | Bắt buộc - chạy, debug, chọn interpreter |
| **Pylance** | Microsoft | Tự cài cùng Python - gợi ý code, kiểm tra kiểu |
| **Ruff** hoặc **Black Formatter** | Astral / Microsoft | Tùy chọn - tự động format code theo PEP 8 |

**Bước 4**: Chọn interpreter: nhấn `Ctrl+Shift+P` → gõ **"Python: Select Interpreter"** → chọn phiên bản Python bạn vừa cài (hoặc venv của project - xem phần 6).

### Cấu hình khuyến nghị

Mở **Settings** (`Ctrl+,`) → bấm biểu tượng `{}` góc phải trên để mở `settings.json` và thêm:

```json
{
  "editor.formatOnSave": true,
  "editor.rulers": [79],
  "files.trimTrailingWhitespace": true,
  "python.terminal.activateEnvironment": true
}
```

- `formatOnSave`: tự format code mỗi khi lưu
- `rulers`: vẽ một đường dọc ở cột 79 để nhắc bạn không viết dòng quá dài (PEP 8)
- `activateEnvironment`: tự kích hoạt venv khi mở terminal

### Phím tắt hay dùng

| Phím tắt | Chức năng |
| --- | --- |
| `` Ctrl+` `` | Mở/đóng Terminal |
| `F5` | Chạy với Debugger |
| `Ctrl+F5` | Chạy không debug |
| `Shift+Enter` | Chạy dòng/đoạn đang chọn trong terminal Python |
| `Ctrl+/` | Comment/bỏ comment dòng |
| `Shift+Alt+F` | Format toàn bộ file |
| `F12` | Nhảy tới định nghĩa hàm/biến |

## 📖 4. REPL - Chế độ tương tác

### REPL là gì?

**REPL** = **R**ead - **E**val - **P**rint - **L**oop:

1. **Read**: Đọc dòng code bạn gõ
2. **Eval**: Thực thi (tính toán) dòng đó
3. **Print**: In kết quả ra màn hình
4. **Loop**: Quay lại chờ dòng tiếp theo

> 🧠 **Ví dụ dễ hiểu**: REPL giống như chiếc máy tính bỏ túi thông minh. Bạn gõ phép tính, nó trả lời ngay. Rất phù hợp để **thử nghiệm nhanh** một ý tưởng mà không cần tạo file.

### Mở REPL

```bash
python3      # macOS / Linux
python       # Windows (hoặc: py)
```

Bạn sẽ thấy dấu nhắc `>>>`:

```text
Python 3.11.9 (main, ...) [GCC ...] on linux
Type "help", "copyright", "credits" or "license" for more information.
>>>
```

### Thử nghiệm trong REPL

Trong REPL, bạn **không cần** `print()` - kết quả của biểu thức được in tự động:

```python
>>> 2 + 3
5
>>> 10 / 3
3.3333333333333335
>>> "Python" * 3
'PythonPythonPython'
>>> name = "Lan"
>>> name
'Lan'
>>> len(name)
3
>>> name.upper()
'LAN'
```

Dấu `...` xuất hiện khi bạn viết code nhiều dòng (như `if`, `for`, hàm). Nhấn **Enter trên dòng trống** để kết thúc khối:

```python
>>> for i in range(3):
...     print("Lần", i)
...
Lần 0
Lần 1
Lần 2
```

### Các lệnh hữu ích trong REPL

```python
>>> 7 * 6
42
>>> _ + 1           # _ chứa kết quả vừa tính (42)
43
>>> type(3.14)      # Xem kiểu dữ liệu
<class 'float'>
>>> import math
>>> math.sqrt(16)
4.0
```

Một số hàm "cứu cánh" khi bạn không nhớ cách dùng:

- `help(print)` → hiện tài liệu của hàm `print` (nhấn `q` để thoát)
- `dir(str)` → liệt kê tất cả method của kiểu `str`
- `type(x)` → xem kiểu của `x`

> 💡 Trong REPL, biến đặc biệt `_` luôn chứa **kết quả của biểu thức vừa tính** (chỉ có trong REPL, không có trong file .py).

### Thoát REPL

- Gõ `exit()` hoặc `quit()` rồi Enter
- Hoặc nhấn `Ctrl+D` (macOS/Linux) / `Ctrl+Z` rồi Enter (Windows)

### 💡 Tips quan trọng

- REPL dùng để **thử nghiệm**, file `.py` dùng để **viết chương trình thật** ✅
- Mọi thứ gõ trong REPL sẽ **mất** khi thoát ❌ → code quan trọng hãy lưu vào file
- Dùng `help()` và `dir()` thay vì google mọi thứ ✅

## 📖 5. Viết và chạy file `.py` đầu tiên

### Tạo project

1. Tạo thư mục `python-practice` ở nơi bạn muốn (ví dụ `Documents/python-practice`)
2. Mở VS Code → **File → Open Folder** → chọn thư mục đó
3. Tạo file mới tên `hello.py`

### Chương trình đầu tiên

```python
# hello.py - Chương trình Python đầu tiên của tôi
# Dòng bắt đầu bằng dấu # là comment (ghi chú), Python sẽ bỏ qua

print("Xin chào Python!")          # In một chuỗi
print("Tôi đang học lập trình")
print(2026 - 2000)                  # In kết quả phép tính
print("Tổng:", 5 + 7)               # In nhiều giá trị, cách nhau bởi dấu cách

# Output:
# Xin chào Python!
# Tôi đang học lập trình
# 26
# Tổng: 12
```

### Chạy file

**Cách 1 - Terminal** (khuyến khích học cách này):

```bash
# Mở terminal tại thư mục chứa file
python3 hello.py     # macOS / Linux
python hello.py      # Windows
```

**Cách 2 - VS Code**: Bấm nút ▶️ **"Run Python File"** ở góc phải trên, hoặc chuột phải trong editor → **"Run Python File in Terminal"**.

### Điều gì xảy ra khi chạy `python3 hello.py`?

```text
hello.py  ──►  Python Interpreter  ──►  Bytecode  ──►  Python Virtual Machine  ──►  Kết quả
(code bạn)     (đọc & kiểm tra        (dạng trung      (thực thi từng lệnh)
               cú pháp)                gian)
```

1. Interpreter đọc toàn bộ file và kiểm tra cú pháp (syntax). Nếu sai cú pháp → báo `SyntaxError` và **không chạy dòng nào**.
2. Code được dịch sang **bytecode** (bạn có thể thấy thư mục `__pycache__` chứa file `.pyc` khi import module).
3. **Python Virtual Machine** chạy bytecode từ trên xuống dưới. Nếu gặp lỗi lúc chạy (runtime error) → dừng lại tại dòng đó.

### Hàm `print()` chi tiết hơn

```python
# In nhiều giá trị - mặc định cách nhau bởi 1 dấu cách
print("Python", "Java", "C++")
# Output: Python Java C++

# Đổi ký tự ngăn cách bằng tham số sep
print("2026", "09", "25", sep="-")
# Output: 2026-09-25

# Mặc định print() xuống dòng ở cuối (end="\n"), có thể thay đổi
print("Đang tải", end="...")
print("xong!")
# Output: Đang tải...xong!

# print() không có tham số → in một dòng trống
print()

# Ký tự đặc biệt: \n (xuống dòng), \t (tab)
print("Dòng 1\nDòng 2")
# Output:
# Dòng 1
# Dòng 2
print("Tên:\tAn")
```

### Comment (ghi chú)

```python
# Đây là comment một dòng

x = 10  # Comment ở cuối dòng (cách code ít nhất 2 dấu cách)

"""
Đây là chuỗi nhiều dòng (docstring).
Thường dùng để mô tả module, hàm, class.
Nếu không gán vào đâu, nó được dùng như comment nhiều dòng.
"""

print(x)
# Output: 10
```

> 💡 **Viết comment giải thích TẠI SAO, không phải CÁI GÌ**. Code `x = x + 1  # tăng x lên 1` là comment thừa. Code `retries += 1  # server hay timeout lần đầu nên thử lại` mới là comment có giá trị.

### Đọc thông báo lỗi (Traceback)

Tạo file `error_demo.py`:

```python
print("Bắt đầu")
print(10 / 0)
print("Dòng này không bao giờ chạy")
```

Chạy và bạn sẽ thấy:

```text
Bắt đầu
Traceback (most recent call last):
  File "error_demo.py", line 2, in <module>
    print(10 / 0)
          ~~~^~~
ZeroDivisionError: division by zero
```

Cách đọc traceback:

1. **Đọc dòng CUỐI trước**: `ZeroDivisionError: division by zero` → loại lỗi và mô tả (chia cho 0)
2. **Nhìn lên trên**: `File "error_demo.py", line 2` → lỗi ở file nào, dòng nào
3. **Dòng code gây lỗi** được in ra, kèm `~~~^~~` chỉ chính xác vị trí (Python 3.11+)

> 🧠 Để ý: "Bắt đầu" vẫn được in ra, vì Python chạy từng dòng từ trên xuống và chỉ dừng khi gặp lỗi ở dòng 2.

## 📖 6. Virtual Environment (venv)

### Vấn đề: "Địa ngục phụ thuộc" (Dependency Hell)

Hãy tưởng tượng:

- **Project A** (viết năm ngoái) cần thư viện `requests` phiên bản **2.25**
- **Project B** (mới) cần `requests` phiên bản **2.32**

Nếu cài tất cả vào **Python chung của máy** (global), bạn chỉ có **một** phiên bản `requests` → một trong hai project sẽ hỏng!

> 🧠 **Ví dụ dễ hiểu**: Virtual environment giống như **mỗi project có một hộp đồ nghề riêng**. Project A có hộp đựng cờ-lê cỡ 10, project B có hộp đựng cờ-lê cỡ 12. Không ai lấy nhầm đồ của ai.

### Virtual environment là gì?

Là **một thư mục** chứa:

- Một bản "sao" (thực ra là liên kết) của Python interpreter
- `pip` riêng
- Thư mục `site-packages` riêng để chứa các thư viện cài cho project đó

```text
my-project/
├── .venv/                  ← Virtual environment (KHÔNG commit lên git)
│   ├── bin/ (hoặc Scripts/ trên Windows)
│   │   ├── python
│   │   ├── pip
│   │   └── activate
│   └── lib/python3.11/site-packages/   ← thư viện cài vào đây
├── main.py
└── requirements.txt
```

### Tạo virtual environment

Mở terminal **tại thư mục project** và chạy:

```bash
# macOS / Linux
python3 -m venv .venv

# Windows
python -m venv .venv
```

- `-m venv`: chạy module `venv` có sẵn trong Python
- `.venv`: tên thư mục sẽ tạo (tên phổ biến nhất, VS Code tự nhận diện)

### Kích hoạt (activate) venv

```bash
# macOS / Linux (bash/zsh)
source .venv/bin/activate

# Windows - Command Prompt
.venv\Scripts\activate.bat

# Windows - PowerShell
.venv\Scripts\Activate.ps1
```

Sau khi kích hoạt, dấu nhắc terminal sẽ có tiền tố `(.venv)`:

```text
(.venv) user@computer:~/my-project$
```

Bây giờ `python` và `pip` đều trỏ vào venv. Kiểm tra:

```bash
# macOS / Linux
which python
# Output: /home/user/my-project/.venv/bin/python

# Windows
where python
# Output: C:\Users\...\my-project\.venv\Scripts\python.exe
```

> 💡 Khi venv đã được kích hoạt, trên mọi hệ điều hành bạn đều có thể gõ `python` (không cần `python3`).

> ⚠️ **Lỗi PowerShell**: Nếu gặp `running scripts is disabled on this system`, chạy lệnh sau **một lần** rồi thử lại:
>
> ```bash
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```

### Kiểm tra bằng code: đang dùng Python nào?

```python
import sys

# sys.prefix: thư mục của môi trường đang chạy
# sys.base_prefix: thư mục của Python gốc
print("Đang chạy Python tại:", sys.executable)
print("Trong venv?", sys.prefix != sys.base_prefix)
# Output (ví dụ): Trong venv? True   (nếu đã activate venv)
```

### Thoát venv

```bash
deactivate
```

### Xóa venv

venv chỉ là một thư mục → muốn xóa thì **xóa thư mục** `.venv` là xong. Có thể tạo lại bất cứ lúc nào từ `requirements.txt` (xem phần 7).

### Dùng venv trong VS Code

1. Mở thư mục project trong VS Code
2. `Ctrl+Shift+P` → **"Python: Select Interpreter"**
3. Chọn mục có đường dẫn `./.venv/bin/python` (hoặc `.\.venv\Scripts\python.exe`) - thường được đánh dấu **"Recommended"**
4. Mở terminal mới (`` Ctrl+` ``) → VS Code tự kích hoạt venv

### 💡 Tips quan trọng

- **Mỗi project một venv** ✅
- Đặt tên `.venv` để VS Code và các tool tự nhận diện ✅
- **Không commit** thư mục `.venv` lên Git → thêm `.venv/` vào file `.gitignore` ✅
- Không copy venv từ máy này sang máy khác ❌ (đường dẫn bên trong sẽ sai) → tạo lại từ `requirements.txt`
- Luôn nhìn thấy `(.venv)` ở đầu terminal trước khi `pip install` ✅

## 📖 7. pip - Trình quản lý thư viện

### pip là gì?

**pip** ("pip installs packages") là công cụ để **tải và cài thư viện** từ [PyPI](https://pypi.org) - Python Package Index, "kho ứng dụng" của Python với hàng trăm nghìn thư viện miễn phí.

> 🧠 **Ví dụ dễ hiểu**: PyPI giống App Store / Google Play, còn pip giống nút "Cài đặt".

### Các lệnh pip cơ bản

> 💡 Nên dùng `python -m pip ...` thay vì `pip ...` để chắc chắn pip đang cài vào **đúng Python** đang dùng (đặc biệt trên Windows hoặc máy có nhiều bản Python).

```bash
# (đã activate venv)

# Cài một thư viện
python -m pip install requests

# Cài phiên bản cụ thể
python -m pip install requests==2.32.3

# Cài phiên bản tối thiểu
python -m pip install "requests>=2.30"

# Nâng cấp thư viện
python -m pip install --upgrade requests

# Gỡ thư viện
python -m pip uninstall requests

# Liệt kê thư viện đã cài
python -m pip list

# Xem thông tin chi tiết một thư viện
python -m pip show requests

# Nâng cấp chính pip
python -m pip install --upgrade pip
```

### requirements.txt - "Danh sách mua sắm" của project

Để người khác (hoặc chính bạn trên máy khác) cài đúng các thư viện project cần:

```bash
# Xuất danh sách thư viện đang có trong venv ra file
python -m pip freeze > requirements.txt
```

File `requirements.txt` sẽ trông như:

```text
certifi==2024.8.30
charset-normalizer==3.3.2
idna==3.10
requests==2.32.3
urllib3==2.2.3
```

Trên máy khác, chỉ cần:

```bash
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
python -m pip install -r requirements.txt
```

### Thử dùng thư viện vừa cài

Sau khi `pip install requests` trong venv, tạo file `check_requests.py`:

```python
import requests

response = requests.get("https://api.github.com")
print("Status code:", response.status_code)
# Output: Status code: 200
```

> Chúng ta sẽ học kỹ hơn về `import`, module, package và `requirements.txt` trong [Bài 8](./08-modules-packages.md).

### Quy trình làm việc chuẩn (workflow)

```bash
# 1. Tạo thư mục project
mkdir my-project
cd my-project

# 2. Tạo venv
python3 -m venv .venv

# 3. Kích hoạt venv
source .venv/bin/activate     # Windows: .venv\Scripts\activate

# 4. Cài thư viện cần thiết
python -m pip install requests

# 5. Lưu danh sách thư viện
python -m pip freeze > requirements.txt

# 6. Viết code, chạy code
python main.py

# 7. Xong việc thì thoát venv
deactivate
```

## 📖 8. Indentation (thụt lề) - Quy tắc sống còn

### Tại sao Python dùng thụt lề?

Các ngôn ngữ như C, Java, JavaScript dùng `{}` để nhóm các dòng code thành một **khối** (block):

```java
if (age >= 18) {
    System.out.println("Người lớn");
    System.out.println("Được phép vào");
}
```

Python **không dùng `{}`**. Thay vào đó, Python dùng **dấu hai chấm `:`** và **thụt lề**:

```python
age = 20
if age >= 18:
    print("Người lớn")        # Thụt lề 4 dấu cách → thuộc khối if
    print("Được phép vào")    # Cùng mức thụt lề → vẫn thuộc khối if
print("Kết thúc")             # Không thụt lề → nằm ngoài if, luôn chạy

# Output:
# Người lớn
# Được phép vào
# Kết thúc
```

> 🧠 **Ví dụ dễ hiểu**: Thụt lề giống như **mục lục sách**. Các mục con thụt vào trong mục cha. Nhìn vào là biết ngay dòng nào "thuộc về" đâu. Python **ép** bạn viết code gọn gàng như vậy, nên code Python thường rất dễ đọc.

### Quy tắc thụt lề

1. Dòng kết thúc bằng `:` (if, for, while, def, class...) → dòng tiếp theo **phải thụt vào**
2. Dùng **4 dấu cách** cho mỗi mức thụt lề (chuẩn PEP 8)
3. Các dòng trong cùng một khối phải thụt **đúng bằng nhau**
4. **Không trộn lẫn** Tab và Space (VS Code mặc định tự đổi Tab thành 4 space cho file .py)

```python
score = 85

if score >= 50:
    print("Đậu")
    if score >= 80:              # Khối lồng nhau → thụt thêm 4 space
        print("Loại giỏi")
    print("Chúc mừng!")
else:
    print("Rớt")

# Output:
# Đậu
# Loại giỏi
# Chúc mừng!
```

### Lỗi thụt lề điển hình

```text
# ❌ Quên thụt lề sau dấu :
if True:
print("Hello")
# IndentationError: expected an indented block after 'if' statement on line 1

# ❌ Thụt lề không đều trong cùng khối
if True:
    print("Dòng 1")
      print("Dòng 2")
# IndentationError: unexpected indent

# ❌ Thụt lề khi không cần
print("A")
    print("B")
# IndentationError: unexpected indent
```

## 📖 9. PEP 8 - Phong cách viết code chuẩn

### PEP 8 là gì?

**PEP** = **P**ython **E**nhancement **P**roposal - các tài liệu đề xuất cải tiến Python. **PEP 8** là "bộ quy tắc chính tả" cho code Python, giúp code của mọi người trên thế giới trông giống nhau và dễ đọc.

> 💡 "Code is read much more often than it is written" - Code được **đọc** nhiều hơn được **viết** rất nhiều lần. Đó là lý do phong cách quan trọng.

### Quy tắc đặt tên

```python
# ✅ Biến và hàm: snake_case (chữ thường, nối bằng dấu gạch dưới)
student_name = "Minh"
total_score = 95


def calculate_average(scores):
    return sum(scores) / len(scores)


# ✅ Class: PascalCase (viết hoa chữ cái đầu mỗi từ)
class StudentManager:
    pass


# ✅ Hằng số: UPPER_SNAKE_CASE
MAX_STUDENTS = 40
PI = 3.14159

# ✅ Biến "nội bộ" (không muốn bên ngoài dùng): bắt đầu bằng _
_internal_cache = {}

print(calculate_average([8, 9, 10]))
# Output: 9.0
```

```text
# ❌ Không nên
StudentName = "Minh"      # PascalCase dành cho class
totalscore = 95           # Khó đọc
x1 = 3.14159              # Tên không có ý nghĩa
def CalculateAverage():   # Hàm không dùng PascalCase
    pass
l = 1                     # Chữ l dễ nhầm với số 1
```

### Quy tắc khoảng trắng

```python
# ✅ Có dấu cách quanh toán tử gán và so sánh
x = 5
y = x + 2
is_equal = x == y

# ✅ Dấu cách sau dấu phẩy
numbers = [1, 2, 3, 4]


# ✅ Không có dấu cách quanh = trong tham số mặc định / keyword argument
def greet(name, greeting="Xin chào"):
    print(f"{greeting}, {name}!")


greet(name="Hoa")
# Output: Xin chào, Hoa!
```

```text
# ❌ Không nên
x=5
y = x+2
numbers = [1,2,3,4]
def greet(name, greeting = "Xin chào"):
    pass
print ("Hello")           # Không có dấu cách trước ngoặc gọi hàm
```

### Các quy tắc khác

- **Độ dài dòng**: tối đa **79 ký tự** (nhiều team chấp nhận 88 hoặc 99)
- **Dòng trống**: 2 dòng trống giữa các hàm/class ở cấp cao nhất, 1 dòng giữa các method trong class
- **Import**: đặt ở đầu file, mỗi import một dòng, theo thứ tự: standard library → thư viện bên ngoài → code của bạn
- **Chuỗi**: dùng `"` hoặc `'` đều được, nhưng hãy **nhất quán** trong cả project

```python
# ✅ Import đúng chuẩn PEP 8
import json
import os
from pathlib import Path

# (dòng trống giữa các nhóm import)
# import requests          ← thư viện bên ngoài

print(os.path.join("data", "file.txt") == str(Path("data") / "file.txt"))
# Output: True
```

### Công cụ tự động format

Đừng cố nhớ hết PEP 8 - hãy để công cụ làm:

```bash
python -m pip install ruff      # Ruff: linter + formatter siêu nhanh
ruff check .                    # Kiểm tra lỗi phong cách
ruff format .                   # Tự động format code

python -m pip install black     # Hoặc Black: formatter phổ biến
black .
```

### The Zen of Python

Gõ lệnh sau trong REPL để đọc "triết lý" của Python:

```text
>>> import this
The Zen of Python, by Tim Peters

Beautiful is better than ugly.          (Đẹp tốt hơn xấu)
Explicit is better than implicit.       (Rõ ràng tốt hơn ngầm hiểu)
Simple is better than complex.          (Đơn giản tốt hơn phức tạp)
...
Readability counts.                     (Code dễ đọc rất quan trọng)
...
```

## ⚠️ Lỗi thường gặp

### 1. `'python' is not recognized...` / `command not found: python`

```text
C:\> python --version
'python' is not recognized as an internal or external command
```

**Nguyên nhân & cách sửa**:

- Windows: quên tick **"Add python.exe to PATH"** → chạy lại installer → **Modify** → tick "Add Python to environment variables", hoặc dùng lệnh `py`
- Chưa mở terminal mới sau khi cài → đóng và mở lại terminal
- macOS/Linux: dùng `python3` thay vì `python`

### 2. Gõ lệnh terminal vào trong REPL (hoặc ngược lại)

```text
>>> pip install requests
  File "<stdin>", line 1
    pip install requests
        ^^^^^^^
SyntaxError: invalid syntax
```

**Nguyên nhân**: Bạn đang ở trong REPL (có dấu `>>>`) nhưng gõ lệnh dành cho terminal.

**Cách sửa**: Gõ `exit()` để thoát REPL, rồi mới chạy `pip install ...`.

### 3. `ModuleNotFoundError` dù đã `pip install`

```text
ModuleNotFoundError: No module named 'requests'
```

**Nguyên nhân**: Bạn cài thư viện vào **một Python** nhưng chạy code bằng **Python khác** (ví dụ: cài vào global nhưng VS Code đang dùng venv, hoặc ngược lại).

**Cách sửa**:

- Kiểm tra terminal có `(.venv)` không
- Kiểm tra VS Code đã chọn đúng interpreter (góc dưới phải màn hình)
- Luôn cài bằng `python -m pip install ...` với đúng `python` bạn dùng để chạy code

### 4. `IndentationError` / `TabError`

```text
TabError: inconsistent use of tabs and spaces in indentation
```

**Nguyên nhân**: Trộn Tab và Space, hoặc thụt lề không đều.

**Cách sửa**: Trong VS Code, nhìn góc dưới phải thấy **"Spaces: 4"** là đúng. Nếu thấy "Tab Size", bấm vào → **"Convert Indentation to Spaces"**.

### 5. Đặt tên file trùng với module có sẵn

```text
# Bạn tạo file tên random.py, trong đó có:
import random
print(random.randint(1, 10))
# AttributeError: module 'random' has no attribute 'randint'
```

**Nguyên nhân**: Python tìm module trong **thư mục hiện tại trước**, nên `import random` import chính file `random.py` của bạn thay vì module chuẩn!

**Cách sửa**: **Không đặt tên file** trùng với module có sẵn: `random.py`, `math.py`, `json.py`, `email.py`, `test.py`... Hãy đổi thành `random_demo.py` và xóa thư mục `__pycache__` nếu có.

### 6. Quên dấu ngoặc khi gọi `print` (thói quen Python 2)

```text
print "Hello"
# SyntaxError: Missing parentheses in call to 'print'. Did you mean print(...)?
```

**Cách sửa**: Python 3 luôn dùng `print("Hello")`.

### 7. Dùng dấu ngoặc kép "thông minh" khi copy từ Word/web

```text
print(“Hello”)
# SyntaxError: invalid character '“' (U+201C)
```

**Cách sửa**: Dùng dấu ngoặc thường `"` hoặc `'` gõ từ bàn phím, không dùng `“ ”` copy từ Word.

## 🏋️ Bài tập

### Bài tập 1: Kiểm tra môi trường

1. Mở terminal, kiểm tra phiên bản Python và pip
2. Mở REPL, tính: `2 ** 10`, `17 // 5`, `17 % 5` và ghi lại kết quả
3. Dùng `help(len)` để đọc tài liệu hàm `len`
4. Thoát REPL

### Bài tập 2: Thẻ giới thiệu bản thân

Tạo file `about_me.py` in ra thông tin của bạn theo mẫu:

```text
==============================
   THẺ GIỚI THIỆU
==============================
Tên:        Nguyễn Văn A
Tuổi:       20
Thành phố:  Hà Nội
Sở thích:   Đọc sách, lập trình
==============================
```

Gợi ý: dùng `print("=" * 30)` để in 30 dấu `=`.

### Bài tập 3: Thiết lập project chuẩn

1. Tạo thư mục `weather-app`
2. Tạo venv `.venv` bên trong và kích hoạt
3. Cài thư viện `requests`
4. Xuất `requirements.txt`
5. Tạo file `.gitignore` có nội dung `.venv/` và `__pycache__/`
6. Xóa `.venv`, tạo lại venv mới và cài lại từ `requirements.txt`

### Bài tập 4: Sửa lỗi PEP 8

Viết lại đoạn code sau cho đúng PEP 8 và chạy thử:

```text
def TinhTong(A,B):
  Ket_Qua=A+B
  return Ket_Qua
print (TinhTong(3,4))
```

<details>
<summary>💡 Xem đáp án</summary>

```python
def tinh_tong(a, b):
    ket_qua = a + b
    return ket_qua


print(tinh_tong(3, 4))
# Output: 7
```

</details>

## ✅ Checklist hoàn thành

- [ ] Giải thích được Python là gì và dùng để làm gì
- [ ] Cài đặt Python thành công, `python --version` / `python3 --version` chạy được
- [ ] Cài VS Code + Python extension, chọn được interpreter
- [ ] Dùng REPL để thử code, biết thoát REPL
- [ ] Viết và chạy file `.py` từ terminal
- [ ] Đọc hiểu traceback (đọc dòng cuối trước!)
- [ ] Tạo, kích hoạt, thoát và xóa venv
- [ ] Cài thư viện bằng `pip`, tạo và dùng `requirements.txt`
- [ ] Hiểu quy tắc thụt lề 4 dấu cách
- [ ] Biết quy tắc đặt tên PEP 8: `snake_case`, `PascalCase`, `UPPER_CASE`
- [ ] Hoàn thành ít nhất 3 bài tập

## 🚀 Tiếp theo

Bạn đã có một môi trường Python hoàn chỉnh và hiểu cách chạy code! Giờ là lúc học những viên gạch đầu tiên của mọi chương trình: **biến và kiểu dữ liệu**.

**Bài tiếp theo**: [Biến & Kiểu dữ liệu](./02-variables-types.md)

---

💡 **Tips nhớ lâu**:

- **Windows**: tick **"Add to PATH"** khi cài Python
- **Mỗi project một venv**, tên `.venv`, không commit lên Git
- **`python -m pip install`** an toàn hơn `pip install`
- **4 dấu cách** cho mỗi mức thụt lề
- **Đọc dòng cuối traceback trước** khi hoảng loạn 😄
