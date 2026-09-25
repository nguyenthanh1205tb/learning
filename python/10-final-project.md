# 📚 Bài 10: Dự án cuối khóa - Ứng dụng Todo CLI

## 🎯 Mục tiêu bài học

- Xây dựng **từ đầu đến cuối** một ứng dụng dòng lệnh (CLI) quản lý công việc
- **Chỉ dùng standard library** - không cần cài thư viện nào để chạy ứng dụng
- Áp dụng tổng hợp kiến thức cả khóa: hàm, dataclass, Enum, exceptions, pathlib, JSON, module/package, type hints, `match-case`
- Xây dựng giao diện dòng lệnh chuyên nghiệp với **argparse**
- Tổ chức code theo **kiến trúc nhiều tầng** (models → storage → service → cli)
- Viết **automated tests** với **pytest** (và phương án dự phòng bằng `unittest`)
- Biết hướng mở rộng: lưu bằng **SQLite**, làm web API với **FastAPI**

## 📖 1. Tổng quan dự án

### Ứng dụng sẽ làm được gì?

Khi hoàn thành, bạn sẽ có một công cụ quản lý công việc chạy trong terminal:

```bash
python -m todo add "Học Python bài 10" --priority high --due 2026-10-01 --tag study
python -m todo add "Đi chợ mua rau" -t home
python -m todo list
python -m todo done 1
python -m todo stats
```

Kết quả (minh họa - chạy trước ngày 01/10/2026 nên việc 1 chưa bị đánh dấu quá hạn):

```text
➕ Đã thêm:   1. ⬜ 🔴 Học Python bài 10  📅 01/10/2026  #study
➕ Đã thêm:   2. ⬜ 🟡 Đi chợ mua rau  #home
  1. ⬜ 🔴 Học Python bài 10  📅 01/10/2026  #study
  2. ⬜ 🟡 Đi chợ mua rau  #home
✅ Hoàn thành: Học Python bài 10
📊 Thống kê công việc
   Tổng số:        2
   Đã hoàn thành:  1
   Chưa xong:      1
   Quá hạn:        0
   Tiến độ:        [██████████░░░░░░░░░░] 50%
```

### Danh sách tính năng

| Lệnh | Chức năng |
| --- | --- |
| `add TITLE [-p PRIORITY] [-d DATE] [-t TAG]` | Thêm công việc (độ ưu tiên, hạn chót, nhãn) |
| `list [-a] [-p PRIORITY] [-t TAG]` | Liệt kê công việc (lọc, sắp xếp theo độ ưu tiên và hạn) |
| `done ID` / `undo ID` | Đánh dấu hoàn thành / chưa hoàn thành |
| `edit ID [--title ...] [-p ...] [-d ...] [-t ...]` | Sửa công việc |
| `delete ID` | Xóa công việc |
| `clear` | Xóa tất cả công việc đã hoàn thành |
| `stats` | Thống kê tiến độ |

### Kiến trúc: chia thành nhiều tầng

> 🧠 **Ví dụ dễ hiểu**: Hãy tưởng tượng một **nhà hàng**:
>
> - **cli.py** = **nhân viên phục vụ** 🧑‍💼: nhận order từ khách (dòng lệnh), mang món ra (in kết quả). Không tự nấu ăn.
> - **service.py** = **bếp trưởng** 👨‍🍳: biết quy trình nấu (logic nghiệp vụ: thêm, sửa, lọc, thống kê).
> - **storage.py** = **kho nguyên liệu** 🏪: cất và lấy đồ (đọc/ghi file JSON).
> - **models.py** = **công thức món ăn** 📋: định nghĩa "một công việc" gồm những gì.
>
> Mỗi người làm đúng việc của mình. Muốn đổi kho từ tủ lạnh (JSON) sang kho lạnh lớn (SQLite)? Chỉ cần thay **kho**, bếp trưởng và phục vụ không cần thay đổi!

```text
   Người dùng gõ lệnh
          │
          ▼
   ┌──────────────┐     argparse: phân tích lệnh, in kết quả
   │    cli.py    │
   └──────┬───────┘
          ▼
   ┌──────────────┐     Logic nghiệp vụ: add, done, list, stats...
   │  service.py  │
   └──────┬───────┘
          ▼
   ┌──────────────┐     Đọc/ghi JSON bằng pathlib
   │  storage.py  │
   └──────┬───────┘
          ▼
      tasks.json

   models.py (Task, Priority) và exceptions.py được dùng bởi mọi tầng
```

**Tại sao phải chia tầng?**

- **Dễ test**: test logic `service` mà không cần gõ lệnh; test `storage` với file tạm
- **Dễ thay đổi**: đổi giao diện (CLI → web) hoặc đổi nơi lưu (JSON → database) mà không viết lại tất cả
- **Dễ đọc**: mỗi file ngắn, làm một việc rõ ràng

## 📖 2. Bước 1 - Thiết lập project

### Tạo cấu trúc thư mục

```bash
mkdir todo-cli
cd todo-cli

# Tạo và kích hoạt virtual environment (Bài 1)
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# Tạo thư mục
mkdir todo tests
```

Cấu trúc hoàn chỉnh sau khi làm xong:

```text
todo-cli/
├── .venv/                     ← virtual environment (không commit)
├── pyproject.toml             ← cấu hình project & pytest
├── requirements-dev.txt       ← thư viện cho phát triển (pytest)
├── todo/                      ← package chính
│   ├── __init__.py
│   ├── __main__.py            ← cho phép chạy "python -m todo"
│   ├── exceptions.py          ← các lỗi tự định nghĩa
│   ├── models.py              ← Task, Priority
│   ├── storage.py             ← đọc/ghi JSON
│   ├── service.py             ← logic nghiệp vụ
│   └── cli.py                 ← giao diện dòng lệnh (argparse)
└── tests/                     ← automated tests
    ├── conftest.py            ← fixtures dùng chung cho pytest
    ├── test_models.py
    ├── test_storage.py
    ├── test_service.py
    ├── test_cli.py
    └── test_service_unittest.py   ← phương án dự phòng: chạy bằng unittest
```

### File cấu hình

`pyproject.toml` là file cấu hình chuẩn của project Python hiện đại. Ở đây ta dùng nó để cấu hình pytest:

```toml
# file: todo-cli/pyproject.toml
[project]
name = "todo-cli"
version = "1.0.0"
description = "Ứng dụng quản lý công việc trên dòng lệnh"
requires-python = ">=3.10"

[tool.pytest.ini_options]
testpaths = ["tests"]      # Thư mục chứa test
pythonpath = ["."]         # Cho phép test "import todo" từ thư mục gốc
```

```text
# file: todo-cli/requirements-dev.txt
# Ứng dụng KHÔNG cần thư viện ngoài. File này chỉ dành cho việc phát triển/test.
pytest>=7.0
```

> 💡 Tạo thêm file `.gitignore` với nội dung `.venv/`, `__pycache__/`, `.pytest_cache/` nếu bạn dùng Git.

## 📖 3. Bước 2 - Exceptions (`exceptions.py`)

Ta bắt đầu từ những thứ **không phụ thuộc vào ai**: các lỗi tự định nghĩa ([Bài 7](./07-exceptions-files.md)).

```python
# file: todo-cli/todo/exceptions.py
"""Các exception của ứng dụng Todo.

Mọi lỗi đều kế thừa TodoError, nên tầng CLI chỉ cần bắt MỘT loại lỗi
để hiển thị thông báo thân thiện cho người dùng.
"""


class TodoError(Exception):
    """Lỗi gốc của ứng dụng."""


class ValidationError(TodoError):
    """Dữ liệu không hợp lệ (ví dụ: tiêu đề rỗng)."""


class TaskNotFoundError(TodoError):
    """Không tìm thấy công việc với id cho trước."""

    def __init__(self, task_id: int) -> None:
        self.task_id = task_id
        super().__init__(f"Không tìm thấy công việc có id={task_id}")


class StorageError(TodoError):
    """Lỗi khi đọc/ghi file dữ liệu."""
```

**Tại sao cần lỗi gốc `TodoError`?** Tầng CLI chỉ cần viết `except TodoError` là bắt được **mọi lỗi nghiệp vụ** để in thông báo đẹp. Còn những lỗi "bất ngờ" (bug thật sự) sẽ không bị che giấu.

## 📖 4. Bước 3 - Models (`models.py`)

### Làm quen với Enum

