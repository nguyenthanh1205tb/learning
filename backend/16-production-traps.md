# 📚 Bài 16: Bẫy tiền, thời gian và chữ

## 🎯 Mục tiêu bài học

- Tính tiền bằng số nguyên, và biết phép chia nguyên cắt phần dư thế nào
- Lưu thời điểm ở UTC, chỉ đổi múi giờ lúc hiển thị
- Đếm chữ theo rune hoặc ký tự Unicode, không theo byte
- Thấy vì sao cộng số dư hai lần là lỗi dữ liệu, không phải lỗi "bấm nhầm"

> 💡 Ba bẫy này không thuộc một framework. Chúng nằm trong đơn hàng, hóa đơn, lịch giao, và tên người dùng. Bài [Shop](./17-shop-capstone.md) dùng trực tiếp phần tiền và phần gọi lại đơn.

---

## 📖 1. `float` không phải tiền

`float64` (và `float` của Python) là số nhị phân. `0.1` không có biểu diễn hữu hạn trong hệ hai.

```go
var a, b float64 = 0.1, 0.2
fmt.Println(a + b)       // 0.30000000000000004
fmt.Println(a+b == 0.3)  // false
```

```python
print(0.1 + 0.2)  # 0.30000000000000004
```

Có một bẫy riêng của Go: `0.1 + 0.2 == 0.3` viết bằng **hằng số chưa gán kiểu** thì lại đúng, vì hằng số được tính với độ chính xác cao hơn `float64`. Lỗi chỉ hiện khi giá trị đã là `float64` — đúng kiểu dữ liệu bạn nhận từ JSON hoặc từ phép tính trung gian. Đừng dùng đoạn hằng số để "chứng minh float an toàn".

Tiền trong shop tính bằng **đồng** (`int64`). VND không có đơn vị nhỏ hơn đồng đang dùng để hạch toán, nên 1 đơn vị = 1 đồng. Với USD thì 1 đơn vị = 1 cent.

```go
// Phép tính. Bản trong projects/shop còn chặn số âm và tràn int64.
func Gross(net, percent int64) int64 {
    return net + net*percent/100
}
```

`Gross(199_000, 10)` = `218_900`. Thuế 10% của 199.000 là 19.900, không phải `199_000 * 1.1` rồi làm tròn bằng float.

Phần dư bị cắt về phía không với số dương: `199 * 10 / 100` trong số nguyên bằng 19, không phải 20. Hãy chọn quy tắc làm tròn (xuống, nửa lên, làm tròn ngân hàng) và viết thành test. Im lặng dùng float là một quy tắc làm tròn ngẫu nhiên.

Trước khi nhân, kiểm tra tràn `int64`. Gói `projects/shop/internal/money` trả lỗi khi `đơn giá × số lượng` không vừa số nguyên 64 bit.

---

## 📖 2. Giờ: lưu UTC, hiện địa phương

Một `time.Time` đúng mang theo vị trí. Chuỗi `"2026-10-01 17:00:00"` không mang múi giờ là một câu hỏi, không phải một thời điểm.

```go
t := time.Date(2026, 10, 1, 17, 0, 0, 0, time.UTC)
loc, err := time.LoadLocation("Asia/Ho_Chi_Minh")
if err != nil {
    log.Fatal(err)
}
fmt.Println(t.Format(time.RFC3339))             // 2026-10-01T17:00:00Z
fmt.Println(t.In(loc).Format(time.RFC3339))     // 2026-10-02T00:00:00+07:00
```

17:00 UTC là 00:00 ngày hôm sau ở Việt Nam. So sánh hai `time.Time` bằng `.Equal` hoặc đưa cả hai về UTC. So sánh chuỗi đã format theo múi giờ của từng máy sẽ lệch ngày.

Việc làm trong database:

| Việc | Cách |
|---|---|
| Cột "lúc tạo", "lúc thanh toán" | `timestamptz` (Postgres) hoặc chuỗi RFC3339 có `Z` |
| "Sinh nhật", "ngày giao theo lịch cửa hàng" | `date`, không gắn giờ |
| Hiển thị cho người ở Hà Nội | Đổi sang `Asia/Ho_Chi_Minh` ở tầng HTTP hoặc giao diện |
| Cron "mỗi đêm" | Nói rõ đêm của múi giờ nào |

