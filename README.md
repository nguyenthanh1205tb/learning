# 📚 Learning Hub - Unity, Golang & Python

Tài liệu tự học bằng tiếng Việt, đi từ cơ bản đến thực hành dự án.

🌐 **Học trên web**: [nguyenthanh1205tb.github.io/learning](https://nguyenthanh1205tb.github.io/learning/)

## 🗂️ Các khóa học

| Khóa học | Mô tả | Bắt đầu |
| --- | --- | --- |
| 🎮 **Unity** | C# cho Unity, GameObject, Physics, UI, Audio & Animation | [unity/README.md](./unity/README.md) |
| 🐹 **Golang** | Cú pháp Go, struct & interface, error handling, concurrency, REST API | [golang/README.md](./golang/README.md) |
| 🐍 **Python** | Cú pháp Python, cấu trúc dữ liệu, OOP, file, module, advanced Python | [python/README.md](./python/README.md) |

## 📁 Cấu trúc thư mục

```
.
├── unity/    # Khóa học Unity (8 bài)
├── golang/   # Khóa học Golang (10 bài)
└── python/   # Khóa học Python (10 bài)
```

## 🎯 Cách học

1. Mở `README.md` của khóa học bạn chọn
2. Học tuần tự từng bài, gõ lại code ví dụ
3. Làm bài tập cuối mỗi bài và đánh dấu checklist
4. Hoàn thành dự án cuối khóa

## 🌐 Xem website trên máy (tùy chọn)

Website được build bằng [MkDocs Material](https://squidfunk.github.io/mkdocs-material/) và tự động deploy lên GitHub Pages mỗi khi push lên `main`.

```bash
pip install -r requirements.txt
mkdir -p docs && cp -r README.md unity golang python docs/
mkdocs serve   # mở http://127.0.0.1:8000
```