Độ ưu tiên chỉ có 3 giá trị: `low`, `medium`, `high`. Dùng chuỗi tự do rất dễ gõ nhầm (`"hight"`, `"Hight"`...). **Enum** (enumeration - kiểu liệt kê) giới hạn chính xác các giá trị hợp lệ:

```python
from enum import Enum


class Color(Enum):
    RED = "red"
    GREEN = "green"


print(Color.RED)                # Thành viên của Enum
# Output: Color.RED
print(Color.RED.value)          # Giá trị bên trong
# Output: red
print(Color("green"))           # Tạo từ giá trị (ví dụ: đọc từ JSON)
# Output: Color.GREEN
print([c.value for c in Color]) # Duyệt tất cả thành viên
# Output: ['red', 'green']

try:
    Color("blue")               # Giá trị không hợp lệ → lỗi ngay
except ValueError as error:
    print(error)
# Output: 'blue' is not a valid Color
```

### Viết models.py

```python
# file: todo-cli/todo/models.py
"""Mô hình dữ liệu: Priority và Task."""

from dataclasses import dataclass, field
from datetime import date, datetime
from enum import Enum
from typing import Any

from .exceptions import ValidationError

MAX_TITLE_LENGTH = 200


class Priority(Enum):
    """Độ ưu tiên của công việc."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

    @property
    def rank(self) -> int:
        """Số càng nhỏ càng quan trọng - dùng để sắp xếp."""
        return {"high": 0, "medium": 1, "low": 2}[self.value]

    @property
    def icon(self) -> str:
        return {"high": "🔴", "medium": "🟡", "low": "🟢"}[self.value]


def _now() -> datetime:
    """Thời điểm hiện tại, bỏ phần micro giây cho gọn."""
    return datetime.now().replace(microsecond=0)


@dataclass
class Task:
    """Một công việc cần làm."""

    id: int
    title: str
    priority: Priority = Priority.MEDIUM
    done: bool = False
    due: date | None = None
    tags: list[str] = field(default_factory=list)       # ✅ Không dùng tags=[] (Bài 4, Bài 6)
    created_at: datetime = field(default_factory=_now)

    def __post_init__(self) -> None:
        """Kiểm tra và chuẩn hóa dữ liệu ngay khi tạo object (fail fast)."""
        self.title = self.title.strip()
        if not self.title:
            raise ValidationError("Tiêu đề công việc không được để trống")
        if len(self.title) > MAX_TITLE_LENGTH:
            raise ValidationError(f"Tiêu đề quá dài (tối đa {MAX_TITLE_LENGTH} ký tự)")
        # Chuẩn hóa nhãn: bỏ khoảng trắng, viết thường, bỏ trùng, sắp xếp
        self.tags = sorted({tag.strip().lower() for tag in self.tags if tag.strip()})

    def is_overdue(self, today: date | None = None) -> bool:
        """Quá hạn = chưa xong VÀ hạn chót đã qua."""
        today = today or date.today()
        return not self.done and self.due is not None and self.due < today

    def to_dict(self) -> dict[str, Any]:
        """Chuyển sang dict chỉ chứa kiểu mà JSON hiểu được."""
        return {
            "id": self.id,
            "title": self.title,
            "priority": self.priority.value,                    # Enum → str
            "done": self.done,
            "due": self.due.isoformat() if self.due else None,  # date → "2026-10-01"
            "tags": self.tags,
            "created_at": self.created_at.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Task":
        """Tạo Task từ dict (đọc từ JSON) - constructor thay thế (Bài 6)."""
        return cls(
            id=int(data["id"]),
            title=data["title"],
            priority=Priority(data.get("priority", "medium")),
            done=bool(data.get("done", False)),
            due=date.fromisoformat(data["due"]) if data.get("due") else None,
            tags=list(data.get("tags", [])),
            created_at=(
                datetime.fromisoformat(data["created_at"]) if data.get("created_at") else _now()
            ),
        )
```

**Giải thích các quyết định thiết kế:**

- **Tại sao không dùng `asdict()`?** Vì `Priority`, `date`, `datetime` **không phải kiểu JSON**. `json.dumps(asdict(task))` sẽ báo `TypeError: Object of type Priority is not JSON serializable` (gặp `date`/`datetime` thì tương tự). Ta tự viết `to_dict`/`from_dict` để chuyển đổi rõ ràng.
- **`__post_init__`**: kiểm tra dữ liệu **ngay khi tạo** object - không bao giờ tồn tại một `Task` có tiêu đề rỗng.
- **`is_overdue(today=None)`**: cho phép truyền `today` vào để **test dễ dàng** (không phụ thuộc vào ngày chạy test).

Thử nhanh trong REPL (đứng ở thư mục `todo-cli/`):

```text
>>> from todo.models import Task, Priority
>>> task = Task(id=1, title="  Học Python  ", priority=Priority.HIGH, tags=["Study", "study "])
>>> task.title, task.tags
('Học Python', ['study'])
>>> task.to_dict()["priority"]
'high'
```

## 📖 5. Bước 4 - Storage (`storage.py`)

Tầng lưu trữ chỉ có 2 nhiệm vụ: **load** (đọc danh sách Task từ file) và **save** (ghi danh sách Task xuống file).

```python
# file: todo-cli/todo/storage.py
"""Lưu trữ danh sách công việc vào file JSON."""

import json
from pathlib import Path

from .exceptions import StorageError, ValidationError
from .models import Task


class JsonStorage:
    """Đọc/ghi danh sách Task vào một file JSON."""

    def __init__(self, path: Path | str) -> None:
        self.path = Path(path)

    def load(self) -> list[Task]:
        if not self.path.exists():
            return []                                   # Lần chạy đầu tiên: chưa có file
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
            return [Task.from_dict(item) for item in raw]
        except json.JSONDecodeError as error:           # ⚠️ Phải đứng TRƯỚC ValueError (nó là con của ValueError)
            raise StorageError(
                f"File dữ liệu bị hỏng: {self.path} (dòng {error.lineno}, cột {error.colno})"
            ) from error
        except (KeyError, TypeError, ValueError, ValidationError) as error:
            raise StorageError(f"Dữ liệu không hợp lệ trong {self.path}: {error!r}") from error
        except OSError as error:
            raise StorageError(f"Không đọc được file {self.path}: {error}") from error

    def save(self, tasks: list[Task]) -> None:
        data = [task.to_dict() for task in tasks]
        text = json.dumps(data, ensure_ascii=False, indent=2)
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            # Ghi ra file tạm rồi đổi tên: nếu máy tắt giữa chừng, file cũ vẫn nguyên vẹn
            temp_path = self.path.with_name(self.path.name + ".tmp")
            temp_path.write_text(text + "\n", encoding="utf-8")
            temp_path.replace(self.path)
        except OSError as error:
            raise StorageError(f"Không ghi được file {self.path}: {error}") from error
```

**Điểm đáng chú ý:**

- **`raise ... from error`**: chuyển lỗi kỹ thuật (`JSONDecodeError`) thành lỗi có ý nghĩa với ứng dụng (`StorageError`), vẫn giữ nguyên nhân gốc để debug ([Bài 7](./07-exceptions-files.md))
- **Thứ tự `except`**: `json.JSONDecodeError` là **con** của `ValueError`, nên phải đứng trước - nếu không, nó sẽ bị `except ValueError` bắt mất
- **Ghi an toàn (atomic write)**: ghi vào `tasks.json.tmp` trước, rồi `replace()` (đổi tên) - thao tác đổi tên gần như tức thời, nên file dữ liệu không bao giờ bị "ghi dở"
- **`ensure_ascii=False`**: file JSON giữ nguyên tiếng Việt, mở ra đọc được

## 📖 6. Bước 5 - Service (`service.py`)

Đây là "bộ não" của ứng dụng - chứa toàn bộ logic nghiệp vụ. Service **không biết** dữ liệu được lưu ở đâu (chỉ gọi `storage.load()`/`save()`) và **không biết** người dùng tương tác thế nào (không có `print` hay `input`).