`time.LoadLocation` cần dữ liệu múi giờ trong hệ điều hành hoặc trong image. Container tối giản thiếu file này thì hàm trả lỗi — image production nên có gói `tzdata`.

---

## 📖 3. Chữ: byte, ký tự, và dạng chuẩn

UTF-8 mã hóa một ký tự bằng 1 đến 4 byte. `len` của Go đếm **byte**. `len` của Python 3 đếm **ký tự**.

| Chuỗi | Go `len` | Go số rune | Python `len` | Số byte UTF-8 |
|---|---|---|---|---|
| `tiếng` | 7 | 5 | 5 | 7 |

Cắt `s[:3]` trong Go có thể cắt giữa một chữ có dấu và tạo chuỗi hỏng. Cắt theo người đọc thì chuyển qua `[]rune` hoặc `utf8.DecodeRuneInString`, rồi mới lấy N ký tự.

Cùng một chữ có thể có hai bộ mã. `café` viết bằng chữ é sẵn (NFC, Python đếm 4) và `e` + dấu sắc tổ hợp (NFD, Python đếm 5) **không bằng nhau** khi so sánh byte, dù mắt nhìn giống. Email, mã giảm giá, tên file nên chuẩn hóa một dạng (thường NFC) trước khi lưu và trước khi so khớp.

---

## 📖 4. Gọi hai lần không được cộng hai lần

Khách bấm "Thanh toán", mạng đứt sau khi server đã trừ kho nhưng trước khi điện thoại nhận được kết quả. App gửi lại. Nếu lần hai tạo thêm một đơn, bạn bán hai lần một cú bấm.

Cách làm trong [dự án shop](./17-shop-capstone.md):

1. Client gửi header `Idempotency-Key` (một chuỗi ngẫu nhiên cho **một ý định** đặt hàng)
2. Server lưu key cùng đơn, trong **cùng transaction** với việc trừ kho
3. Lần sau cùng user và cùng key: trả lại đơn cũ, không trừ kho
4. Cùng key nhưng khác sản phẩm hoặc khác số lượng: từ chối, vì đó là một ý định khác

`SET status = 'PAID'` gọi nhiều lần vẫn là đã thanh toán. `balance = balance + 120000` gọi nhiều lần thì cộng dồn. Thao tác thứ hai cần key để biến nó thành "đã cộng rồi thì thôi". Phần delivery và outbox nằm ở [Bài 9](./09-message-queues.md).

---

## 🏋️ Bài tập

### Bài tập 1

`price * 1.1` với `price` là `float64` 199_000. Vì sao không dùng kết quả này làm số tiền khách phải trả?

<details markdown="1"><summary>Đáp án</summary>

`199_000 * 1.1` trong Python ra `218900.00000000003`, không bằng `218900`. Ép về số nguyên tùy ngôn ngữ và tùy chỗ làm tròn sẽ thành 218.900 hoặc lệch một đồng. Hai service làm tròn khác nhau thì lệch đối soát. Dùng `199_000 + 199_000*10/100`.

</details>

### Bài tập 2

Bảng `orders.created_at` lưu `timestamp` không múi giờ. App Go ghi `time.Now()` trên server đang đặt `TZ=Asia/Ho_Chi_Minh`, báo cáo lại đọc bằng session UTC. Khách đặt lúc 00:30 ngày 2 tháng 10 theo giờ Việt Nam sẽ rơi vào ngày nào trên báo cáo?

<details markdown="1"><summary>Đáp án</summary>

00:30 ngày 2 tháng 10 giờ Việt Nam là 17:30 ngày 1 tháng 10 UTC. Cột không kèm múi giờ khiến người đọc UTC hiểu đó là ngày 1. Lưu `timestamptz` hoặc thời điểm UTC có hậu tố `Z`, và chỉ đổi sang `Asia/Ho_Chi_Minh` khi in cho người dùng.

</details>

---

## ✅ Tự kiểm tra

- [ ] Tiền trong code và trong cột số là số nguyên
- [ ] Tôi biết phép chia nguyên đang bỏ phần dư, và có test cho một số lẻ
- [ ] Thời điểm lưu kèm múi giờ hoặc đã là UTC
- [ ] Tôi không cắt chuỗi UTF-8 theo byte rồi đưa cho người dùng
- [ ] API trừ tiền hoặc trừ kho nhận một idempotency key

**Bài tiếp**: [Bài 17: Dự án shop](./17-shop-capstone.md)
