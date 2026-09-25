# 🎮 Hướng dẫn học Unity từ đầu

## 📋 Tổng quan

Chào mừng bạn đến với khóa học Unity! Đây là tài liệu hướng dẫn đầy đủ để học Unity từ cơ bản đến nâng cao, tập trung vào những kiến thức quan trọng nhất mà bạn sẽ sử dụng thường xuyên khi làm game.

### 🎯 Mục tiêu khóa học

- Học C# cơ bản cần thiết cho Unity
- Hiểu các khái niệm cốt lõi của Unity
- Thành thạo scripting và physics
- Tạo được game đơn giản hoàn chỉnh

### ⏱️ Thời gian học tập

- **Tổng thời gian**: 4-6 tuần (2-3 giờ/ngày)
- **Cấp độ**: Người mới bắt đầu
- **Kết quả**: Có thể tạo game 2D/3D đơn giản

## 🛠️ Yêu cầu hệ thống

### Phần mềm cần cài đặt

1. **Unity Hub** - Quản lý các phiên bản Unity
2. **Unity Editor** - Phiên bản LTS (Long Term Support) mới nhất
3. **Visual Studio** hoặc **Visual Studio Code** - IDE để code C#

### Tài nguyên học tập

- Máy tính Windows/Mac/Linux
- Kết nối internet để tải Unity và tài nguyên
- Chuột và bàn phím (gamepad tùy chọn)

## 📚 Cấu trúc khóa học

### Tuần 1: Nền tảng

- [x] **Bài 1**: [C# cơ bản cho Unity](./01-csharp-basics.md)
- [x] **Bài 2**: [Unity Fundamentals (GameObject, Component, Transform)](./02-unity-fundamentals.md)
- [x] **Bài 3**: [Physics System (Rigidbody, Collider)](./03-physics-system.md)

### Tuần 2: Scripting & Logic

- [x] **Bài 4**: [Scripting Essentials (MonoBehaviour, Input, Movement)](./04-scripting-essentials.md)
- [x] **Bài 5**: [UI System (Canvas, Button, Text)](./05-ui-system.md)

### Tuần 3: Audio & Animation

- [x] **Bài 6**: [Audio & Animation (Audio Source, Animator)](./06-audio-animation.md)

### Tuần 4: Tổng hợp & Nâng cao

- [x] **Bài 7**: [Resources & Best Practices](./07-resources.md)
- [x] **Bài 8**: [Dự án cuối khóa - Game 2D "Coin Collector" hoàn chỉnh](./08-final-project.md)

> 💡 Bài 1-2 có nhiều kiến thức C#/Unity nâng cao (Generics, Events, Object Pooling, ScriptableObject). Nếu thấy khó, hãy đọc phần cơ bản trước, làm tiếp các bài sau rồi quay lại - Bài 8 sẽ dùng lại hầu hết các kiến thức này trong một game thực tế.

## 🚀 Bắt đầu học

### Bước 1: Cài đặt Unity

1. Tải Unity Hub từ [unity.com](https://unity.com)
2. Tạo tài khoản Unity ID
3. Cài đặt Unity Editor LTS mới nhất
4. Cài đặt Visual Studio (Windows) hoặc VS Code

### Bước 2: Tạo project đầu tiên

1. Mở Unity Hub
2. Click "New Project"
3. Chọn template "3D" hoặc "2D" (Unity 6: **Universal 3D** hoặc **Universal 2D**)
4. Đặt tên project và chọn thư mục lưu
5. ⚠️ Khóa học dùng hệ thống Input cũ (`Input.GetKey`...). Với Unity 6, vào **Edit → Project Settings → Player → Other Settings → Active Input Handling** và chọn **Both**, nếu không sẽ gặp lỗi `InvalidOperationException` khi chạy (xem Bài 4)

> 💡 **Phiên bản Unity**: Tài liệu viết cho Unity 6 LTS, và vẫn dùng được với Unity 2022 LTS. Một số API đổi tên ở Unity 6 (vd `Rigidbody.velocity` → `linearVelocity`, `FindObjectOfType` → `FindFirstObjectByType`) được ghi chú ngay trong bài.

### Bước 3: Làm quen với giao diện

- **Scene View**: Nơi bạn thiết kế level
- **Game View**: Xem game khi chạy
- **Hierarchy**: Danh sách tất cả objects trong scene
- **Inspector**: Thuộc tính của object được chọn
- **Project**: Tất cả assets của project

## 📖 Cách sử dụng tài liệu

1. **Đọc tuần tự**: Các bài học được sắp xếp theo độ khó tăng dần
2. **Thực hành**: Mỗi bài có ví dụ code và bài tập
3. **Ghi chú**: Viết lại những gì quan trọng
4. **Hỏi đáp**: Tham gia cộng đồng Unity Việt Nam

## ✅ Checklist theo dõi tiến độ

### Tuần 1

- [ ] Hoàn thành Bài 1: C# cơ bản
- [ ] Hoàn thành Bài 2: Unity Fundamentals
- [ ] Hoàn thành Bài 3: Physics System
- [ ] Tạo được object di chuyển với physics

### Tuần 2

- [ ] Hoàn thành Bài 4: Scripting Essentials
- [ ] Hoàn thành Bài 5: UI System
- [ ] Tạo được game với UI hoàn chỉnh

### Tuần 3

- [ ] Hoàn thành Bài 6: Audio & Animation
- [ ] Thêm âm thanh và animation vào game

### Tuần 4

- [ ] Hoàn thành Bài 7: Resources
- [ ] Hoàn thành Bài 8: Dự án cuối khóa
- [ ] Upload game lên itch.io hoặc GameJolt

## 🎯 Tips học hiệu quả

1. **Code mỗi ngày**: Dù chỉ 30 phút cũng tốt hơn học 1 lần/tuần
2. **Thực hành ngay**: Đừng chỉ đọc, hãy code theo ví dụ
3. **Tự tạo project**: Sau mỗi bài, tạo project nhỏ để áp dụng
4. **Tham gia cộng đồng**: Unity Việt Nam Facebook group
5. **Đừng sợ lỗi**: Lỗi là cách học tốt nhất!

## 📞 Hỗ trợ

- **Unity Documentation**: [docs.unity3d.com](https://docs.unity3d.com)
- **Unity Learn**: [learn.unity.com](https://learn.unity.com)
- **Unity Discussions (Forum)**: [discussions.unity.com](https://discussions.unity.com)
- **Cộng đồng Việt Nam**: Unity Việt Nam Facebook Group

---

**Chúc bạn học tập vui vẻ và thành công! 🎮✨**

> 💡 **Lưu ý**: Tài liệu này tập trung vào những kiến thức quan trọng nhất. Bạn có thể học thêm chi tiết từ Unity Documentation khi cần.