```python
# file: todo-cli/todo/service.py
"""Logic nghiệp vụ của ứng dụng Todo."""

from dataclasses import replace
from datetime import date
from typing import Protocol

from .exceptions import TaskNotFoundError
from .models import Priority, Task


class Storage(Protocol):
    """Bất kỳ object nào có load() và save() đều dùng được (duck typing - Bài 6)."""

    def load(self) -> list[Task]: ...

    def save(self, tasks: list[Task]) -> None: ...


class TodoService:
    def __init__(self, storage: Storage) -> None:
        self.storage = storage
        self.tasks: list[Task] = storage.load()

    # ---------- Hàm hỗ trợ nội bộ (bắt đầu bằng _) ----------

    def _save(self) -> None:
        self.storage.save(self.tasks)

    def _next_id(self) -> int:
        return max((task.id for task in self.tasks), default=0) + 1

    def _index_of(self, task_id: int) -> int:
        for index, task in enumerate(self.tasks):
            if task.id == task_id:
                return index
        raise TaskNotFoundError(task_id)

    @staticmethod
    def _sort_key(task: Task) -> tuple:
        # Chưa xong trước → ưu tiên cao trước → hạn gần trước (không có hạn xếp cuối) → id
        return (task.done, task.priority.rank, task.due or date.max, task.id)

    # ---------- Các thao tác công khai ----------

    def add(
        self,
        title: str,
        *,
        priority: Priority = Priority.MEDIUM,
        due: date | None = None,
        tags: list[str] | None = None,
    ) -> Task:
        task = Task(id=self._next_id(), title=title, priority=priority, due=due, tags=tags or [])
        self.tasks.append(task)
        self._save()
        return task

    def get(self, task_id: int) -> Task:
        return self.tasks[self._index_of(task_id)]

    def list_tasks(
        self,
        *,
        include_done: bool = False,
        priority: Priority | None = None,
        tag: str | None = None,
    ) -> list[Task]:
        tasks = self.tasks
        if not include_done:
            tasks = [t for t in tasks if not t.done]
        if priority is not None:
            tasks = [t for t in tasks if t.priority == priority]
        if tag is not None:
            tasks = [t for t in tasks if tag.strip().lower() in t.tags]
        return sorted(tasks, key=self._sort_key)

    def complete(self, task_id: int) -> Task:
        return self.edit(task_id, done=True)

    def reopen(self, task_id: int) -> Task:
        return self.edit(task_id, done=False)

    def edit(self, task_id: int, **changes) -> Task:
        """Sửa các trường của Task. Bỏ qua trường có giá trị None."""
        index = self._index_of(task_id)
        changes = {key: value for key, value in changes.items() if value is not None}
        # dataclasses.replace tạo Task MỚI → __post_init__ chạy lại → dữ liệu mới cũng được kiểm tra!
        updated = replace(self.tasks[index], **changes)
        self.tasks[index] = updated
        self._save()
        return updated

    def delete(self, task_id: int) -> Task:
        task = self.tasks.pop(self._index_of(task_id))
        self._save()
        return task

    def clear_completed(self) -> int:
        before = len(self.tasks)
        self.tasks = [t for t in self.tasks if not t.done]
        removed = before - len(self.tasks)
        if removed:
            self._save()
        return removed

    def stats(self, today: date | None = None) -> dict[str, int]:
        total = len(self.tasks)
        done = sum(1 for t in self.tasks if t.done)
        overdue = sum(1 for t in self.tasks if t.is_overdue(today))
        return {"total": total, "done": done, "pending": total - done, "overdue": overdue}
```

**Điểm đáng chú ý:**

- **`Protocol`** (từ `typing`): mô tả "một Storage là thứ có `load()` và `save()`" - đây là **duck typing có type hints**. `JsonStorage` không cần kế thừa gì cả, và sau này `SqliteStorage` cũng thế
- **Keyword-only arguments** (`*` trong `add`): bắt buộc viết `add("...", priority=...)` → code gọi dễ đọc ([Bài 4](./04-functions.md))
- **`dataclasses.replace`**: tạo bản sao với một vài trường thay đổi. Vì tạo object mới, `__post_init__` chạy lại → sửa tiêu đề thành chuỗi rỗng sẽ bị từ chối, và Task cũ **không bị hỏng**
- **`max(..., default=0)`**: danh sách rỗng thì id đầu tiên là 1
- **Sort key là tuple**: Python so sánh tuple lần lượt từng phần tử - kỹ thuật sắp xếp nhiều tiêu chí ([Bài 4](./04-functions.md))

## 📖 7. Bước 6 - Giao diện dòng lệnh (`cli.py`)

### Làm quen với argparse

`sys.argv` ([Bài 8](./08-modules-packages.md)) chứa các tham số dòng lệnh dạng list chuỗi thô. Tự phân tích rất vất vả. Module **argparse** làm tất cả cho bạn: phân tích tham số, chuyển kiểu, kiểm tra lỗi, và **tự sinh trang trợ giúp `--help`**.

```python
import argparse

parser = argparse.ArgumentParser(prog="greet", description="Chào hỏi ai đó")
parser.add_argument("name", help="Tên người cần chào")                   # Positional (bắt buộc)
parser.add_argument("-n", "--times", type=int, default=1, help="Số lần")  # Optional
parser.add_argument("--shout", action="store_true", help="Viết HOA")      # Cờ bật/tắt

# Bình thường: parser.parse_args() đọc từ sys.argv. Ở đây truyền list để minh họa.
args = parser.parse_args(["An", "--times", "2", "--shout"])
print(args)
# Output: Namespace(name='An', times=2, shout=True)

for _ in range(args.times):
    message = f"Xin chào {args.name}!"
    print(message.upper() if args.shout else message)
# Output:
# XIN CHÀO AN!
# XIN CHÀO AN!
```

Với nhiều lệnh con (`add`, `list`, `done`...) giống `git commit`, `git push`, ta dùng **subparsers**:

```python
import argparse

parser = argparse.ArgumentParser(prog="app")
subparsers = parser.add_subparsers(dest="command", required=True)

add_parser = subparsers.add_parser("add")
add_parser.add_argument("title")

done_parser = subparsers.add_parser("done")
done_parser.add_argument("id", type=int)          # argparse tự chuyển "3" → 3

print(parser.parse_args(["add", "Mua sữa"]))
# Output: Namespace(command='add', title='Mua sữa')
print(parser.parse_args(["done", "3"]))
# Output: Namespace(command='done', id=3)
```

### Viết cli.py

