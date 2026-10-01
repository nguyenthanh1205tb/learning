# 📚 Bài 11: Làm việc với AI mà vẫn là người chịu trách nhiệm

> Mọi dòng bạn commit là của bạn. Công cụ sinh ra dòng đó không đứng on-call.

Bài 10 đã đặt nguyên tắc ở [mục 9](./10-career-growth.md). Bài này là cách làm hàng ngày: giao việc thế nào, đọc diff thế nào, và chỗ nào không được tin dù đoạn code chạy được.

## 🎯 Mục tiêu bài học

- Giao cho AI một việc nhỏ, có bất biến và có test
- Review diff theo những chỗ hay sai âm thầm: tiền, quyền, SQL, concurrency
- Giữ secret và dữ liệu khách khỏi prompt
- Từ chối một đoạn "chạy được" khi bạn không giải thích được vì sao nó đúng

---

## 📖 1. Giao việc như giao cho người mới trong team

Một câu "viết API đặt hàng" trả về một dịch vụ trông đầy đủ và thiếu đúng cái bạn sẽ bị gọi dậy lúc đêm: key chống gọi hai lần, transaction, lỗi hết hàng.

Một lần giao việc đủ dùng gồm:

| Phần | Ví dụ |
|---|---|
| Việc | Thêm `PlaceOrder` trừ kho và ghi outbox |
| Bất biến | Cùng user và cùng idempotency key thì tồn kho chỉ giảm một lần |
| Ngoài phạm vi | Không thêm Kafka, không đổi cách băm mật khẩu |
| Xong khi | `go test ./...` xanh, gồm test gọi hai lần |

AI giỏi phần khuôn. Bạn giữ phần "xong nghĩa là gì". Nếu bạn chưa nói được bất biến, bạn chưa sẵn sàng nhận diff.

---

## 📖 2. Đọc diff theo chỗ đắt

Đọc từ test trước. Test khóa đúng hành vi thì diff còn lại đỡ nguy hiểm. Test chỉ gọi hàm rồi so với kết quả do chính hàm đó sinh ra thì không khóa gì cả: nó sẽ xanh cả khi hàm sai.

Rồi đọc các chỗ sau, kể cả khi phần còn lại của diff nhàm chán:

| Chỗ | Câu hỏi |
|---|---|
| Tiền | Có `float` không? Phép chia có cắt dư không? Có test một số lẻ không? |
| Quyền | Handler có biết user nào đang gọi, hay tin `user_id` trong JSON? |
| SQL | Tham số có được bind không? `UPDATE` trừ kho có điều kiện `stock >= qty` không? |
| Gọi lại | Retry có tạo thêm đơn, thêm email, thêm lần cộng tiền không? |
| Lỗi | Lỗi bị nuốt bằng `_ =` ở chỗ tiền hoặc chỗ ghi database không? |
| Song song | Hai request tranh một suất hàng cuối thì một request phải thất bại |

Đoạn VAT bằng `float64` trong Bài 10 là mẫu. Bản sửa nằm ở [Bẫy tiền, thời gian và chữ](../backend/16-production-traps.md) và trong `projects/shop/internal/money`.

---

## 📖 3. Những thứ không đưa vào cuộc hội thoại

Prompt thường được lưu ở máy bạn và có thể được gửi tới dịch vụ bên ngoài.

Không dán: mật khẩu, connection string có user/password, token, `SHOP_SECRET`, dump bảng khách, log có email hoặc số điện thoại. Khi cần AI nhìn một lỗi SQL, thay dữ liệu thật bằng dữ liệu giả cùng **hình dạng**: cùng kiểu, cùng độ dài, cùng chỗ vỡ.

Không nhờ AI "sửa cho test xanh" bằng cách nới lỏng assertion. Nếu test đỏ vì hành vi sai, sửa hành vi. Nếu test đỏ vì test viết nhầm kỳ vọng, nói rõ điều đó trong commit.

---

## 📖 4. Giải thích lại được thì mới nhận

Sau khi nhận một đoạn, bạn phải nói được bằng lời của mình: dữ liệu vào, nhánh lỗi, cái gì được ghi, cái gì xảy ra nếu gọi lần hai. Không nói được thì đoạn đó chưa phải của bạn, dù nó đã nằm trong editor.

Cách luyện: xóa đoạn vừa sinh, viết lại từ test đang đỏ. Phần bạn viết lại được là phần bạn hiểu. Phần bạn phải dán nguyên là phần cần hỏi tiếp hoặc cần một người review.

AI có ích nhất ở chỗ khuôn đã rõ: sinh test cho một bảng đầu vào, giải thích một diff bạn đã viết, liệt kê chỗ một handler còn thiếu status code. Nó yếu ở chỗ yêu cầu còn mơ hồ và ở những bất biến không được viết ra.

---

## 🏋️ Bài tập

Bạn nhận được handler đặt hàng do AI viết. Nó làm lần lượt: đọc tồn kho, nếu đủ thì `UPDATE stock = stock - qty`, rồi `INSERT` đơn. Không có idempotency key. Hãy viết ba nhận xét review, mỗi nhận xét một hệ quả cụ thể.

<details markdown="1"><summary>Một cách viết</summary>

1. Đọc tồn rồi mới `UPDATE` khiến hai request cùng thấy còn 1 món và cùng trừ thành công, bán âm kho. Trừ bằng `UPDATE ... WHERE stock >= qty` và kiểm tra số dòng đổi.
2. Không có khóa ý định: client gửi lại sau khi mạng đứt sẽ tạo đơn thứ hai. Cần `Idempotency-Key` lưu cùng đơn trong một transaction.
3. `UPDATE` kho và `INSERT` đơn không cùng transaction: trừ kho xong process chết thì mất hàng mà không có đơn. Hai lệnh phải commit cùng nhau, kèm một dòng outbox nếu hệ khác cần biết có đơn mới.

</details>

---

## ✅ Tự kiểm tra

- [ ] Mỗi lần nhờ AI viết code, tôi nói được bất biến và test tương ứng
- [ ] Tôi đọc chỗ tiền, quyền, SQL và retry trước khi đọc phần còn lại
- [ ] Secret và dữ liệu khách không vào prompt
- [ ] Tôi giải thích lại được đoạn mình định commit

**Quay lại**: [Mục lục Tư duy SE](./README.md)