```python
# file: todo-cli/todo/cli.py
"""Giao diện dòng lệnh cho ứng dụng Todo."""

import argparse
import os
import sys
from datetime import date
from pathlib import Path

from .exceptions import TodoError
from .models import Priority, Task
from .service import TodoService
from .storage import JsonStorage

DEFAULT_DATA_FILE = Path.home() / ".todo-cli" / "tasks.json"
PRIORITY_CHOICES = [p.value for p in Priority]


# ---------- Hàm tiện ích ----------

def parse_date(text: str) -> date:
    """Dùng làm type= cho argparse: chuỗi 'YYYY-MM-DD' → date."""
    try:
        return date.fromisoformat(text)
    except ValueError:
        raise argparse.ArgumentTypeError(
            f"ngày không hợp lệ '{text}', hãy dùng định dạng YYYY-MM-DD"
        ) from None


def resolve_data_file(cli_value: Path | None) -> Path:
    """Ưu tiên: tham số --file > biến môi trường TODO_FILE > file mặc định."""
    if cli_value is not None:
        return cli_value
    env_value = os.environ.get("TODO_FILE")
    return Path(env_value) if env_value else DEFAULT_DATA_FILE


def format_task(task: Task, today: date | None = None) -> str:
    check = "✅" if task.done else "⬜"
    parts = [f"{task.id:>3}. {check} {task.priority.icon} {task.title}"]
    if task.due:
        due_text = f"📅 {task.due.strftime('%d/%m/%Y')}"
        if task.is_overdue(today):
            due_text += " ⚠️ quá hạn"
        parts.append(due_text)
    if task.tags:
        parts.append(" ".join(f"#{tag}" for tag in task.tags))
    return "  ".join(parts)


def progress_bar(done: int, total: int, width: int = 20) -> str:
    ratio = done / total if total else 0
    filled = round(ratio * width)
    return f"[{'█' * filled}{'░' * (width - filled)}] {ratio:.0%}"


# ---------- Định nghĩa các lệnh ----------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="todo",
        description="📝 Quản lý công việc ngay trên dòng lệnh",
    )
    parser.add_argument(
        "--file", type=Path, default=None,
        help="đường dẫn file dữ liệu (mặc định: biến môi trường TODO_FILE hoặc ~/.todo-cli/tasks.json)",
    )
    sub = parser.add_subparsers(dest="command", required=True, metavar="COMMAND")

    add = sub.add_parser("add", help="thêm công việc mới")
    add.add_argument("title", help="tiêu đề công việc (đặt trong ngoặc kép nếu có dấu cách)")
    add.add_argument("-p", "--priority", choices=PRIORITY_CHOICES, default="medium")
    add.add_argument("-d", "--due", type=parse_date, help="hạn chót, dạng YYYY-MM-DD")
    add.add_argument("-t", "--tag", dest="tags", action="append", default=[],
                     help="nhãn (dùng nhiều lần để gắn nhiều nhãn)")

    ls = sub.add_parser("list", help="liệt kê công việc")
    ls.add_argument("-a", "--all", action="store_true", help="hiện cả công việc đã xong")
    ls.add_argument("-p", "--priority", choices=PRIORITY_CHOICES)
    ls.add_argument("-t", "--tag")

    for name, help_text in [("done", "đánh dấu đã xong"), ("undo", "đánh dấu chưa xong"),
                            ("delete", "xóa công việc")]:
        cmd = sub.add_parser(name, help=help_text)
        cmd.add_argument("id", type=int, help="id của công việc")

    edit = sub.add_parser("edit", help="sửa công việc")
    edit.add_argument("id", type=int)
    edit.add_argument("--title")
    edit.add_argument("-p", "--priority", choices=PRIORITY_CHOICES)
    edit.add_argument("-d", "--due", type=parse_date)
    edit.add_argument("-t", "--tag", dest="tags", action="append",
                      help="thay toàn bộ nhãn bằng các nhãn mới")

    sub.add_parser("clear", help="xóa tất cả công việc đã xong")
    sub.add_parser("stats", help="thống kê tiến độ")
    return parser


# ---------- Thực thi lệnh ----------

def run_command(service: TodoService, args: argparse.Namespace) -> None:
    match args.command:                                     # match-case (Bài 3)
        case "add":
            task = service.add(args.title, priority=Priority(args.priority),
                               due=args.due, tags=args.tags)
            print(f"➕ Đã thêm: {format_task(task)}")
        case "list":
            priority = Priority(args.priority) if args.priority else None
            tasks = service.list_tasks(include_done=args.all, priority=priority, tag=args.tag)
            if not tasks:
                print("🎉 Không có công việc nào!")
            for task in tasks:
                print(format_task(task))
        case "done":
            print(f"✅ Hoàn thành: {service.complete(args.id).title}")
        case "undo":
            print(f"↩️ Mở lại: {service.reopen(args.id).title}")
        case "edit":
            priority = Priority(args.priority) if args.priority else None
            task = service.edit(args.id, title=args.title, priority=priority,
                                due=args.due, tags=args.tags)
            print(f"✏️ Đã cập nhật: {format_task(task)}")
        case "delete":
            print(f"🗑️ Đã xóa: {service.delete(args.id).title}")
        case "clear":
            print(f"🧹 Đã xóa {service.clear_completed()} công việc đã hoàn thành")
        case "stats":
            s = service.stats()
            print("📊 Thống kê công việc")
            print(f"   Tổng số:        {s['total']}")
            print(f"   Đã hoàn thành:  {s['done']}")
            print(f"   Chưa xong:      {s['pending']}")
            print(f"   Quá hạn:        {s['overdue']}")
            print(f"   Tiến độ:        {progress_bar(s['done'], s['total'])}")


def main(argv: list[str] | None = None) -> int:
    """Điểm vào của chương trình. Trả về exit code (0 = thành công)."""
    parser = build_parser()
    args = parser.parse_args(argv)          # argv=None → argparse tự đọc sys.argv
    try:
        service = TodoService(JsonStorage(resolve_data_file(args.file)))
        run_command(service, args)
    except TodoError as error:
        print(f"❌ Lỗi: {error}", file=sys.stderr)
        return 1
    return 0
```

**Điểm đáng chú ý:**

- **`main(argv=None)`**: nhận list tham số → trong test ta gọi `main(["add", "..."])` mà **không cần** chạy terminal thật
- **Trả về exit code**: `0` = thành công, khác `0` = lỗi. Các script/CI dựa vào exit code để biết lệnh có thành công không
- **`type=parse_date`**: argparse gọi hàm này để chuyển đổi; khi raise `ArgumentTypeError`, argparse tự in lỗi đẹp và thoát với mã `2`
- **Lỗi in ra `sys.stderr`**: tách biệt output bình thường (stdout) và thông báo lỗi (stderr)
- **Chỉ bắt `TodoError`**: bug thật sự (ví dụ `AttributeError` do gõ nhầm) vẫn hiện traceback đầy đủ để bạn sửa

## 📖 8. Bước 7 - Kết nối package và chạy thử

### `__init__.py` và `__main__.py`

```python
# file: todo-cli/todo/__init__.py
"""Todo CLI - ứng dụng quản lý công việc trên dòng lệnh."""

__version__ = "1.0.0"
```

File `__main__.py` đặc biệt: khi bạn chạy `python -m todo`, Python sẽ chạy file này ([Bài 8](./08-modules-packages.md)):

```python
# file: todo-cli/todo/__main__.py
"""Cho phép chạy: python -m todo ..."""

import sys

from .cli import main

if __name__ == "__main__":
    sys.exit(main())            # Exit code của main() trở thành exit code của tiến trình
```

### Chạy thử!

Đứng ở thư mục `todo-cli/` (đã kích hoạt venv):

```bash
python -m todo --help
```

```text
usage: todo [-h] [--file FILE] COMMAND ...

📝 Quản lý công việc ngay trên dòng lệnh

positional arguments:
  COMMAND
    add        thêm công việc mới
    list       liệt kê công việc
    done       đánh dấu đã xong
    undo       đánh dấu chưa xong
    delete     xóa công việc
    edit       sửa công việc
    clear      xóa tất cả công việc đã xong
    stats      thống kê tiến độ

options:
  -h, --help   show this help message and exit
  --file FILE  đường dẫn file dữ liệu (mặc định: biến môi trường TODO_FILE
               hoặc ~/.todo-cli/tasks.json)
```

Trong lúc phát triển, nên dùng một file dữ liệu riêng để không lẫn với dữ liệu thật:

```bash
python -m todo --file demo.json add "Học Python bài 10" -p high -d 2026-10-01 -t study
python -m todo --file demo.json add "Đi chợ mua rau" -t home
python -m todo --file demo.json add "Nộp báo cáo" -p high -d 2026-01-15 -t work
python -m todo --file demo.json add "Đọc sách" -p low
python -m todo --file demo.json list
```

```text
➕ Đã thêm:   1. ⬜ 🔴 Học Python bài 10  📅 01/10/2026  #study
➕ Đã thêm:   2. ⬜ 🟡 Đi chợ mua rau  #home
➕ Đã thêm:   3. ⬜ 🔴 Nộp báo cáo  📅 15/01/2026 ⚠️ quá hạn  #work
➕ Đã thêm:   4. ⬜ 🟢 Đọc sách
  3. ⬜ 🔴 Nộp báo cáo  📅 15/01/2026 ⚠️ quá hạn  #work
  1. ⬜ 🔴 Học Python bài 10  📅 01/10/2026  #study
  2. ⬜ 🟡 Đi chợ mua rau  #home
  4. ⬜ 🟢 Đọc sách
```

Để ý thứ tự: ưu tiên **cao** trước, cùng mức ưu tiên thì **hạn gần hơn** trước.

> ⚠️ **Các ngày trong ví dụ chỉ để minh họa.** Dấu `⚠️ quá hạn` được tính bằng cách so hạn chót với **ngày hôm nay trên máy bạn** (`date.today()`), nên kết quả của bạn có thể khác. Output ở trên giả định hôm nay nằm **giữa** 15/01/2026 và 01/10/2026 (việc 3 đã quá hạn, việc 1 thì chưa). Muốn thấy đúng hai trường hợp đó, hãy đổi `-d` của việc 1 thành một ngày **sau** hôm nay và của việc 3 thành một ngày **trước** hôm nay. (Trong test, ta tránh hẳn vấn đề này bằng cách truyền `today=` cố định - xem phần 9.)

```bash
python -m todo --file demo.json done 3
python -m todo --file demo.json edit 4 --title "Đọc sách Clean Code" -t reading
python -m todo --file demo.json list --all
python -m todo --file demo.json list -t study
python -m todo --file demo.json stats
```

```text
✅ Hoàn thành: Nộp báo cáo
✏️ Đã cập nhật:   4. ⬜ 🟢 Đọc sách Clean Code  #reading
  1. ⬜ 🔴 Học Python bài 10  📅 01/10/2026  #study
  2. ⬜ 🟡 Đi chợ mua rau  #home
  4. ⬜ 🟢 Đọc sách Clean Code  #reading
  3. ✅ 🔴 Nộp báo cáo  📅 15/01/2026  #work
  1. ⬜ 🔴 Học Python bài 10  📅 01/10/2026  #study
📊 Thống kê công việc
   Tổng số:        4
   Đã hoàn thành:  1
   Chưa xong:      3
   Quá hạn:        0
   Tiến độ:        [█████░░░░░░░░░░░░░░░] 25%
```

Xử lý lỗi:

```bash
python -m todo --file demo.json done 99
python -m todo --file demo.json add "   "
python -m todo --file demo.json add "Sai ngày" -d 31/12/2026
```

```text
❌ Lỗi: Không tìm thấy công việc có id=99
❌ Lỗi: Tiêu đề công việc không được để trống
usage: todo add [-h] [-p {low,medium,high}] [-d DUE] [-t TAGS] title
todo add: error: argument -d/--due: ngày không hợp lệ '31/12/2026', hãy dùng định dạng YYYY-MM-DD
```

Mở file `demo.json` xem dữ liệu được lưu thế nào:

```json
[
  {
    "id": 1,
    "title": "Học Python bài 10",
    "priority": "high",
    "done": false,
    "due": "2026-10-01",
    "tags": [
      "study"
    ],
    "created_at": "2026-09-25T09:15:02"
  }
]
```

> 💡 **Mẹo**: Đặt biến môi trường để không phải gõ `--file` mỗi lần: `export TODO_FILE=demo.json` (macOS/Linux) hoặc `$env:TODO_FILE="demo.json"` (PowerShell).

## 📖 9. Bước 8 - Viết tests với pytest

### Tại sao cần automated tests?

Mỗi lần sửa code, bạn có muốn **tự gõ lại 20 lệnh** để kiểm tra mọi thứ vẫn chạy đúng? Automated tests là **đoạn code kiểm tra code** - chạy hàng chục kiểm tra chỉ trong **một giây** với một lệnh duy nhất.

> 🧠 **Ví dụ dễ hiểu**: Tests giống **lưới an toàn của diễn viên xiếc** 🎪. Bạn có thể tự tin thử những động tác mới (sửa code, thêm tính năng, refactor), vì nếu có gì sai, lưới sẽ đỡ bạn (test báo đỏ) trước khi khán giả (người dùng) thấy.

### Cài pytest trong venv

```bash
# Đảm bảo đã kích hoạt venv - thấy (.venv) ở đầu dòng lệnh
python -m pip install -r requirements-dev.txt
# hoặc: python -m pip install pytest

python -m pytest --version
# Output (ví dụ): pytest 8.3.3
```

### Quy tắc cơ bản của pytest

- File test tên `test_*.py`, hàm test tên `test_*`
- Kiểm tra bằng câu lệnh **`assert`** bình thường của Python - pytest tự hiển thị chi tiết khi sai
- Kiểm tra exception bằng **`with pytest.raises(LoaiLoi):`**
- **Fixture**: hàm chuẩn bị dữ liệu/tài nguyên cho test, được "tiêm" vào test qua **tên tham số**

Cấu trúc một test theo mô hình **AAA** (Arrange - Act - Assert):

```text
def test_complete_task(service):
    task = service.add("Làm bài")        # Arrange: chuẩn bị
    service.complete(task.id)            # Act: thực hiện hành động cần test
    assert service.get(task.id).done     # Assert: kiểm tra kết quả
```

### conftest.py - Fixtures dùng chung

```python
# file: todo-cli/tests/conftest.py
"""Fixtures dùng chung cho mọi file test - pytest tự động tìm file này."""

import pytest

from todo.service import TodoService
from todo.storage import JsonStorage


@pytest.fixture
def data_file(tmp_path):
    """tmp_path là fixture CÓ SẴN của pytest: một thư mục tạm, mới tinh cho mỗi test."""
    return tmp_path / "tasks.json"


@pytest.fixture
def storage(data_file):
    return JsonStorage(data_file)


@pytest.fixture
def service(storage):
    return TodoService(storage)
```

> 🧠 Mỗi test nhận một thư mục tạm **riêng biệt** → các test **không ảnh hưởng lẫn nhau** và **không đụng vào dữ liệu thật** của bạn.

### Test models

```python
# file: todo-cli/tests/test_models.py
from datetime import date, datetime

import pytest

from todo.exceptions import ValidationError
from todo.models import Priority, Task


def test_title_is_stripped():
    task = Task(id=1, title="   Học Python   ")
    assert task.title == "Học Python"


@pytest.mark.parametrize("bad_title", ["", "   ", "x" * 201])
def test_invalid_title_raises(bad_title):
    with pytest.raises(ValidationError):
        Task(id=1, title=bad_title)


def test_tags_are_normalized():
    task = Task(id=1, title="Việc", tags=["Work", " work ", "", "Home"])
    assert task.tags == ["home", "work"]


@pytest.mark.parametrize(
    ("due", "done", "expected"),
    [
        (date(2026, 1, 1), False, True),     # Quá hạn, chưa xong → quá hạn
        (date(2026, 1, 1), True, False),     # Đã xong → không tính quá hạn
        (date(2027, 1, 1), False, False),    # Chưa tới hạn
        (None, False, False),                # Không có hạn chót
    ],
)
def test_is_overdue(due, done, expected):
    task = Task(id=1, title="Việc", due=due, done=done)
    assert task.is_overdue(today=date(2026, 6, 1)) is expected


def test_priority_order():
    ranks = sorted(Priority, key=lambda p: p.rank)
    assert ranks == [Priority.HIGH, Priority.MEDIUM, Priority.LOW]


def test_dict_round_trip():
    task = Task(
        id=7,
        title="Viết test",
        priority=Priority.HIGH,
        due=date(2026, 12, 31),
        tags=["dev"],
        created_at=datetime(2026, 9, 25, 8, 30),
    )
    data = task.to_dict()
    assert data["priority"] == "high"
    assert data["due"] == "2026-12-31"
    assert Task.from_dict(data) == task          # __eq__ do dataclass tự sinh
```

`@pytest.mark.parametrize` chạy **cùng một hàm test với nhiều bộ dữ liệu** - mỗi bộ được tính là một test riêng. Viết một lần, kiểm tra nhiều trường hợp!

### Test storage

```python
# file: todo-cli/tests/test_storage.py
import json

import pytest

from todo.exceptions import StorageError
from todo.models import Task
from todo.storage import JsonStorage


def test_load_missing_file_returns_empty_list(storage):
    assert storage.load() == []


def test_save_then_load_returns_same_tasks(storage):
    tasks = [Task(id=1, title="Học Python"), Task(id=2, title="Đi chợ", done=True)]
    storage.save(tasks)
    assert storage.load() == tasks


def test_file_is_utf8_json_with_vietnamese(storage, data_file):
    storage.save([Task(id=1, title="Học tiếng Việt")])
    text = data_file.read_text(encoding="utf-8")
    assert "Học tiếng Việt" in text                  # ensure_ascii=False hoạt động
    assert json.loads(text)[0]["title"] == "Học tiếng Việt"


def test_save_creates_parent_folders(tmp_path):
    path = tmp_path / "a" / "b" / "tasks.json"
    JsonStorage(path).save([])
    assert path.exists()


def test_corrupted_json_raises_storage_error(storage, data_file):
    data_file.write_text("{ đây không phải JSON", encoding="utf-8")
    with pytest.raises(StorageError, match="bị hỏng"):
        storage.load()


def test_invalid_task_data_raises_storage_error(storage, data_file):
    data_file.write_text('[{"id": 1}]', encoding="utf-8")        # Thiếu "title"
    with pytest.raises(StorageError, match="không hợp lệ"):
        storage.load()
```

### Test service

```python
# file: todo-cli/tests/test_service.py
from datetime import date

import pytest

from todo.exceptions import TaskNotFoundError, ValidationError
from todo.models import Priority
from todo.service import TodoService


def test_add_assigns_incrementing_ids(service):
    first = service.add("Việc A")
    second = service.add("Việc B")
    assert (first.id, second.id) == (1, 2)


def test_tasks_are_persisted(service, storage):
    service.add("Lưu xuống file")
    reloaded = TodoService(storage)                   # Giống như mở lại ứng dụng
    assert [t.title for t in reloaded.list_tasks()] == ["Lưu xuống file"]


def test_complete_and_reopen(service):
    task = service.add("Làm bài tập")
    service.complete(task.id)
    assert service.get(task.id).done is True
    service.reopen(task.id)
    assert service.get(task.id).done is False


def test_unknown_id_raises(service):
    with pytest.raises(TaskNotFoundError, match="id=99"):
        service.get(99)


def test_delete(service):
    task = service.add("Xóa tôi đi")
    service.delete(task.id)
    with pytest.raises(TaskNotFoundError):
        service.get(task.id)


def test_list_hides_done_and_sorts_by_priority_then_due(service):
    service.add("Thấp", priority=Priority.LOW)
    service.add("Cao - hạn xa", priority=Priority.HIGH, due=date(2026, 12, 1))
    service.add("Cao - hạn gần", priority=Priority.HIGH, due=date(2026, 10, 1))
    finished = service.add("Đã xong", priority=Priority.HIGH)
    service.complete(finished.id)

    titles = [t.title for t in service.list_tasks()]
    assert titles == ["Cao - hạn gần", "Cao - hạn xa", "Thấp"]

    all_titles = [t.title for t in service.list_tasks(include_done=True)]
    assert all_titles[-1] == "Đã xong"


def test_filter_by_priority_and_tag(service):
    service.add("A", priority=Priority.HIGH, tags=["work"])
    service.add("B", priority=Priority.LOW, tags=["work"])
    service.add("C", priority=Priority.HIGH, tags=["home"])
    assert [t.title for t in service.list_tasks(priority=Priority.HIGH)] == ["A", "C"]
    assert [t.title for t in service.list_tasks(tag="WORK")] == ["A", "B"]


def test_edit_updates_only_given_fields(service):
    task = service.add("Tên cũ", priority=Priority.LOW, tags=["x"])
    service.edit(task.id, title="Tên mới")
    updated = service.get(task.id)
    assert updated.title == "Tên mới"
    assert updated.priority == Priority.LOW           # Không truyền → giữ nguyên
    assert updated.tags == ["x"]


def test_edit_rejects_empty_title_and_keeps_old_task(service):
    task = service.add("Tên cũ")
    with pytest.raises(ValidationError):
        service.edit(task.id, title="   ")
    assert service.get(task.id).title == "Tên cũ"


def test_clear_completed(service):
    for title in ["A", "B", "C"]:
        service.add(title)
    service.complete(1)
    service.complete(3)
    assert service.clear_completed() == 2
    assert [t.title for t in service.list_tasks(include_done=True)] == ["B"]


def test_stats(service):
    service.add("Quá hạn", due=date(2026, 1, 1))
    service.add("Chưa tới hạn", due=date(2027, 1, 1))
    service.complete(service.add("Xong", due=date(2026, 1, 1)).id)
    assert service.stats(today=date(2026, 6, 1)) == {
        "total": 3,
        "done": 1,
        "pending": 2,
        "overdue": 1,
    }
```

### Test CLI

Fixture có sẵn **`capsys`** của pytest "bắt" mọi thứ được `print` ra stdout/stderr để kiểm tra:

```python
# file: todo-cli/tests/test_cli.py
import pytest

from todo.cli import main, progress_bar


def run(data_file, *args):
    """Gọi CLI như thể người dùng gõ: todo --file <data_file> <args...>"""
    return main(["--file", str(data_file), *args])


def test_add_and_list(data_file, capsys):
    assert run(data_file, "add", "Học argparse", "-p", "high", "-t", "study") == 0
    assert run(data_file, "list") == 0
    output = capsys.readouterr().out
    assert "Học argparse" in output
    assert "🔴" in output
    assert "#study" in output


def test_empty_list_message(data_file, capsys):
    assert run(data_file, "list") == 0
    assert "Không có công việc nào" in capsys.readouterr().out


def test_done_with_unknown_id_returns_exit_code_1(data_file, capsys):
    assert run(data_file, "done", "42") == 1
    assert "Không tìm thấy" in capsys.readouterr().err


def test_invalid_date_exits_with_code_2(data_file, capsys):
    with pytest.raises(SystemExit) as exc_info:        # argparse gọi sys.exit(2) khi tham số sai
        run(data_file, "add", "Sai ngày", "--due", "31/12/2026")
    assert exc_info.value.code == 2
    assert "YYYY-MM-DD" in capsys.readouterr().err


def test_stats_output(data_file, capsys):
    run(data_file, "add", "A")
    run(data_file, "add", "B")
    run(data_file, "done", "1")
    capsys.readouterr()                                 # Bỏ output của các lệnh trước
    run(data_file, "stats")
    output = capsys.readouterr().out
    assert "Đã hoàn thành:  1" in output
    assert "50%" in output


@pytest.mark.parametrize(
    ("done", "total", "expected"),
    [(0, 0, "0%"), (1, 4, "25%"), (4, 4, "100%")],
)
def test_progress_bar(done, total, expected):
    assert progress_bar(done, total).endswith(expected)
```

### Chạy tests

Đứng ở thư mục `todo-cli/`:

```bash
python -m pytest
```

```text
============================= test session starts ==============================
platform linux -- Python 3.11.9, pytest-8.3.3, pluggy-1.5.0
rootdir: /home/user/todo-cli
configfile: pyproject.toml
testpaths: tests
collected 40 items

tests/test_cli.py ........                                               [ 20%]
tests/test_models.py ...........                                         [ 47%]
tests/test_service.py ...........                                        [ 75%]
tests/test_service_unittest.py ....                                      [ 85%]
tests/test_storage.py ......                                             [100%]

============================== 40 passed in 0.14s ==============================
```

Các tùy chọn hữu ích:

```bash
python -m pytest -v                         # Hiện tên từng test
python -m pytest tests/test_service.py      # Chỉ chạy một file
python -m pytest -k "stats or edit"         # Chỉ chạy test có tên chứa "stats" hoặc "edit"
python -m pytest -x                         # Dừng ngay khi có test đầu tiên thất bại
python -m pytest --lf                       # Chỉ chạy lại các test thất bại lần trước
```

### Khi một test thất bại

Thử cố tình làm hỏng code: trong `service.py`, đổi `_sort_key` thành `(task.done, task.id)` rồi chạy lại. pytest sẽ chỉ rõ:

```text
    def test_list_hides_done_and_sorts_by_priority_then_due(service):
        ...
>       assert titles == ["Cao - hạn gần", "Cao - hạn xa", "Thấp"]
E       AssertionError: assert ['Thấp', 'Cao...ao - hạn gần'] == ['Cao - hạn g...n xa', 'Thấp']
E
E         At index 0 diff: 'Thấp' != 'Cao - hạn gần'
E         Use -v to get more diff
```

Nhờ `assert` thông thường mà pytest vẫn hiển thị chi tiết giá trị thực tế và mong đợi - đó là "phép thuật" của pytest! Nhớ hoàn tác thay đổi sau khi thử.

## 📖 10. Phương án dự phòng: chạy test bằng unittest

> 📝 **Ghi chú**: Nếu bạn **không cài được pytest** (máy không có internet, môi trường bị hạn chế...), Python có sẵn module **`unittest`** trong standard library. Các file test ở trên dùng tính năng riêng của pytest (fixture, `pytest.raises`) nên **cần pytest** để chạy. File dưới đây viết theo phong cách `unittest` nên **chạy được bằng cả hai**: `python -m unittest` (không cần cài gì) và `python -m pytest` (pytest hiểu được `unittest.TestCase`).

```python
# file: todo-cli/tests/test_service_unittest.py
"""Test viết bằng unittest - chạy được KHÔNG cần cài pytest.

Chạy: python -m unittest discover -s tests -p "test_*unittest.py" -v
"""

import tempfile
import unittest
from datetime import date
from pathlib import Path

from todo.exceptions import TaskNotFoundError
from todo.models import Priority
from todo.service import TodoService
from todo.storage import JsonStorage


class TodoServiceTest(unittest.TestCase):
    def setUp(self):
        """Chạy TRƯỚC mỗi test - giống fixture của pytest."""
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)                # Tự dọn dẹp SAU mỗi test
        self.storage = JsonStorage(Path(temp_dir.name) / "tasks.json")
        self.service = TodoService(self.storage)

    def test_add_and_persist(self):
        self.service.add("Học unittest")
        reloaded = TodoService(self.storage)
        self.assertEqual([t.title for t in reloaded.list_tasks()], ["Học unittest"])

    def test_complete(self):
        task = self.service.add("Làm bài")
        self.service.complete(task.id)
        self.assertTrue(self.service.get(task.id).done)

    def test_unknown_id_raises(self):
        with self.assertRaises(TaskNotFoundError):
            self.service.delete(123)

    def test_sort_by_priority_then_due(self):
        self.service.add("Thấp", priority=Priority.LOW)
        self.service.add("Cao", priority=Priority.HIGH, due=date(2026, 12, 1))
        self.service.add("Cao gấp", priority=Priority.HIGH, due=date(2026, 10, 1))
        titles = [t.title for t in self.service.list_tasks()]
        self.assertEqual(titles, ["Cao gấp", "Cao", "Thấp"])


if __name__ == "__main__":
    unittest.main()
```

Chạy bằng unittest (từ thư mục `todo-cli/`):

```bash
python -m unittest discover -s tests -p "test_*unittest.py" -v
```

```text
test_add_and_persist (test_service_unittest.TodoServiceTest.test_add_and_persist) ... ok
test_complete (test_service_unittest.TodoServiceTest.test_complete) ... ok
test_sort_by_priority_then_due (test_service_unittest.TodoServiceTest.test_sort_by_priority_then_due) ... ok
test_unknown_id_raises (test_service_unittest.TodoServiceTest.test_unknown_id_raises) ... ok

----------------------------------------------------------------------
Ran 4 tests in 0.004s

OK
```

> ⚠️ Tham số `-p "test_*unittest.py"` giới hạn unittest chỉ nạp file này. Nếu để unittest nạp cả các file test kiểu pytest khi **chưa cài pytest**, nó sẽ báo `ModuleNotFoundError: No module named 'pytest'`.

| | pytest | unittest |
| --- | --- | --- |
| Cài đặt | `pip install pytest` | Có sẵn |
| Viết test | Hàm + `assert` thường | Class kế thừa `TestCase` + `self.assertEqual`... |
| Chuẩn bị dữ liệu | Fixture (linh hoạt, tái sử dụng) | `setUp` / `tearDown` |
| Nhiều bộ dữ liệu | `@pytest.mark.parametrize` | `self.subTest(...)` |
| Thông báo lỗi | Rất chi tiết | Khá chi tiết |

## 📖 11. Bước 9 - Kiểm tra chất lượng code (tùy chọn)

```bash
python -m pip install mypy ruff

mypy todo            # Kiểm tra type hints (Bài 8)
ruff check .         # Tìm lỗi phong cách, import thừa, bug tiềm ẩn
ruff format .        # Tự động format code theo chuẩn
```

Đo **độ bao phủ (coverage)** - bao nhiêu phần trăm code đã được test chạy qua:

```bash
python -m pip install pytest-cov
python -m pytest --cov=todo --cov-report=term-missing
```

## 📖 12. Hướng mở rộng

Kiến trúc nhiều tầng giúp mở rộng dễ dàng. Dưới đây là hai hướng phổ biến.

### Mở rộng 1: Lưu bằng SQLite (vẫn chỉ dùng standard library!)

**SQLite** là cơ sở dữ liệu nằm gọn trong **một file**, module `sqlite3` có sẵn trong Python. Chỉ cần viết một class mới có `load()` và `save()` - **service và CLI không cần sửa gì**:

```python
# file: todo-cli/todo/sqlite_storage.py
"""Lưu trữ bằng SQLite - thay thế JsonStorage mà không cần sửa service/cli."""

import json
import sqlite3
from pathlib import Path

from .exceptions import StorageError
from .models import Task

SCHEMA = """
CREATE TABLE IF NOT EXISTS tasks (
    id          INTEGER PRIMARY KEY,
    title       TEXT    NOT NULL,
    priority    TEXT    NOT NULL,
    done        INTEGER NOT NULL DEFAULT 0,
    due         TEXT,
    tags        TEXT    NOT NULL DEFAULT '[]',
    created_at  TEXT    NOT NULL
)
"""


class SqliteStorage:
    def __init__(self, path: Path | str) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            conn.execute(SCHEMA)

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row             # Truy cập cột bằng tên: row["title"]
        return conn

    def load(self) -> list[Task]:
        try:
            with self._connect() as conn:
                rows = conn.execute("SELECT * FROM tasks ORDER BY id").fetchall()
        except sqlite3.Error as error:
            raise StorageError(f"Lỗi database: {error}") from error
        return [
            Task.from_dict({**dict(row), "done": bool(row["done"]), "tags": json.loads(row["tags"])})
            for row in rows
        ]

    def save(self, tasks: list[Task]) -> None:
        rows = [
            {**task.to_dict(), "done": int(task.done), "tags": json.dumps(task.tags)}
            for task in tasks
        ]
        try:
            with self._connect() as conn:            # "with" của sqlite3 = một transaction
                conn.execute("DELETE FROM tasks")
                conn.executemany(
                    "INSERT INTO tasks (id, title, priority, done, due, tags, created_at) "
                    "VALUES (:id, :title, :priority, :done, :due, :tags, :created_at)",
                    rows,
                )
        except sqlite3.Error as error:
            raise StorageError(f"Lỗi database: {error}") from error
```

Dùng thử:

```text
>>> from todo.service import TodoService
>>> from todo.sqlite_storage import SqliteStorage
>>> service = TodoService(SqliteStorage("tasks.db"))
>>> service.add("Lưu bằng SQLite").id
1
>>> [t.title for t in TodoService(SqliteStorage("tasks.db")).list_tasks()]
['Lưu bằng SQLite']
```

> 💡 **Luôn dùng tham số `?` hoặc `:ten`** trong câu SQL như trên, **không bao giờ** dùng f-string để ghép dữ liệu người dùng vào SQL - tránh lỗ hổng **SQL Injection**. Bài tập: thêm tùy chọn `--db sqlite` cho CLI để chọn nơi lưu trữ.

### Mở rộng 2: Web API với FastAPI

Muốn làm app web/mobile dùng chung dữ liệu? Thêm một tầng giao diện mới - **web API** - mà vẫn dùng lại nguyên `TodoService`:

```bash
python -m pip install "fastapi[standard]"
```

```python
# file: todo-cli/api.py
"""Web API cho Todo - chạy: fastapi dev api.py  →  mở http://127.0.0.1:8000/docs"""

from datetime import date

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from todo.exceptions import TaskNotFoundError, ValidationError
from todo.models import Priority
from todo.service import TodoService
from todo.storage import JsonStorage

app = FastAPI(title="Todo API")
service = TodoService(JsonStorage("api-tasks.json"))


class TaskIn(BaseModel):                   # Pydantic tự kiểm tra dữ liệu JSON gửi lên
    title: str
    priority: Priority = Priority.MEDIUM
    due: date | None = None
    tags: list[str] = []


@app.get("/tasks")
def list_tasks(include_done: bool = False):
    return [task.to_dict() for task in service.list_tasks(include_done=include_done)]


@app.post("/tasks", status_code=201)
def create_task(data: TaskIn):
    try:
        task = service.add(data.title, priority=data.priority, due=data.due, tags=data.tags)
    except ValidationError as error:
        raise HTTPException(status_code=422, detail=str(error))
    return task.to_dict()


@app.post("/tasks/{task_id}/done")
def complete_task(task_id: int):
    try:
        return service.complete(task_id).to_dict()
    except TaskNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error))
```

FastAPI tự sinh trang tài liệu tương tác tại `/docs` - bạn có thể thử gọi API ngay trên trình duyệt. Tìm hiểu thêm tại [fastapi.tiangolo.com](https://fastapi.tiangolo.com).

### Thêm ý tưởng mở rộng

- 🔁 **Công việc lặp lại**: `--repeat daily/weekly`, khi `done` tự tạo công việc cho lần tiếp theo
- 🔍 **Tìm kiếm**: lệnh `search TEXT` tìm theo tiêu đề (không phân biệt hoa thường, không dấu)
- 📤 **Xuất/nhập**: `export tasks.csv` / `import tasks.csv` bằng module `csv` ([Bài 7](./07-exceptions-files.md))
- 🎨 **Giao diện đẹp hơn**: dùng thư viện `rich` để vẽ bảng có màu
- 🔔 **Nhắc việc**: script chạy định kỳ (cron / Task Scheduler) in ra việc sắp tới hạn
- 📦 **Đóng gói**: thêm `[project.scripts] todo = "todo.cli:main"` vào `pyproject.toml`, chạy `pip install -e .` → gõ `todo` ở bất kỳ đâu thay vì `python -m todo`

## ⚠️ Lỗi thường gặp

### 1. `ModuleNotFoundError: No module named 'todo'`

**Nguyên nhân**: Chạy lệnh ở sai thư mục (ví dụ đứng trong `todo-cli/todo/` hoặc `todo-cli/tests/`).

**Cách sửa**: Luôn đứng ở **thư mục gốc** `todo-cli/` rồi chạy `python -m todo ...` và `python -m pytest`.

### 2. `ImportError: attempted relative import with no known parent package`

**Nguyên nhân**: Chạy trực tiếp `python todo/cli.py`. Các file trong package dùng relative import (`from .models import ...`) nên phải chạy như một phần của package.

**Cách sửa**: Dùng `python -m todo` ([Bài 8](./08-modules-packages.md)).

### 3. `No module named pytest` / `pytest: command not found`

**Nguyên nhân**: Chưa kích hoạt venv, hoặc cài pytest vào Python khác.

**Cách sửa**: Kích hoạt venv (`(.venv)` hiện ở đầu dòng lệnh), rồi `python -m pip install pytest` và chạy bằng `python -m pytest`. Hoặc dùng phương án `unittest` ở phần 10.

### 4. Test ghi vào file dữ liệu thật

```text
def test_add():
    service = TodoService(JsonStorage("tasks.json"))   # ❌ Ghi vào file thật, test sau bị ảnh hưởng
    ...

def test_add(service):                                 # ✅ Dùng fixture với tmp_path
    ...
```

### 5. Test phụ thuộc vào ngày hiện tại

```text
def test_overdue():
    task = Task(id=1, title="x", due=date(2026, 10, 1))
    assert not task.is_overdue()          # ❌ Hôm nay thì pass, sau 01/10/2026 thì fail!

def test_overdue():
    task = Task(id=1, title="x", due=date(2026, 10, 1))
    assert not task.is_overdue(today=date(2026, 9, 1))   # ✅ Cố định "hôm nay"
```

### 6. `TypeError: Object of type Priority is not JSON serializable` (hoặc `date`, `datetime`)

**Nguyên nhân**: Dùng `json.dumps(asdict(task))` trực tiếp - `date`, `datetime`, `Enum` không phải kiểu JSON.

**Cách sửa**: Chuyển đổi rõ ràng như `Task.to_dict()` (`.isoformat()`, `.value`).

### 7. Lỗi hiển thị emoji / tiếng Việt trên Windows khi chuyển hướng output

```text
python -m todo list > out.txt
# UnicodeEncodeError: 'charmap' codec can't encode character '⬜'
```

**Cách sửa**: Bật chế độ UTF-8 của Python: `set PYTHONUTF8=1` (cmd) hoặc `$env:PYTHONUTF8=1` (PowerShell), hoặc chạy `python -X utf8 -m todo list > out.txt`.

### 8. Bắt exception quá rộng ở tầng CLI

```text
try:
    run_command(service, args)
except Exception:                 # ❌ Che giấu cả bug thật (AttributeError do gõ nhầm...)
    print("Có lỗi xảy ra")

except TodoError as error:        # ✅ Chỉ bắt lỗi nghiệp vụ đã biết
    print(f"❌ Lỗi: {error}", file=sys.stderr)
```

## 🏋️ Bài tập

### Bài tập 1: Lệnh `search`

Thêm lệnh `todo search TEXT` tìm công việc có tiêu đề chứa `TEXT` (không phân biệt hoa thường). Viết method `TodoService.search()` và ít nhất 3 test.

### Bài tập 2: Hạn chót tương đối

Cho phép `--due` nhận thêm các giá trị `today`, `tomorrow`, `+3d` (3 ngày nữa), `+2w` (2 tuần nữa). Sửa hàm `parse_date` và viết test dùng `@pytest.mark.parametrize`.

### Bài tập 3: Xuất/nhập CSV

Thêm lệnh `export FILE.csv` và `import FILE.csv` dùng `csv.DictWriter`/`DictReader`. Công việc nhập vào phải được cấp id mới để không trùng. Test bằng `tmp_path`.

### Bài tập 4: Hoàn tác (undo) thao tác xóa

Lưu công việc bị xóa gần nhất vào file `trash.json`. Thêm lệnh `restore` khôi phục lại. Gợi ý: có thể dùng `deque(maxlen=10)` để lưu 10 lần xóa gần nhất ([Bài 5](./05-data-structures.md)).

### Bài tập 5: SQLite + lựa chọn storage

Hoàn thiện `SqliteStorage`, thêm tùy chọn `--storage {json,sqlite}` cho CLI. Viết test chạy **cùng một bộ test** cho cả hai loại storage bằng fixture có tham số:

```text
@pytest.fixture(params=["json", "sqlite"])
def storage(request, tmp_path):
    if request.param == "json":
        return JsonStorage(tmp_path / "tasks.json")
    return SqliteStorage(tmp_path / "tasks.db")
```

### Bài tập 6 (thử thách): Web API

Hoàn thiện `api.py` với đầy đủ các endpoint: `GET /tasks/{id}`, `PATCH /tasks/{id}`, `DELETE /tasks/{id}`, `GET /stats`. Viết test với `fastapi.testclient.TestClient`.

## ✅ Checklist hoàn thành

- [ ] Tạo project với venv, `pyproject.toml`, `requirements-dev.txt`
- [ ] Hiểu kiến trúc nhiều tầng: models → storage → service → cli
- [ ] Viết custom exception với lỗi gốc `TodoError`
- [ ] Dùng `Enum` và `@dataclass` với `__post_init__`, `field(default_factory=...)`
- [ ] Chuyển đổi object ↔ JSON với `to_dict()`/`from_dict()`
- [ ] Đọc/ghi file an toàn với `pathlib`, `encoding="utf-8"`, ghi file tạm rồi `replace()`
- [ ] Xây dựng CLI với `argparse` và subparsers
- [ ] Chạy ứng dụng bằng `python -m todo` nhờ `__main__.py`
- [ ] Cài pytest trong venv, viết test với fixture, `parametrize`, `pytest.raises`, `capsys`
- [ ] Chạy được test bằng `unittest` khi không có pytest
- [ ] Tất cả test đều pass ✅
- [ ] Hoàn thành ít nhất 2 bài tập mở rộng
- [ ] Đưa project lên GitHub 🚀

## 🚀 Tiếp theo

🎉 **Chúc mừng bạn đã hoàn thành khóa học Python!**

Từ dòng `print("Hello World")` đầu tiên, giờ bạn đã tự xây dựng được một ứng dụng hoàn chỉnh có kiến trúc rõ ràng, xử lý lỗi cẩn thận và được kiểm thử tự động. Đó là nền tảng vững chắc cho bất kỳ hướng đi nào tiếp theo:

- 🌐 **Web Backend**: FastAPI, Django, Flask
- 📊 **Data Science**: pandas, NumPy, Matplotlib, Jupyter
- 🤖 **AI / Machine Learning**: scikit-learn, PyTorch
- ⚙️ **Tự động hóa & DevOps**: script, Ansible, CI/CD
- 🕷️ **Thu thập dữ liệu web**: httpx, BeautifulSoup, Playwright

**Quay lại**: [Tổng quan khóa học](./README.md)

---

💡 **Tips nghề nghiệp**:

- **Chia tầng rõ ràng** - mỗi module làm một việc
- **Viết test ngay từ đầu** - tests là lưới an toàn cho mọi thay đổi
- **Không để logic nghiệp vụ lẫn với `print`/`input`** - dễ test, dễ tái sử dụng
- **Chỉ bắt lỗi bạn hiểu** - lỗi lạ phải hiện rõ để sửa
- **Đọc code của người khác** trên GitHub - cách học nhanh nhất sau khóa học
- **Tiếp tục xây dựng project** - kiến thức chỉ thực sự là của bạn khi bạn dùng nó!
