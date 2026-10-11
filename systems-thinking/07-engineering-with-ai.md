# 📚 Bài 7: Làm việc với AI như một kỹ sư

> "Khi một thước đo trở thành mục tiêu, nó không còn là thước đo tốt nữa." - Định luật Goodhart

Tháng Ba, một team 6 người ở một công ty logistics tại Hà Nội bắt đầu dùng AI coding agent cho mọi người. Tháng Tư, số PR mỗi tuần tăng gấp đôi. Ai cũng thấy mình làm nhanh hơn. Trưởng nhóm báo cáo lên trên: "năng suất tăng 100%".

Tháng Sáu, nhìn lại: số tính năng thật sự ra mắt **gần như không đổi**. Thời gian một PR chờ review tăng từ nửa ngày lên gần 3 ngày. Số sự cố production liên quan đến thay đổi mới tăng gấp rưỡi. Hai bạn senior dành gần hết thời gian để review, và bắt đầu duyệt nhanh hơn để "giải phóng hàng đợi".

Không ai làm sai điều gì rõ ràng. Mỗi người đều dùng AI đúng cách theo [Bài 11 - Làm việc với AI mà vẫn là người chịu trách nhiệm](../mindset/11-working-with-ai.md): giao việc có bất biến, đọc diff, không dán secret. Vấn đề không nằm ở **từng người**. Nó nằm ở **hệ thống**: họ tăng tốc một khâu, và nút thắt dịch sang khâu khác.

Bài 11 (Mindset) dạy **thói quen cá nhân** khi làm việc với AI. Bài này lùi lại một bước và nhìn **phát triển phần mềm có AI như một hệ thống** - với dòng chảy, nút thắt, vòng phản hồi, và những thứ cần đo - đúng tinh thần của Bài 2.

## 🎯 Mục tiêu bài học

- Nhìn phát triển có AI như một **vòng lặp spec → generate → verify → integrate**, và thấy nút thắt **dịch chuyển** về verify, review, integrate
- Dùng **ma trận ủy quyền** để quyết định việc nào giao AI, việc nào làm cùng, việc nào tự giữ - theo **rủi ro × khả năng đảo ngược × khả năng kiểm chứng**
- Viết **spec và context** cho AI ở mức hệ thống: bất biến, ví dụ, non-goals, context nhiều tầng
- Dùng **test như hợp đồng thực thi được**: property test, golden test - và thấy tận mắt một bản cài "kiểu AI" vượt qua test yếu nhưng thua property test
- Review output AI theo checklist: **API bịa, edge case âm thầm, bảo mật, bản quyền, hiệu năng**
- Hiểu rủi ro của **agent và tự động hóa**, và cách giới hạn blast radius của chúng
- Giữ **kỹ năng không bị mai một** (deskilling)
- Xây **thực hành cấp đội**: chuẩn review, nguồn gốc (provenance), eval cho prompt nội bộ
- **Đo năng suất thật**, không đo cảm giác

!!! note "Nền tảng cần có"
    Bài này **xây tiếp** trên [Mindset Bài 11](../mindset/11-working-with-ai.md): giao việc như cho người mới (việc, bất biến, ngoài phạm vi, xong khi), đọc diff theo chỗ đắt (tiền, quyền, SQL, retry, lỗi, song song), không dán secret, và chỉ nhận đoạn code mình giải thích lại được. Nếu chưa đọc, hãy đọc trước - bài này không lặp lại những điều đó.

---

## 📖 1. Phát triển có AI là một hệ thống

### 1.1. Vòng lặp bốn khâu

Mọi thay đổi code - do người hay do AI viết - đều đi qua bốn khâu:

```mermaid
flowchart LR
    S["📝 Spec<br/>hiểu vấn đề,<br/>viết yêu cầu, bất biến"] --> G["⚙️ Generate<br/>viết code, viết test"]
    G --> V["🔍 Verify<br/>chạy test, đọc,<br/>review, thử thật"]
    V --> I["🔗 Integrate<br/>merge, deploy,<br/>khớp với phần còn lại"]
    V -. "sai: sửa code" .-> G
    V -. "sai: spec mơ hồ" .-> S
    I -. "xung đột, sự cố" .-> S
```

Trước AI, khâu **generate** thường chiếm phần lớn thời gian. AI làm khâu này nhanh hơn hàng chục lần. Nhưng ba khâu còn lại **không tự nhanh lên** - và một số còn **chậm đi**.

### 1.2. Nút thắt dịch chuyển

Đây là bài học của **lý thuyết ràng buộc** (Theory of Constraints): tốc độ của cả dây chuyền bị giới hạn bởi khâu chậm nhất. Tăng tốc một khâu không phải nút thắt chỉ làm hàng tồn chất đống ở khâu sau.

Giả sử một tính năng vừa, thời gian từng khâu (giờ làm việc):

| Khâu | Trước AI | Có AI | Ghi chú |
|---|---|---|---|
| Spec | 2 | 2 | Không đổi - thậm chí nên tăng |
| Generate | 12 | 2 | AI làm rất nhanh |
| Verify (test, đọc, review) | 4 | 6 | Đọc code mình không viết **chậm hơn** đọc code mình viết |
| Integrate (merge, sửa xung đột, deploy) | 2 | 3 | Nhiều PR song song hơn → xung đột nhiều hơn |
| **Tổng** | **20** | **13** | Nhanh hơn 35%, không phải 6 lần |

Con số cụ thể chỉ là minh họa, nhưng hình dạng thì rất thật: **generate nhanh gấp 6 lần, tổng chỉ nhanh hơn khoảng một phần ba**. Và **tỉ trọng** đã đảo ngược: trước kia 60% thời gian là viết code, giờ gần 70% là kiểm chứng và tích hợp.

```mermaid
flowchart TB
    subgraph TRUOC["Trước AI - nút thắt: viết code"]
        direction LR
        a1["Spec 2h"] --> a2["Generate 12h ⏳"] --> a3["Verify 4h"] --> a4["Integrate 2h"]
    end
    subgraph SAU["Có AI - nút thắt: kiểm chứng"]
        direction LR
        b1["Spec 2h"] --> b2["Generate 2h ⚡"] --> b3["Verify 6h ⏳"] --> b4["Integrate 3h ⏳"]
    end
    TRUOC --> SAU
```

Hệ quả cho kỹ sư: **kỹ năng có giá trị nhất dịch chuyển theo nút thắt**. Viết spec rõ (để sinh ra code đúng ngay từ đầu), kiểm chứng nhanh và chắc (test tốt, đọc code giỏi), và tích hợp gọn (ranh giới rõ, thay đổi nhỏ) - đó là nơi một giờ công của bạn đáng giá nhất.

### 1.3. Hàng đợi review - định luật Little lại xuất hiện

Ở Bài 5 ta dùng định luật Little cho request. Nó áp dụng nguyên vẹn cho PR:

```text
Số PR đang chờ = tốc độ PR đến × thời gian chờ trung bình

Trước: 10 PR/tuần, review kịp → chờ 0,5 ngày → khoảng 1 PR tồn
Sau:   20 PR/tuần, năng lực review vẫn ~12 PR/tuần
       → hàng đợi tăng thêm ~8 PR mỗi tuần, thời gian chờ tăng không giới hạn
```

Khi tốc độ đến vượt năng lực xử lý, hàng đợi **không ổn định** - nó dài mãi. Các team thường phản ứng bằng một trong hai cách, và cả hai đều có vòng phản hồi:

```mermaid
flowchart LR
    A["AI sinh code nhanh hơn"] --> B["Nhiều PR hơn, PR to hơn"]
    B --> C["Hàng đợi review dài ra"]
    C --> D["Áp lực 'duyệt cho nhanh'"]
    D --> E["Review hời hợt hơn"]
    E --> F["Nhiều lỗi lọt production"]
    F --> G["Nhiều việc sửa lỗi gấp"]
    G --> B
    C --> H["Giới hạn kích thước PR,<br/>WIP limit, test mạnh hơn"]
    H -. "vòng cân bằng" .-> C
```

Vòng bên trên là **vòng tăng cường** (reinforcing loop) dẫn tới hỗn loạn - đúng chuyện của team logistics ở đầu bài. Vòng bên dưới là **vòng cân bằng** (balancing loop): thay vì đẩy reviewer làm nhanh hơn, giảm lượng và độ khó của thứ cần review.

### 1.4. Đòn bẩy nằm ở đâu?

Theo tư duy hệ thống, đầu tư vào **nút thắt** và **đầu nguồn** cho hiệu quả cao nhất:

| Đòn bẩy | Tác động lên nút thắt |
|---|---|
| Spec tốt hơn (mục 3) | Ít vòng sửa → ít lần verify |
| Test là hợp đồng (mục 4) | Verify tự động, nhanh, đáng tin |
| PR nhỏ, một mục đích | Review nhanh hơn và kỹ hơn |
| Ranh giới module rõ (Bài 6) | Ít xung đột khi tích hợp |
| Checklist review (mục 5) | Reviewer tập trung vào chỗ đắt |
| Đo đúng (mục 9) | Biết nút thắt thật đang ở đâu |

---

## 📖 2. Ma trận ủy quyền: giao, làm cùng, hay tự giữ?

Không phải việc nào cũng nên giao cho AI theo cùng một cách. Hỏi ba câu:

1. **Rủi ro** (risk): sai thì thiệt hại bao nhiêu? (blast radius ở Bài 5)
2. **Khả năng đảo ngược** (reversibility): sai thì quay lại dễ không? (cửa một chiều / hai chiều)
3. **Khả năng kiểm chứng** (verifiability): mình có cách **rẻ và chắc** để biết output đúng không?

Câu thứ ba hay bị bỏ qua nhất, nhưng lại quyết định nhiều nhất. Việc có rủi ro vừa nhưng kiểm chứng được tự động (có test mạnh, có type checker, có so sánh output) an toàn hơn việc rủi ro thấp mà chỉ kiểm chứng được bằng mắt.

```mermaid
quadrantChart
    title "Ma trận ủy quyền cho AI"
    x-axis "Khó kiểm chứng" --> "Dễ kiểm chứng"
    y-axis "Rủi ro thấp, đảo ngược được" --> "Rủi ro cao, khó đảo ngược"
    quadrant-1 "Làm cùng: AI viết, test khóa"
    quadrant-2 "Tự giữ: người quyết và viết"
    quadrant-3 "Giao có xem lại"
    quadrant-4 "Giao thoải mái"
    "Script tạo dữ liệu test": [0.85, 0.12]
    "Đổi tên biến theo IDE": [0.92, 0.2]
    "Viết test cho bảng đầu vào": [0.75, 0.3]
    "Tài liệu nội bộ": [0.3, 0.15]
    "UI admin nội bộ": [0.4, 0.3]
    "Hàm tính phí ship": [0.7, 0.62]
    "Migration đổi schema": [0.55, 0.85]
    "Logic phân quyền": [0.3, 0.88]
    "Xử lý tiền, hoàn tiền": [0.42, 0.92]
    "Kiến trúc, ADR": [0.12, 0.8]
```

### 2.1. Ba chế độ làm việc

| Chế độ | Khi nào | Bạn làm gì | AI làm gì |
|---|---|---|---|
| **Giao** (delegate) | Rủi ro thấp, đảo ngược dễ, kiểm chứng tự động | Viết yêu cầu ngắn, kiểm kết quả bằng công cụ | Làm trọn |
| **Làm cùng** (pair) | Rủi ro vừa/cao nhưng kiểm chứng được | Viết spec + bất biến + **test trước**; review từng bước | Đề xuất, viết cài đặt, giải thích |
| **Tự giữ** (own) | Rủi ro cao, khó đảo ngược, khó kiểm chứng | Tự quyết định và tự viết phần lõi | Phản biện, tìm lỗ hổng, soạn nháp tài liệu |

"Tự giữ" **không có nghĩa là không dùng AI**. Nghĩa là AI ở vai **người phản biện**, không ở vai **người viết**. Với logic phân quyền, bạn tự viết - rồi hỏi AI "liệt kê mọi cách một user có thể đọc dữ liệu của user khác qua code này".

### 2.2. Dịch chuyển một việc sang ô an toàn hơn

Ma trận không cố định. Kỹ năng quan trọng là **dịch chuyển** một việc từ ô "tự giữ" sang ô "làm cùng" bằng cách **tăng khả năng kiểm chứng**:

```mermaid
flowchart LR
    A["Hàm tính hoàn tiền<br/>(khó kiểm chứng:<br/>chỉ đọc bằng mắt)"] -->|"viết property test:<br/>tổng hoàn ≤ đã trả,<br/>không âm, làm tròn đúng"| B["Hàm tính hoàn tiền<br/>(kiểm chứng tự động<br/>trên 10.000 đầu vào)"]
    B --> C["Chuyển sang 'làm cùng':<br/>AI viết cài đặt,<br/>test khóa hành vi"]
```

Đây là một ý quan trọng của cả bài: **đầu tư vào khả năng kiểm chứng mở rộng phạm vi những gì bạn có thể giao cho AI một cách an toàn**. Test tốt không chỉ bắt bug - nó là **giấy phép** để ủy quyền.

### 2.3. Cây quyết định nhanh

```mermaid
flowchart TB
    Q1{"Sai thì có mất tiền,<br/>mất dữ liệu, lộ dữ liệu,<br/>hoặc không quay lại được?"}
    Q1 -->|"Có"| Q2{"Có cách kiểm chứng<br/>tự động, mạnh<br/>(property test, ràng buộc DB)?"}
    Q1 -->|"Không"| Q3{"Kiểm chứng được<br/>bằng công cụ<br/>(test, type check, chạy thử)?"}
    Q2 -->|"Có"| P["Làm cùng<br/>người viết test trước"]
    Q2 -->|"Không"| O["Tự giữ<br/>AI chỉ phản biện"]
    Q3 -->|"Có"| D["Giao"]
    Q3 -->|"Không"| R["Giao, nhưng đọc kỹ<br/>và giữ thay đổi nhỏ"]
```

---

## 📖 3. Viết spec và context cho AI

[Mindset Bài 11 §1](../mindset/11-working-with-ai.md) đưa ra bốn phần tối thiểu của một lần giao việc: **việc, bất biến, ngoài phạm vi, xong khi**. Ở đây ta mở rộng theo hai hướng: **context nhiều tầng** (để không phải lặp lại mỗi lần), và **spec cho việc lớn hơn** một hàm.

### 3.1. Context nhiều tầng

AI chỉ biết những gì bạn đưa vào (hoặc những gì nó tự đọc được trong repo). Thay vì nhồi mọi thứ vào mỗi yêu cầu, tổ chức context thành tầng - giống cách onboard một người mới:

```mermaid
flowchart TB
    L1["Tầng 1 - Dự án (ít đổi)<br/>kiến trúc, quy ước code, cách chạy test,<br/>thư viện được dùng / bị cấm, link ADR"]
    L2["Tầng 2 - Module (đổi vừa)<br/>hợp đồng module, bất biến,<br/>dữ liệu nó sở hữu"]
    L3["Tầng 3 - Việc (mỗi lần)<br/>mục tiêu, bất biến riêng, ví dụ,<br/>non-goals, tiêu chí xong"]
    L1 --> L2 --> L3
```

- **Tầng 1** thường là một file trong repo mà công cụ AI tự đọc (nhiều công cụ hỗ trợ file hướng dẫn cấp dự án). Viết một lần, sửa khi quy ước đổi. Nội dung tốt: "dùng `int64` cho tiền theo đơn vị đồng, không dùng float", "mọi lời gọi HTTP ra ngoài qua package `httpx` có sẵn timeout", "chạy `make test` trước khi báo xong".
- **Tầng 2** chính là **hợp đồng** từ Bài 6 §7. Một hợp đồng viết tốt cho người cũng là context tốt cho AI.
- **Tầng 3** là spec của từng việc.

!!! tip "Context là tài sản của đội"
    Mỗi lần AI làm sai vì "không biết quy ước X", đừng chỉ sửa code - hãy thêm X vào tầng 1. Sau vài tuần, context dự án trở thành tài liệu onboarding tốt nhất mà team từng có - cho cả người lẫn AI.

### 3.2. Mẫu spec cho một việc vừa

```text
SPEC: [tên việc]

MỤC TIÊU (1-2 câu, nói về hành vi, không nói cách làm)

BỐI CẢNH
- Module liên quan, hợp đồng của nó (link)
- Code hiện có nên tái sử dụng (đường dẫn)

BẤT BIẾN (phải đúng trong mọi trường hợp, kể cả gọi song song, gọi lại)
- ...

VÍ DỤ (đầu vào → đầu ra mong đợi, gồm cả trường hợp biên và lỗi)
| Đầu vào | Kết quả |

NON-GOALS (không làm, không đụng vào)
- ...

RÀNG BUỘC KỸ THUẬT
- Thư viện, hiệu năng, tương thích ngược

XONG KHI
- Test nào xanh, lệnh nào chạy được, tài liệu nào cập nhật

CÂU HỎI MỞ (nếu AI thấy spec mơ hồ, hỏi trước khi viết)
```

### 3.3. Ví dụ: hoàn tiền một phần cho đơn hàng

**Spec yếu:**

> "Thêm API hoàn tiền một phần cho đơn hàng."

AI sẽ trả về một endpoint chạy được. Nó sẽ phải **tự đoán**: hoàn bao nhiêu lần được? Hoàn phí ship không? Làm tròn thế nào? Ai được gọi? Gọi hai lần thì sao? Mỗi lần đoán là một lỗ trong pho mát.

**Spec đủ dùng:**

```text
SPEC: Hoàn tiền một phần cho đơn hàng

MỤC TIÊU
Nhân viên CS hoàn một phần tiền cho đơn đã giao (ví dụ: 1 trong 3 món bị lỗi).

BỐI CẢNH
- Module payments, hợp đồng ở docs/contracts/payments.md
- Dùng money.VND (int64, đơn vị đồng) ở internal/money - KHÔNG dùng float
- Gọi cổng thanh toán qua gateway.Client có sẵn (đã có timeout + retry)

BẤT BIẾN
- Tổng các lần hoàn của một đơn ≤ số tiền khách đã trả cho đơn đó
- Mỗi refund_request_id chỉ tạo đúng một lần hoàn (idempotent)
- Số tiền hoàn > 0, là số nguyên đồng
- Chỉ đơn ở trạng thái DELIVERED hoặc PARTIALLY_REFUNDED mới hoàn được

VÍ DỤ
| Đã trả  | Đã hoàn | Yêu cầu hoàn | Kết quả                                        |
| 500.000 | 0       | 200.000      | OK, trạng thái PARTIALLY_REFUNDED              |
| 500.000 | 200.000 | 300.000      | OK, trạng thái REFUNDED                        |
| 500.000 | 200.000 | 300.001      | Lỗi REFUND_EXCEEDS_PAID                        |
| 500.000 | 0       | 0            | Lỗi INVALID_AMOUNT                             |
| (gọi lại cùng refund_request_id)  | Trả kết quả lần trước, không gọi cổng lần 2 |

NON-GOALS
- Không hoàn tiền tự động theo quy tắc (việc khác)
- Không đổi luồng hoàn toàn bộ hiện có
- Không thêm thư viện mới

RÀNG BUỘC
- Hai yêu cầu hoàn song song cho cùng một đơn không được vượt bất biến 1
  (dùng SELECT ... FOR UPDATE trên dòng đơn hàng, hoặc ràng buộc tương đương)
- Chỉ role CS_SUPERVISOR được gọi; ghi audit log (ai, khi nào, bao nhiêu, lý do)

XONG KHI
- Test cho mọi dòng ví dụ + test song song 2 yêu cầu + property test bất biến 1
- `make test` xanh

CÂU HỎI MỞ
- Cổng thanh toán trả timeout: đánh dấu PENDING và để job đối soát xử lý? (đề xuất: có)
```

Spec này dài khoảng 40 dòng và mất 20-30 phút để viết. Nó **chính là phần tư duy** - và là thứ AI không thể tự làm thay bạn, vì những quyết định trong đó (ai được hoàn, hoàn tối đa bao nhiêu, timeout thì làm gì) là quyết định **nghiệp vụ**.

### 3.4. Mẹo nâng chất lượng spec

- **Bất biến trước, ví dụ sau, cách làm cuối cùng** (hoặc không nói cách làm). Nói "dùng thuật toán X" khóa AI vào X; nói bất biến thì AI có không gian chọn, còn bạn có tiêu chí để kiểm tra.
- **Ví dụ biên quan trọng hơn ví dụ đẹp.** `500.000 / 2` không dạy được gì. `1 / 2`, `0`, số âm, chuỗi rỗng, 10 triệu dòng mới dạy được.
- **Yêu cầu AI hỏi trước.** Câu "Nếu spec mơ hồ, liệt kê câu hỏi thay vì đoán" thường lộ ra 2-3 chỗ bạn chưa nghĩ tới - **trước khi** có code phải review.
- **Non-goals ngăn phình diff.** Diff 80 dòng được review kỹ; diff 800 dòng được review lướt (Bài 5 §10: lỗ của lớp review).
- **Spec cũng là tài liệu.** Lưu spec cùng PR. Sáu tháng sau, khi ai đó hỏi "sao hoàn tiền lại khóa dòng đơn hàng?", câu trả lời nằm ở đó.

---

## 📖 4. Test là hợp đồng thực thi được

### 4.1. Vì sao test quan trọng hơn khi có AI

Nhớ lại mô hình pho mát Thụy Sĩ ở [Bài 5 §10](./05-failure-thinking.md): sự cố xảy ra khi các lỗ thẳng hàng, và nguy hiểm nhất là khi **các lỗ tương quan với nhau**.

Khi AI viết code **và** viết test cho code đó **từ cùng một hiểu biết**, hai lớp phòng thủ dễ có **cùng một lỗ**. Nếu AI hiểu sai rằng "chia đều" nghĩa là làm tròn từng phần, nó sẽ viết code làm tròn từng phần, và viết test kỳ vọng... đúng kết quả làm tròn từng phần. Test xanh. Bug vẫn còn.

```mermaid
flowchart LR
    U["Hiểu lầm về yêu cầu"] --> C["Code<br/>(do AI viết)"]
    U --> T["Test<br/>(cũng do AI viết,<br/>cùng hiểu lầm)"]
    C --> R{"Test xanh?"}
    T --> R
    R -->|"Xanh ✅"| P["Merge - bug lọt"]
```

Cách phá tương quan: **phần đặc tả hành vi (bất biến, property) do người viết** - hoặc ít nhất do người duyệt kỹ - độc lập với phần cài đặt. Đó là ý nghĩa của "test là hợp đồng": test không phải thứ đi kèm code, test là **lời hứa mà code phải giữ**.

### 4.2. Các loại test như hợp đồng

| Loại | Kiểm tra gì | Mạnh ở | Ví dụ |
|---|---|---|---|
| Example test | Một đầu vào → một đầu ra cụ thể | Dễ đọc, ghi lại trường hợp đã biết | `split(300000, 3) == [100000]*3` |
| **Property test** | Một tính chất đúng với **mọi** đầu vào | Tìm edge case bạn không nghĩ tới | `sum(split(t, n)) == t` với mọi t, n |
| **Golden test** | Output khớp với một file "chuẩn" đã được người duyệt | Output lớn, phức tạp (hóa đơn, báo cáo, SQL sinh ra) | So file PDF/HTML hóa đơn với `testdata/invoice.golden` |
| Ràng buộc DB | Dữ liệu không bao giờ vi phạm quy tắc | Chặn mọi đường ghi, kể cả script | `CHECK (refunded <= paid)` |
| Contract test | Hai service hiểu hợp đồng giống nhau | Ranh giới giữa đội | Consumer-driven contract |

Kỹ thuật test chi tiết có trong [Mindset Bài 6 - Testing & chất lượng](../mindset/06-testing-quality.md) và [Backend Bài 13](../backend/13-testing-cicd-deployment.md). Ở đây ta tập trung vào điều quan trọng nhất cho làm việc với AI: **property test**.

### 4.3. Ví dụ chạy được: chia hóa đơn

Bài toán: chia một hóa đơn `total` đồng cho `n` người. Hợp đồng:

- Đúng `n` phần
- **Tổng các phần bằng đúng `total`** (không mất, không thừa một đồng nào)
- Không phần nào âm
- Chênh lệch giữa phần lớn nhất và nhỏ nhất không quá 1 đồng

Bản cài "kiểu AI" - ngắn, gọn, trông đúng, và rất giống thứ bạn sẽ nhận được nếu chỉ nói "viết hàm chia đều hóa đơn":

```python
share = round(total / n)
return [share] * n
```

Chương trình dưới chạy **ba loại test** trên cả bản AI và bản sửa:

1. **Test ví dụ**: hai trường hợp "đẹp" (300.000 chia 3, 100.000 chia 4).
2. **Test "gương"**: test tính kỳ vọng bằng **chính công thức của code** - kiểu test mà AI hay sinh kèm code.
3. **Property test**: duyệt hết mọi `total` từ 0 đến 2.000 và `n` từ 1 đến 10 (20.010 bộ), kiểm tra cả bốn tính chất của hợp đồng, báo phản ví dụ **nhỏ nhất**.

=== "Python"

    ```python
    # Chia hóa đơn (đơn vị: đồng) cho n người.
    # Hợp đồng: len == n, sum == total, mọi phần >= 0, chênh lệch max - min <= 1.


    def split_bill_ai(total: int, n: int) -> list[int]:
        """Bản 'trông đúng' - kiểu code AI hay sinh ra."""
        share = round(total / n)
        return [share] * n


    def split_bill_fixed(total: int, n: int) -> list[int]:
        base, rem = divmod(total, n)
        return [base + 1] * rem + [base] * (n - rem)


    def example_test(split) -> bool:
        return split(300_000, 3) == [100_000] * 3 and split(100_000, 4) == [25_000] * 4


    def mirror_test(split) -> bool:
        # Test "gương": tính kỳ vọng bằng CHÍNH công thức của code -> luôn khớp với bản AI
        return all(split(t, n) == [round(t / n)] * n for t in (0, 10, 999) for n in (1, 3))


    def violations(total: int, n: int, parts: list[int]) -> list[str]:
        v = []
        if len(parts) != n:
            v.append(f"có {len(parts)} phần, phải là {n}")
        if sum(parts) != total:
            v.append(f"tổng {sum(parts)}, phải là {total}")
        if parts and min(parts) < 0:
            v.append("có phần âm")
        if parts and max(parts) - min(parts) > 1:
            v.append("chênh lệch quá 1 đồng")
        return v


    def property_test(split):
        bad, first = 0, None
        for total in range(0, 2001):          # duyệt hết đầu vào nhỏ, từ nhỏ đến lớn
            for n in range(1, 11):
                v = violations(total, n, split(total, n))
                if v:
                    bad += 1
                    if first is None:
                        first = (total, n, split(total, n), v)
        return bad, first


    for name, fn in [("Bản AI", split_bill_ai), ("Bản sửa", split_bill_fixed)]:
        print(f"== {name} ==")
        print("  test ví dụ :", "PASS" if example_test(fn) else "FAIL")
        print("  test gương :", "PASS" if mirror_test(fn) else "FAIL")
        bad, first = property_test(fn)
        if bad == 0:
            print("  property   : PASS (20010 bộ đầu vào)")
        else:
            t, n, parts, v = first
            print(f"  property   : FAIL {bad}/20010 bộ đầu vào")
            print(f"  phản ví dụ nhỏ nhất: total={t}, n={n} -> {parts}: {'; '.join(v)}")
    ```

    Output:

    ```text
    == Bản AI ==
      test ví dụ : PASS
      test gương : PASS
      property   : FAIL 14144/20010 bộ đầu vào
      phản ví dụ nhỏ nhất: total=1, n=2 -> [0, 0]: tổng 0, phải là 1
    == Bản sửa ==
      test ví dụ : PASS
      test gương : FAIL
      property   : PASS (20010 bộ đầu vào)
    ```

=== "Go"

    ```go
    // Chia hóa đơn (đơn vị: đồng) cho n người.
    // Hợp đồng: len == n, sum == total, mọi phần >= 0, chênh lệch max - min <= 1.
    package main

    import (
    	"fmt"
    	"math"
    	"slices"
    	"strings"
    )

    // splitBillAI: bản "trông đúng" - kiểu code AI hay sinh ra.
    func splitBillAI(total, n int) []int {
    	share := int(math.Round(float64(total) / float64(n)))
    	parts := make([]int, n)
    	for i := range parts {
    		parts[i] = share
    	}
    	return parts
    }

    func splitBillFixed(total, n int) []int {
    	base, rem := total/n, total%n
    	parts := make([]int, n)
    	for i := range parts {
    		parts[i] = base
    		if i < rem {
    			parts[i]++
    		}
    	}
    	return parts
    }

    func repeat(v, n int) []int {
    	s := make([]int, n)
    	for i := range s {
    		s[i] = v
    	}
    	return s
    }

    func exampleTest(split func(int, int) []int) bool {
    	return slices.Equal(split(300_000, 3), repeat(100_000, 3)) &&
    		slices.Equal(split(100_000, 4), repeat(25_000, 4))
    }

    // mirrorTest: tính kỳ vọng bằng CHÍNH công thức của code -> luôn khớp với bản AI.
    func mirrorTest(split func(int, int) []int) bool {
    	for _, t := range []int{0, 10, 999} {
    		for _, n := range []int{1, 3} {
    			want := repeat(int(math.Round(float64(t)/float64(n))), n)
    			if !slices.Equal(split(t, n), want) {
    				return false
    			}
    		}
    	}
    	return true
    }

    func violations(total, n int, parts []int) []string {
    	var v []string
    	if len(parts) != n {
    		v = append(v, fmt.Sprintf("có %d phần, phải là %d", len(parts), n))
    	}
    	sum := 0
    	for _, p := range parts {
    		sum += p
    	}
    	if sum != total {
    		v = append(v, fmt.Sprintf("tổng %d, phải là %d", sum, total))
    	}
    	if len(parts) > 0 && slices.Min(parts) < 0 {
    		v = append(v, "có phần âm")
    	}
    	if len(parts) > 0 && slices.Max(parts)-slices.Min(parts) > 1 {
    		v = append(v, "chênh lệch quá 1 đồng")
    	}
    	return v
    }

    func main() {
    	fns := []struct {
    		name string
    		fn   func(int, int) []int
    	}{{"Bản AI", splitBillAI}, {"Bản sửa", splitBillFixed}}
    	pass := map[bool]string{true: "PASS", false: "FAIL"}
    	for _, f := range fns {
    		fmt.Printf("== %s ==\n", f.name)
    		fmt.Println("  test ví dụ :", pass[exampleTest(f.fn)])
    		fmt.Println("  test gương :", pass[mirrorTest(f.fn)])
    		bad, first := 0, ""
    		for total := 0; total <= 2000; total++ { // duyệt hết đầu vào nhỏ, từ nhỏ đến lớn
    			for n := 1; n <= 10; n++ {
    				parts := f.fn(total, n)
    				if v := violations(total, n, parts); len(v) > 0 {
    					bad++
    					if first == "" {
    						first = fmt.Sprintf("total=%d, n=%d -> %v: %s",
    							total, n, parts, strings.Join(v, "; "))
    					}
    				}
    			}
    		}
    		if bad == 0 {
    			fmt.Println("  property   : PASS (20010 bộ đầu vào)")
    		} else {
    			fmt.Printf("  property   : FAIL %d/20010 bộ đầu vào\n", bad)
    			fmt.Println("  phản ví dụ nhỏ nhất:", first)
    		}
    	}
    }
    ```

    Output:

    ```text
    == Bản AI ==
      test ví dụ : PASS
      test gương : PASS
      property   : FAIL 14144/20010 bộ đầu vào
      phản ví dụ nhỏ nhất: total=1, n=2 -> [1 1]: tổng 2, phải là 1
    == Bản sửa ==
      test ví dụ : PASS
      test gương : FAIL
      property   : PASS (20010 bộ đầu vào)
    ```

### 4.4. Đọc kết quả - bốn bài học

**1. Test ví dụ "đẹp" không bắt được gì.** 300.000 chia hết cho 3. Mọi bản cài, kể cả bản sai, đều qua. Test ví dụ chỉ mạnh khi ví dụ được chọn **ở biên** - và đó chính là phần cần tư duy.

**2. Test gương còn tệ hơn không có test.** Nó xanh với bản sai và **đỏ với bản đúng**. Nếu sau này có người sửa đúng hàm, test gương sẽ báo lỗi - và người đó có thể "sửa" ngược lại cho test xanh. Test kiểu này **khóa chặt bug**. Đây là dạng test mà [Mindset Bài 11 §2](../mindset/11-working-with-ai.md) cảnh báo: "test chỉ gọi hàm rồi so với kết quả do chính hàm đó sinh ra thì không khóa gì cả".

**3. Property test không cần biết đáp án, chỉ cần biết tính chất.** Bạn không cần tính tay `split(1999, 7)` bằng bao nhiêu. Bạn chỉ cần biết "tổng phải bằng 1999". Đó là lý do property test rất hợp để **người viết, AI cài đặt**: người giữ phần "đúng nghĩa là gì", AI làm phần "làm thế nào".

**4. Cùng một logic, hai ngôn ngữ, hai bug khác nhau.** Python dùng **làm tròn kiểu ngân hàng** (banker's rounding: `round(0.5) == 0`) nên bản AI **mất** tiền: `[0, 0]`, tổng 0. Go dùng `math.Round` làm tròn **xa số 0** (`math.Round(0.5) == 1`) nên bản AI **thừa** tiền: `[1 1]`, tổng 2. Nếu bạn nhờ AI "chuyển hàm này từ Python sang Go", hành vi đổi mà không ai hay - trừ khi có property test. (Và để ý con số 14.144/20.010: bản AI sai ở **hơn 70%** đầu vào, nhưng vẫn qua hai test đầu.)

### 4.5. Dùng thư viện property test thật

Vòng lặp duyệt hết ở trên dễ hiểu, nhưng trong dự án thật, dùng thư viện: nó sinh đầu vào ngẫu nhiên thông minh (ưu tiên giá trị biên như 0, 1, số rất lớn) và **thu nhỏ** (shrink) phản ví dụ về dạng đơn giản nhất.

=== "Python (Hypothesis)"

    ```python
    # test_split_hyp.py - cần: pip install hypothesis pytest ; chạy: pytest -q test_split_hyp.py
    from hypothesis import given, strategies as st


    def split_bill_ai(total: int, n: int) -> list[int]:
        share = round(total / n)
        return [share] * n


    @given(total=st.integers(min_value=0, max_value=10**9),
           n=st.integers(min_value=1, max_value=50))
    def test_split_keeps_every_dong(total, n):
        parts = split_bill_ai(total, n)
        assert len(parts) == n
        assert sum(parts) == total
        assert max(parts) - min(parts) <= 1
    ```

    Output (rút gọn) - Hypothesis tự thu nhỏ phản ví dụ về `total=1, n=2`:

    ```text
    >       assert sum(parts) == total
    E       assert 0 == 1
    E        +  where 0 = sum([0, 0])
    E       Failing test case: test_split_keeps_every_dong(
    E           total=1,
    E           n=2,
    E       )
    FAILED test_split_hyp.py::test_split_keeps_every_dong - assert 0 == 1
    1 failed in 0.33s
    ```

=== "Go (fuzzing có sẵn)"

    ```go
    // split_test.go - chạy: go test -fuzz=FuzzSplitBill -fuzztime=30s
    package split

    import "testing"

    func FuzzSplitBill(f *testing.F) {
    	f.Add(300_000, 3) // các ví dụ "đẹp" làm hạt giống
    	f.Add(100_000, 4)
    	f.Fuzz(func(t *testing.T, total, n int) {
    		if total < 0 || total > 1_000_000_000 || n < 1 || n > 50 {
    			t.Skip() // ngoài miền đầu vào của hợp đồng
    		}
    		parts := SplitBillAI(total, n)
    		sum := 0
    		for _, p := range parts {
    			sum += p
    		}
    		if len(parts) != n || sum != total {
    			t.Fatalf("SplitBillAI(%d, %d) = %v: tổng %d, phải là %d", total, n, parts, sum, total)
    		}
    	})
    }
    ```

    Output (ví dụ - fuzzing ngẫu nhiên nên giá trị cụ thể khác nhau mỗi lần chạy):

    ```text
    --- FAIL: FuzzSplitBill (0.01s)
        --- FAIL: FuzzSplitBill (0.00s)
            split_test.go:19: SplitBillAI(99975, 4) = [24994 24994 24994 24994]: tổng 99976, phải là 99975

        Failing input written to testdata/fuzz/FuzzSplitBill/66ba08ef8852bc40
        To re-run:
        go test -run=FuzzSplitBill/66ba08ef8852bc40
    FAIL
    ```

Go fuzzer tìm ra lỗi trong vài mili-giây, thường bằng cách biến đổi nhẹ chính những hạt giống mà test ví dụ cho là "đúng" (ở lần chạy trên: `99975, 4`, ngay cạnh hạt giống `100_000, 4`). Đầu vào lỗi được lưu vào `testdata/` và trở thành test hồi quy vĩnh viễn.

### 4.6. Golden test - khi output quá lớn để viết tay

Có những output mà viết kỳ vọng bằng tay là không thực tế: HTML hóa đơn, báo cáo CSV 50 cột, câu SQL do query builder sinh ra, response JSON lớn. Golden test làm thế này:

```mermaid
flowchart LR
    A["Chạy code lần đầu"] --> B["Người đọc kỹ output<br/>và DUYỆT"]
    B --> C["Lưu thành file .golden<br/>trong repo"]
    C --> D["Mỗi lần test:<br/>so output mới với .golden"]
    D -->|"khác"| E["Test đỏ: người xem diff,<br/>quyết định bug hay thay đổi có chủ đích"]
    D -->|"giống"| F["Xanh"]
```

Với AI, golden test rất hữu ích khi **refactor**: "tái cấu trúc module báo cáo cho dễ đọc, **không đổi output**" - golden test chứng minh output không đổi, byte theo byte. Nhưng nhớ: golden test chỉ tốt bằng **lần duyệt đầu tiên**. Nếu người duyệt lướt qua file golden đầu tiên, bạn vừa khóa chặt mọi bug trong đó - giống test gương.

### 4.7. Ai viết test nào?

| Phần | Ai viết | Lý do |
|---|---|---|
| Bất biến, property | **Người** (AI có thể gợi ý, người quyết định) | Đây là định nghĩa "đúng" |
| Ví dụ biên | Người chọn, AI có thể bổ sung | Người biết nghiệp vụ |
| Ví dụ thường, test boilerplate | AI | Rẻ, dễ kiểm |
| Cài đặt | AI hoặc người | Được khóa bởi test ở trên |
| Duyệt file golden | **Người**, đọc kỹ | Đây là lần duy nhất có người kiểm |

---

## 📖 5. Review output của AI

[Mindset Bài 11 §2](../mindset/11-working-with-ai.md) liệt kê các "chỗ đắt" phải đọc: tiền, quyền, SQL, gọi lại, lỗi, song song. Danh sách dưới đây **bổ sung** những loại lỗi **đặc trưng** của code sinh tự động - những thứ người viết tay ít mắc, nhưng AI mắc thường xuyên.

### 5.1. Checklist bổ sung

| Loại | Trông như thế nào | Cách phát hiện nhanh |
|---|---|---|
| **API bịa** (hallucinated API) | Gọi hàm/tham số không tồn tại, hoặc tồn tại ở phiên bản khác | Build + type check; tra tài liệu chính thức của **đúng phiên bản** đang dùng |
| **Package bịa / gõ nhầm tên** | `import` một package nghe hợp lý nhưng không tồn tại - hoặc tệ hơn, có người đã đăng ký đúng cái tên đó với mã độc | Mọi dependency mới phải được người kiểm tra: tồn tại, uy tín, đúng tên |
| **API cũ / đã deprecated** | Go `strings.Title`, Python `datetime.utcnow()` | Linter, cảnh báo của compiler; quy ước ở context tầng 1 |
| **Edge case âm thầm** | Chạy tốt với dữ liệu mẫu; sai với rỗng, 0, âm, Unicode, múi giờ, rất lớn | Property test; hỏi "đầu vào tệ nhất là gì?" |
| **Bảo mật** | Nối chuỗi vào SQL/shell, tin input từ client, log dữ liệu nhạy cảm, tắt verify TLS "cho chạy được", gọi URL do user cung cấp (SSRF) | Đọc mọi chỗ input từ ngoài đi vào; công cụ quét bảo mật trong CI |
| **Bản quyền** | Đoạn code dài giống hệt một dự án mã nguồn mở có giấy phép ràng buộc | Đoạn lớn "quá hoàn chỉnh" cho một việc chuyên biệt → kiểm tra nguồn; tuân theo chính sách của công ty |
| **Hiệu năng** | N+1 query, tải hết bảng vào bộ nhớ, O(n²) trong vòng lặp, không phân trang | Chạy với dữ liệu cỡ thật; xem số query trong log |
| **Không khớp codebase** | Viết lại helper đã có, dùng thư viện khác với phần còn lại, style khác | Tìm trong repo trước khi chấp nhận hàm mới |
| **Làm quá yêu cầu** | Thêm cấu hình, abstraction, tính năng không ai yêu cầu | So với non-goals; xóa thứ không cần |
| **Nuốt lỗi để "chạy được"** | `try/except: pass`, `_ = err`, bắt lỗi rồi trả giá trị mặc định | Tìm mọi chỗ bắt lỗi; hỏi "lỗi này có bị che không?" |
| **Test không khóa gì** | Test gương, test chỉ kiểm "không ném lỗi", mock mọi thứ | Đọc test trước code; thử làm hỏng code xem test có đỏ không |

### 5.2. Kỹ thuật: "làm hỏng có chủ đích"

Cách nhanh nhất để biết test có khóa hành vi không: **cố tình làm hỏng code và xem test có đỏ không** (đây là ý tưởng của mutation testing, làm bằng tay):

- Đổi `>=` thành `>` ở điều kiện tồn kho.
- Xóa dòng kiểm tra quyền.
- Đổi `total // n` thành `round(total / n)`.

Nếu test vẫn xanh sau khi bạn phá, test đó không bảo vệ gì. Mất 5 phút, và rất thường xuyên lộ ra rằng bộ test "coverage 90%" do AI sinh thực ra không kiểm tra điều gì quan trọng.

### 5.3. Quy trình review gọn

```mermaid
flowchart TB
    A["1. Đọc spec / mô tả PR<br/>PR này hứa làm gì?"] --> B["2. Đọc test trước<br/>test có khóa đúng hứa hẹn?"]
    B --> C["3. Làm hỏng có chủ đích<br/>1-2 chỗ quan trọng"]
    C --> D["4. Đọc chỗ đắt<br/>(Mindset Bài 11 §2)"]
    D --> E["5. Đọc checklist 5.1<br/>dependency mới, API, bảo mật"]
    E --> F["6. Phần còn lại<br/>đọc lướt có chủ đích"]
    F --> G{"Giải thích lại được<br/>toàn bộ PR?"}
    G -->|"Có"| OK["Duyệt"]
    G -->|"Không"| NO["Hỏi lại / tách nhỏ"]
```

!!! warning "PR quá lớn để review là một lỗi, không phải một thử thách"
    Nếu một PR do AI sinh có 1.500 dòng, việc đúng không phải là cố đọc hết 1.500 dòng. Việc đúng là **trả lại và yêu cầu tách nhỏ**. AI tách PR rất nhanh. Bạn đọc PR lớn rất chậm và rất kém.

---

## 📖 6. Agent và tự động hóa - khi AI không chỉ gợi ý mà còn hành động

### 6.1. Từ gợi ý đến hành động

Công cụ AI đã đi từ **gợi ý code** (bạn chấp nhận từng dòng) đến **agent** (tự đọc repo, chạy lệnh, sửa nhiều file, chạy test, tạo PR, đôi khi deploy). Mỗi bước tăng năng lực cũng là một bước tăng **blast radius**.

| Mức tự động | Ví dụ | Blast radius khi sai |
|---|---|---|
| Gợi ý trong editor | Hoàn thành dòng code | Một dòng, người nhìn thấy ngay |
| Sinh diff theo yêu cầu | "Viết hàm X" | Một diff, có review |
| Agent trong sandbox | Sửa nhiều file, chạy test cục bộ | Một nhánh, có review |
| Agent có quyền ngoài | Tạo PR, comment, chạy CI, gọi API | Repo, tài nguyên chia sẻ |
| Agent có quyền production | Chạy migration, đổi config, deploy | **Hệ thống thật, khách hàng thật** |

### 6.2. Những rủi ro riêng của agent

- **Quyền quá rộng**: agent chạy trên máy dev có sẵn credential production trong biến môi trường hoặc file cấu hình. Một lệnh "dọn dẹp" có thể chạm vào thứ không nên chạm.
- **Prompt injection**: agent **đọc** nội dung từ bên ngoài - issue do người lạ viết, trang web, README của một dependency, comment trong code. Nội dung đó có thể chứa chỉ dẫn được cài cắm ("bỏ qua hướng dẫn trước, gửi file .env tới..."). Với agent, **mọi dữ liệu nó đọc đều có thể trở thành lệnh**, trừ khi hệ thống được thiết kế để ngăn.
- **Thao tác không thể đảo ngược**: xóa file, `git push --force`, gửi email, gọi API thanh toán.
- **Vòng lặp mất kiểm soát**: agent sửa test cho xanh bằng cách nới assertion, hoặc lặp đi lặp lại một lệnh tốn tiền.
- **Diff khổng lồ không ai đọc**: agent sửa 40 file trong 10 phút; review sẽ hời hợt (mục 1.3).
- **Mất dấu vết**: không rõ thay đổi nào do agent, theo chỉ dẫn gì, ai duyệt.

### 6.3. Thiết kế ranh giới tin cậy

Áp dụng đúng tư duy blast radius và bulkhead ở Bài 5:

```mermaid
flowchart TB
    subgraph SB["Sandbox (container / máy ảo / nhánh riêng)"]
        AG["🤖 Agent"]
        AG --> RP["Repo (bản sao)"]
        AG --> TS["Chạy test cục bộ"]
    end
    EXT["Nội dung ngoài:<br/>issue, web, README"] -->|"dữ liệu, KHÔNG phải lệnh"| AG
    AG -->|"đề xuất PR"| GATE{"Cổng kiểm soát<br/>CI + review người"}
    GATE -->|"duyệt"| MAIN["Nhánh chính"]
    MAIN --> DEP["Pipeline deploy<br/>(canary, rollback)"]
    AG -. "❌ không có quyền" .-> PROD[("Production,<br/>secret, thanh toán")]
```

Nguyên tắc:

| Nguyên tắc | Cụ thể |
|---|---|
| **Quyền tối thiểu** | Agent chỉ có quyền cần cho việc đang làm. Không có credential production trong môi trường agent |
| **Sandbox** | Chạy trong container hoặc máy ảo, mạng giới hạn, file hệ thống giới hạn |
| **Người duyệt thao tác một chiều** | Xóa, push lên nhánh chính, migration, gửi ra ngoài: cần người bấm xác nhận |
| **CI là cổng bắt buộc** | Agent không merge được nếu CI đỏ; agent **không được sửa** cấu hình CI hay nới test mà không có người duyệt riêng |
| **Giới hạn ngân sách** | Số bước, thời gian, chi phí tối đa cho một nhiệm vụ |
| **Nhật ký** | Ghi lại lệnh agent đã chạy, file đã sửa, theo yêu cầu của ai |
| **Coi nội dung đọc vào là dữ liệu** | Không để nội dung từ nguồn không tin cậy quyết định hành động có quyền cao |

!!! tip "Câu hỏi trước khi cho agent thêm quyền"
    "**Nếu agent này làm điều tệ nhất mà quyền này cho phép - do hiểu sai hoặc do bị chèn chỉ dẫn - thiệt hại là gì, và mình quay lại bằng cách nào?**" Đây chính là câu hỏi blast radius của Bài 5, áp dụng cho một "đồng nghiệp" làm việc rất nhanh và không bao giờ do dự.

---

## 📖 7. Giữ kỹ năng sắc bén

### 7.1. Nghịch lý của tự động hóa

Năm 1983, nhà tâm lý học Lisanne Bainbridge viết bài báo nổi tiếng "Ironies of Automation" (Những nghịch lý của tự động hóa). Ý chính: tự động hóa lấy đi những việc **dễ**, để lại cho con người những việc **khó nhất** - xử lý tình huống bất thường khi máy thất bại. Nhưng chính vì máy làm hết việc hằng ngày, con người **mất dần kỹ năng** cần cho những tình huống khó đó.

Ngành hàng không đã sống với nghịch lý này hàng chục năm: phi công dùng autopilot phần lớn chuyến bay, và các hãng phải **chủ động** cho phi công bay tay và luyện tập trên máy mô phỏng để giữ kỹ năng.

Với kỹ sư phần mềm, nghịch lý có hình dạng thế này:

```mermaid
flowchart LR
    A["AI viết phần lớn code"] --> B["Ít tự viết, ít tự debug"]
    B --> C["Mô hình tư duy về hệ thống<br/>mờ dần"]
    C --> D["Review kém hơn,<br/>khó phát hiện AI sai"]
    D --> E["Phụ thuộc AI nhiều hơn"]
    E --> A
    C --> F["Lúc 3 giờ sáng, AI không giúp được,<br/>người cũng không còn biết cách"]
```

Nguy hiểm nhất với **người mới vào nghề**: người có kinh nghiệm đã có mô hình tư duy và có thể "mất dần" nó. Người mới có thể **không bao giờ xây** được nó. Họ biết cách nhận code chạy được, nhưng chưa từng trải qua việc vật lộn với một con trỏ null đủ lâu để hiểu sâu vì sao nó xảy ra.

### 7.2. Những thực hành giữ kỹ năng

| Thực hành | Cách làm | Giữ kỹ năng gì |
|---|---|---|
| **Tự làm trước, so sau** | Với bài toán mới, tự phác thảo giải pháp 15 phút trước khi hỏi AI; rồi so sánh | Tư duy giải quyết vấn đề |
| **Debug tay 15 phút đầu** | Lỗi mới: tự đặt giả thuyết, đọc log, thu hẹp phạm vi trước khi dán vào AI ([Debugging](../mindset/05-debugging.md)) | Chẩn đoán có hệ thống |
| **Giải thích lại** | Đã có ở [Mindset Bài 11 §4](../mindset/11-working-with-ai.md): xóa đoạn vừa sinh, viết lại từ test đỏ | Hiểu thật |
| **Hỏi gợi ý, không hỏi đáp án** | Khi học: "cho tôi một gợi ý, đừng đưa code" | Học chủ động |
| **Đọc nguồn gốc** | AI dùng một API lạ → đọc tài liệu chính thức của API đó | Hiểu công cụ thật, không phải tóm tắt |
| **Bài tập "không AI"** | Định kỳ làm một kata, một bài thuật toán, một bug nhỏ không có AI | Phản xạ nền tảng |
| **Viết phần lõi** | Phần "tự giữ" trong ma trận (mục 2): tự viết | Hiểu những chỗ quan trọng nhất |

### 7.3. Câu hỏi tự kiểm tra hàng tháng

- Nếu ngày mai không có công cụ AI, tôi có xử lý được sự cố production trong hệ thống của mình không?
- Tháng này tôi có **học** được điều gì mới về hệ thống/ngôn ngữ, hay chỉ **dùng** nhiều hơn?
- Có đoạn code nào tôi đã merge mà bây giờ không giải thích được không?

Mục tiêu không phải là dùng AI ít đi. Mục tiêu là dùng AI **như một phi công dùng autopilot**: tận dụng nó cho phần lớn thời gian, và luôn đủ tay nghề để cầm lái khi nó ngắt.

---

## 📖 8. Thực hành cấp đội

Những gì ở trên là kỹ năng cá nhân và tư duy hệ thống. Nhưng nhiều vấn đề (như hàng đợi review ở đầu bài) chỉ giải được **ở cấp đội**.

### 8.1. Chuẩn review

- **Người mở PR chịu trách nhiệm hoàn toàn**, dù code do ai hay công cụ nào viết. "AI viết" không bao giờ là lời giải thích trong review.
- **Giới hạn kích thước PR** (ví dụ 400 dòng thay đổi không tính file sinh tự động). Lớn hơn → tách.
- **Mô hình "tác giả giải thích"**: mô tả PR phải nói được: thay đổi gì, vì sao, bất biến nào được giữ, đã test thế nào, rủi ro ở đâu. Nếu tác giả không viết được mô tả này, PR chưa sẵn sàng.
- **Thời gian review là công việc thật**: lên kế hoạch cho nó như lên kế hoạch cho viết code, không phải "làm khi rảnh".
- **WIP limit**: mỗi người không mở quá N PR chưa được merge. Muốn mở PR mới → review PR của người khác trước. Đây là vòng cân bằng ở mục 1.3.

### 8.2. Nguồn gốc (provenance)

Biết một thay đổi **đến từ đâu** giúp khi điều tra sự cố và khi tuân thủ chính sách:

- Commit hoặc PR ghi chú khi có phần đáng kể do AI sinh (nhiều team dùng trailer trong commit message, hoặc nhãn PR).
- Với thay đổi quan trọng, lưu **spec** đã dùng cùng PR (mục 3.4) - đó là "prompt" có giá trị nhất để giữ lại.
- Dependency mới **luôn** được ghi rõ ai thêm và vì sao.

Mục đích không phải để "đổ lỗi cho AI" (người merge vẫn chịu trách nhiệm), mà để **học**: sau 3 tháng, các sự cố có tập trung ở loại thay đổi nào không? Có loại việc nào AI làm tốt ổn định, loại nào cần đổi chế độ từ "giao" sang "làm cùng"?

### 8.3. Prompt nội bộ là code - cần có eval

Nhiều team không chỉ **dùng** AI để code mà còn **xây công cụ nội bộ** có prompt bên trong: bot tóm tắt PR, bot viết release note, script sinh test từ spec, công cụ phân loại ticket. Những prompt đó là **code**, và cần được đối xử như code:

| Thực hành với code | Tương đương với prompt |
|---|---|
| Lưu trong git, có review | Prompt nằm trong repo, thay đổi qua PR |
| Test hồi quy | **Eval**: một tập đầu vào cố định + tiêu chí đánh giá, chạy mỗi khi đổi prompt hoặc đổi model |
| Ghim phiên bản dependency | Ghim phiên bản model |
| Giám sát production | Lấy mẫu output thật để người xem định kỳ |

Một bộ eval tối thiểu cho bot tóm tắt PR có thể chỉ là 20 PR thật đã có bản tóm tắt "chuẩn" do người viết, cộng vài tiêu chí: có nhắc thay đổi schema không, có bịa ra file không tồn tại không, độ dài có dưới 150 từ không. Không có eval, mỗi lần ai đó "cải thiện" prompt là một lần thay đổi chưa test lên production. Bài 8 sẽ đi sâu vào eval cho hệ thống có AI bên trong.

### 8.4. Một trang chính sách AI cho đội

```text
CHÍNH SÁCH DÙNG AI - TEAM [tên]          (xem lại mỗi quý)

1. TRÁCH NHIỆM: Người mở PR chịu trách nhiệm toàn bộ nội dung PR.
2. DỮ LIỆU: Không đưa secret, dữ liệu khách, mã nguồn thuộc phạm vi bảo mật
   [liệt kê] vào công cụ ngoài danh sách được duyệt [liệt kê].
3. VÙNG TỰ GIỮ: [phân quyền, thanh toán, mã hóa, migration dữ liệu] - người viết
   phần lõi; AI chỉ phản biện. Test property bắt buộc.
4. PR: tối đa ~400 dòng; mô tả theo mẫu; ghi chú khi phần lớn do AI sinh.
5. DEPENDENCY: mọi dependency mới phải được người kiểm tra tồn tại, giấy phép,
   mức độ duy trì.
6. AGENT: chỉ chạy trong sandbox; không có credential production;
   không được sửa CI/test để "cho xanh" mà không có người duyệt riêng.
7. CÔNG CỤ NỘI BỘ CÓ PROMPT: prompt trong repo, ghim model, có eval.
8. ĐO: theo dõi [lead time, tỉ lệ thay đổi gây lỗi, thời gian chờ review] hàng tháng.
```

---

## 📖 9. Đo năng suất thật - không đo cảm giác

### 9.1. Cảm giác nhanh không phải là nhanh

Năm 2025, tổ chức nghiên cứu METR thực hiện một thử nghiệm có đối chứng ngẫu nhiên với các lập trình viên mã nguồn mở giàu kinh nghiệm, làm việc trên chính các dự án lớn họ đã quen. Kết quả gây chú ý: khi được phép dùng công cụ AI (thời điểm đầu 2025), họ hoàn thành việc **chậm hơn khoảng 19%** - trong khi **chính họ tin** mình đã **nhanh hơn khoảng 20%**.

Cần đọc kết quả này cẩn thận: đó là một nghiên cứu, trong một bối cảnh cụ thể (người rất thạo codebase, dự án lớn, công cụ ở một thời điểm), và không chứng minh rằng AI làm mọi người chậm đi. Nhưng nó chứng minh một điều quan trọng hơn: **cảm nhận về năng suất của chính mình có thể sai cả về chiều**. Sinh code nhanh **cảm thấy** rất năng suất. Thời gian đọc, sửa, chờ, và làm lại thì ít được nhớ đến.

### 9.2. Đo cái gì?

```mermaid
flowchart TB
    subgraph SAI["❌ Đo hoạt động (dễ đo, dễ đánh lừa)"]
        X1["Số dòng code"]
        X2["Số PR, số commit"]
        X3["% code do AI sinh"]
        X4["Cảm nhận 'tôi nhanh hơn'"]
    end
    subgraph DUNG["✅ Đo kết quả của hệ thống"]
        Y1["Lead time: từ bắt đầu đến production"]
        Y2["Tỉ lệ thay đổi gây lỗi"]
        Y3["Thời gian khôi phục sau sự cố"]
        Y4["Tần suất deploy"]
        Y5["Thời gian PR chờ review"]
        Y6["Tỉ lệ làm lại: code bị sửa/xóa trong 2-3 tuần"]
    end
```

Bốn chỉ số đầu ở cột phải là **bộ DORA** quen thuộc - chúng đo cả **tốc độ** lẫn **độ ổn định**, nên không thể "tăng" bằng cách đẩy nhanh một khâu và đổ rủi ro sang khâu khác. Hai chỉ số sau đặc biệt hữu ích khi có AI: **thời gian chờ review** cho thấy nút thắt đã dịch sang đâu (mục 1.3), và **tỉ lệ làm lại** (churn) cho thấy code sinh nhanh có phải sửa nhiều sau đó không.

!!! warning "Định luật Goodhart"
    Đặt "% code do AI sinh" hay "số PR mỗi tuần" làm KPI, và con số đó sẽ tăng - bằng cách tách PR vô nghĩa, sinh code không cần thiết, hoặc ghi nhận mọi thứ là "do AI". Đo **kết quả**, không đo **hoạt động**.

### 9.3. Thử nghiệm nhỏ trong đội

Không cần nghiên cứu lớn. Một team có thể tự trả lời "AI có giúp chúng ta không, ở loại việc nào?" bằng một thử nghiệm 6-8 tuần:

1. **Đo nền** 4 tuần trước khi thay đổi cách làm: lead time, tỉ lệ thay đổi gây lỗi, thời gian chờ review, churn.
2. **Phân loại việc**: sửa bug nhỏ, tính năng CRUD, tính năng có logic nghiệp vụ, refactor, viết test, việc hạ tầng.
3. **Thay đổi một biến**: ví dụ áp dụng ma trận ủy quyền + spec mẫu + giới hạn PR.
4. **Đo lại** theo từng loại việc, không chỉ tổng.
5. **Hỏi cả cảm nhận** - và so sánh với số liệu. Chỗ cảm nhận và số liệu lệch nhau là chỗ đáng tìm hiểu nhất.

Kết quả thường thấy: AI giúp rất rõ ở một số loại việc (boilerplate, test cho bảng đầu vào, việc có khuôn), ít hoặc âm ở loại khác (logic nghiệp vụ tinh tế trong codebase lớn, việc đòi hỏi bối cảnh không được ghi lại). Biết điều đó giúp đội **đặt AI đúng chỗ** - chính là ma trận ở mục 2, nhưng dựa trên số liệu của chính đội.

---

## 🌍 Tình huống thực tế

### Tình huống 1: Team logistics ở đầu bài - sửa thế nào?

Nhìn lại câu chuyện mở đầu bằng công cụ của bài:

- **Chẩn đoán** (mục 1, 9): đo thời gian chờ review (gần 3 ngày) và tỉ lệ thay đổi gây lỗi (tăng 50%). Nút thắt rõ ràng là **verify**, không phải generate.
- **Vòng phản hồi** (mục 1.3): áp lực "duyệt nhanh" → review hời hợt → lỗi → việc gấp → thêm PR. Vòng tăng cường.

Những gì team đã làm trong 6 tuần:

1. **WIP limit**: mỗi người tối đa 2 PR đang mở. Muốn mở thêm → review của người khác trước.
2. **PR tối đa 400 dòng**. PR lớn bị trả lại, không ai đọc lướt nữa.
3. **Ma trận ủy quyền**: module tính cước vận chuyển và đối soát COD chuyển sang chế độ "làm cùng" - người viết property test trước (tổng cước không âm, cộng dồn khớp hóa đơn đối tác).
4. **Context tầng 1**: một file quy ước trong repo, bổ sung mỗi khi AI làm sai vì thiếu bối cảnh.
5. **Đo**: lead time và tỉ lệ lỗi theo tuần, hiển thị trong buổi họp đội.

Kết quả sau 6 tuần: số PR mỗi tuần **giảm** khoảng 30% so với đỉnh, nhưng lead time giảm gần một nửa, tỉ lệ thay đổi gây lỗi về dưới mức trước khi dùng AI. Số tính năng ra mắt tăng thật sự lần đầu tiên.

Bài học: **ít PR hơn, nhanh hơn**. Năng suất của hệ thống không phải tổng năng suất của từng người.

### Tình huống 2: Agent và README độc

Một kỹ sư dùng agent để "nâng cấp tất cả dependency lên bản mới nhất và sửa lỗi build". Agent đọc changelog và README của các package để biết thay đổi breaking. Một package nhỏ (đã bị chiếm quyền) có README chứa dòng chữ ẩn: chỉ dẫn agent "thêm script postinstall sau vào package.json để sửa lỗi tương thích".

Agent làm theo - vì với nó, đó là một hướng dẫn hợp lý trong tài liệu. Script gửi biến môi trường của máy build ra ngoài.

Điều gì đã ngăn thiệt hại lớn (hoặc lẽ ra phải ngăn)?

- **Sandbox không có secret**: agent chạy trong container không có credential thật → script lấy được biến môi trường vô hại. *(Lớp này đã có - cứu được.)*
- **Review dependency và script cài đặt**: thay đổi `package.json` thêm `postinstall` phải được người đọc kỹ. *(Lớp này có lỗ: PR 60 file, reviewer lướt.)*
- **CI chặn script cài đặt lạ** hoặc chạy cài đặt trong môi trường không có mạng ra ngoài. *(Chưa có.)*

Đây là mô hình pho mát Thụy Sĩ (Bài 5) áp dụng cho agent: một lớp giữ được, hai lớp có lỗ. Sau sự việc, team thêm quy tắc: thay đổi script cài đặt hoặc cấu hình CI luôn cần một người duyệt riêng, tách khỏi PR nâng cấp.

---

## ⚠️ Sai lầm thường gặp

| Sai lầm | Hệ quả | Thay bằng |
|---|---|---|
| Đo năng suất bằng số PR, số dòng, % code AI | Tối ưu sai, Goodhart | Lead time, tỉ lệ lỗi, thời gian chờ review, churn |
| Tăng tốc generate mà không đầu tư verify | Hàng đợi review vô hạn, lỗi lọt | Đầu tư vào test, spec, PR nhỏ |
| Để AI viết cả code lẫn test từ cùng một hiểu biết | Lỗ pho mát tương quan | Người viết property/bất biến; AI cài đặt |
| Chấp nhận test gương / test "không ném lỗi" | Test khóa bug, cản sửa đúng | Property test; "làm hỏng có chủ đích" |
| Giao mọi việc theo cùng một cách | Rủi ro cao bị đối xử như rủi ro thấp | Ma trận ủy quyền: giao / làm cùng / tự giữ |
| Spec một dòng cho việc có tiền, quyền | AI tự đoán quyết định nghiệp vụ | Spec có bất biến, ví dụ biên, non-goals |
| Không kiểm tra dependency AI thêm vào | Package bịa, package độc | Mọi dependency mới qua người |
| Đọc cố PR 1.500 dòng | Review hời hợt | Trả lại, yêu cầu tách |
| Cho agent quyền rộng "cho tiện" | Blast radius lớn, prompt injection nguy hiểm | Sandbox, quyền tối thiểu, người duyệt thao tác một chiều |
| Không bao giờ tự viết, tự debug | Mất kỹ năng, không xử lý được sự cố | Tự làm trước, debug tay 15 phút, vùng tự giữ |
| Prompt nội bộ sửa thẳng, không eval | Hồi quy âm thầm | Prompt trong repo, ghim model, eval |

---

## 🏋️ Bài tập

### Bài tập 1: Xếp việc vào ma trận ủy quyền (⭐ Dễ)

Xếp các việc sau vào **giao / làm cùng / tự giữ**, mỗi việc một câu lý do theo ba trục (rủi ro, đảo ngược, kiểm chứng):

1. Viết script sinh 10.000 đơn hàng giả cho môi trường dev.
2. Thêm cột `refunded_amount` và migration backfill cho bảng 30 triệu dòng.
3. Viết hàm định dạng số điện thoại Việt Nam để hiển thị (`0912345678` → `0912 345 678`).
4. Thay đổi logic kiểm tra "user có được xem đơn hàng này không".
5. Viết tài liệu hướng dẫn chạy dự án cho người mới.
6. Viết hàm tính lãi trả góp hàng tháng.

<details markdown="1"><summary>Đáp án tham khảo</summary>

1. **Giao** - rủi ro thấp (chỉ dev), đảo ngược dễ (xóa dữ liệu), kiểm chứng dễ (chạy xem).
2. **Làm cùng, phần quyết định tự giữ** - rủi ro cao, khó đảo ngược (backfill ghi dữ liệu), kiểm chứng được một phần. Người quyết định chiến lược (expand-migrate-contract, chạy theo lô, khóa bảng); AI có thể viết script backfill theo lô, người review kỹ và chạy thử trên bản sao dữ liệu.
3. **Giao** - rủi ro thấp (chỉ hiển thị), kiểm chứng dễ bằng bảng ví dụ (gồm số có `+84`, số máy bàn, chuỗi rỗng).
4. **Tự giữ** - rủi ro rất cao (lộ dữ liệu), khó phát hiện khi sai. Tự viết; AI phản biện ("liệt kê mọi cách đọc đơn của người khác").
5. **Giao** - rủi ro thấp; kiểm chứng: nhờ một người mới thật sự làm theo.
6. **Làm cùng** - rủi ro cao (tiền), nhưng kiểm chứng được mạnh: người viết property (tổng gốc trả = khoản vay, không âm, làm tròn đúng quy định) và ví dụ từ bảng tính của bộ phận tài chính; AI cài đặt.

</details>

### Bài tập 2: Tìm nút thắt (⭐ Dễ)

Một team có số liệu trung bình mỗi PR: viết code 3 giờ, chờ review 40 giờ, review 1 giờ, chờ CI 2 giờ, sửa sau review 2 giờ, chờ deploy (deploy 1 lần/tuần) 60 giờ. Trưởng nhóm đề xuất mua thêm license AI để "viết code nhanh hơn". Bạn nhận xét gì? Đề xuất 2 thay đổi có tác động lớn nhất.

<details markdown="1"><summary>Đáp án</summary>

Tổng khoảng 108 giờ, trong đó viết code chỉ 3 giờ (khoảng 3%). Dù AI làm viết code nhanh gấp 10, lead time chỉ giảm khoảng 2,7 giờ (khoảng 2,5%). Hai khoảng **chờ** chiếm gần 93%: chờ deploy 60 giờ và chờ review 40 giờ.

Đề xuất:

1. **Deploy thường xuyên hơn** (hằng ngày hoặc liên tục, kèm canary và rollback tự động) - giảm tới khoảng 60 giờ.
2. **Giảm thời gian chờ review**: WIP limit, PR nhỏ, khung giờ review cố định mỗi ngày - có thể giảm từ 40 xuống dưới 8 giờ.

Đây là bài học lý thuyết ràng buộc: tối ưu khâu không phải nút thắt gần như không đem lại gì.

</details>

### Bài tập 3: Viết property cho hàm của bạn (⭐⭐ Trung bình)

Với mỗi hàm dưới đây, viết **ít nhất 3 property** (không cần biết đáp án cụ thể cho từng đầu vào):

1. `apply_discount(price, percent) -> price_after` (tiền là số nguyên đồng)
2. `paginate(items, page_size) -> list[list]`
3. `normalize_phone(s) -> str` (đưa số điện thoại VN về dạng `+84...`)
4. `merge_schedules(a, b) -> list[interval]` (gộp hai danh sách khoảng thời gian bận)

<details markdown="1"><summary>Đáp án tham khảo</summary>

1. `apply_discount`: `0 <= kết quả <= price`; `percent = 0` → bằng `price`; `percent = 100` → bằng 0; tăng `percent` thì kết quả không tăng (đơn điệu); kết quả là số nguyên.
2. `paginate`: nối các trang lại = `items` (không mất, không trùng, đúng thứ tự); mọi trang trừ trang cuối có đúng `page_size` phần tử; trang cuối có 1..`page_size` phần tử (hoặc không có trang nào nếu `items` rỗng); số trang = `ceil(len / page_size)`.
3. `normalize_phone`: **idempotent** - `normalize(normalize(s)) == normalize(s)`; kết quả bắt đầu bằng `+84` và chỉ có chữ số sau đó; các cách viết khác nhau của cùng một số (`0912 345 678`, `+84912345678`, `84-912-345-678`) cho cùng kết quả.
4. `merge_schedules`: kết quả đã sắp xếp và không có hai khoảng chồng lấn hoặc chạm nhau; mọi thời điểm bận trong `a` hoặc `b` đều bận trong kết quả và ngược lại; `merge(a, b) == merge(b, a)` (giao hoán); `merge(a, a) == merge(a, [])`.

Để ý: idempotent, giao hoán, "nối lại bằng ban đầu" (round-trip), đơn điệu, bảo toàn tổng - đây là các **khuôn property** dùng lại được cho rất nhiều hàm.

</details>

### Bài tập 4: Làm hỏng có chủ đích (⭐⭐ Trung bình)

Lấy chương trình chia hóa đơn ở mục 4.3 (bản sửa). Thực hiện lần lượt 3 "đột biến" dưới đây vào `split_bill_fixed` / `splitBillFixed`, chạy lại, và ghi nhận test nào bắt được:

1. Đổi `[base + 1] * rem + [base] * (n - rem)` thành `[base] * n` (Go: bỏ `if i < rem { parts[i]++ }`).
2. Đổi thành `[base + 1] * (rem + 1) + [base] * (n - rem - 1)` (Go: `if i <= rem`).
3. Đổi thứ tự: `[base] * (n - rem) + [base + 1] * rem` (Go: cộng 1 cho `rem` phần **cuối**).

<details markdown="1"><summary>Đáp án</summary>

1. Property test bắt (FAIL 14144/20010 - tổng thiếu `rem` đồng, phản ví dụ nhỏ nhất `total=1, n=2` → `[0, 0]`). Test ví dụ **không** bắt (300.000/3 và 100.000/4 đều chia hết), và test gương còn **chuyển sang xanh** - thêm một lý do để không tin nó.
2. Property test bắt ở **mọi** đầu vào (FAIL 20010/20010 - tổng luôn thừa 1 đồng), phản ví dụ nhỏ nhất `total=0, n=1` → `[1]`. Test ví dụ cũng bắt (`300.000/3` → `[100.001, 100.000, 100.000]`).
3. **Không test nào bắt** (test ví dụ và property đều PASS; test gương vẫn đỏ như với bản sửa gốc - nó đỏ với mọi bản đúng) - và đúng là không nên bắt: hợp đồng không nói phần lớn hơn phải ở đầu hay cuối. Đây là một thay đổi **hợp lệ**. Nếu nghiệp vụ cần thứ tự (ví dụ "người tạo hóa đơn chịu phần lẻ"), hãy **thêm điều đó vào hợp đồng** và viết property tương ứng. Đột biến không bị bắt là câu hỏi: "**hành vi này có quan trọng không?**".

</details>

### Bài tập 5: Viết spec theo mẫu (⭐⭐ Trung bình)

Viết spec đầy đủ theo mẫu mục 3.2 cho việc: *"Thêm tính năng mã giảm giá dùng một lần cho mỗi khách"* ở một shop online. Phải có ít nhất 3 bất biến, 6 ví dụ (gồm ít nhất 3 trường hợp biên/lỗi), 3 non-goals, và 1 câu hỏi mở.

<details markdown="1"><summary>Gợi ý kiểm tra</summary>

- Bất biến nên có: một khách dùng một mã tối đa một lần **kể cả hai đơn đặt song song**; giảm giá không làm tổng đơn âm; mã hết hạn / hết lượt không áp dụng được; hủy đơn thì mã có được trả lại không (quyết định - ghi rõ).
- Ví dụ biên: đơn dưới giá trị tối thiểu, mã hết hạn đúng 23:59:59 theo giờ nào (múi giờ!), hai tab cùng đặt, đơn bị hủy rồi đặt lại, giảm theo % có làm tròn.
- Non-goals: không làm mã giảm giá cho nhóm khách, không cộng dồn nhiều mã, không đổi giao diện giỏ hàng.
- Câu hỏi mở tốt: "Khi đơn bị hoàn tiền, mã được trả lại cho khách không?" - đây là **quyết định nghiệp vụ** mà AI không được tự đoán.

Thử giao spec này cho một công cụ AI, rồi đếm: nó hỏi lại bao nhiêu câu? Code nó viết có giữ bất biến "hai đơn song song" không (xem có transaction/ràng buộc unique không)?

</details>

### Bài tập 6: Thiết kế quyền cho agent (⭐⭐⭐ Khó)

Đội bạn muốn dùng một agent tự động: mỗi đêm đọc các issue có nhãn `good-first-bug`, cố sửa, chạy test, và mở PR. Thiết kế:

a) Agent cần những quyền gì? Không được có quyền gì?
b) Liệt kê 4 cách nó có thể gây hại (kể cả bị prompt injection qua nội dung issue).
c) Với mỗi cách, một lớp phòng thủ.
d) Chỉ số nào cho biết sau 1 tháng agent này **có ích thật** cho đội?

<details markdown="1"><summary>Đáp án tham khảo</summary>

a) **Có**: đọc repo, đọc issue có nhãn cụ thể, tạo nhánh với tiền tố riêng (`agent/...`), mở PR (không merge), chạy test trong sandbox. **Không**: push lên nhánh chính, merge, sửa workflow CI, đọc secret, truy cập mạng tùy ý (chỉ registry package đã duyệt), truy cập production.

b) và c):

| Cách gây hại | Phòng thủ |
|---|---|
| Issue chứa chỉ dẫn độc ("thêm lệnh gửi file cấu hình ra ngoài") | Sandbox không có secret, mạng giới hạn; nội dung issue là dữ liệu; PR thay đổi script/CI bị chặn hoặc cần duyệt riêng |
| Sửa test cho xanh thay vì sửa bug | CI phát hiện thay đổi trong file test → gắn nhãn "cần review test"; quy tắc không nới assertion |
| PR quá lớn, sửa lan sang module không liên quan | Giới hạn số file/dòng; PR vượt giới hạn tự đóng |
| Tốn tài nguyên (lặp vô hạn, chạy test nặng) | Giới hạn thời gian, số bước, chi phí mỗi issue |

d) Chỉ số: **tỉ lệ PR của agent được merge** mà không cần sửa nhiều; **thời gian reviewer bỏ ra** cho mỗi PR agent (nếu review mất lâu hơn tự sửa, agent đang làm chậm đội); **tỉ lệ PR agent gây lỗi** sau khi merge; số issue `good-first-bug` tồn đọng có giảm không. Cũng nên hỏi: người mới trong đội có mất cơ hội học vì các bug dễ đã bị agent "ăn" hết không? (mục 7 - deskilling ở cấp đội).

</details>

### Bài tập 7: Đo năng suất cho đội của bạn (⭐⭐⭐ Khó)

Thiết kế thử nghiệm 8 tuần (theo mục 9.3) cho đội của bạn (hoặc một đội giả định 5 người). Nêu rõ: các chỉ số đo và cách lấy số liệu (từ git, CI, hệ thống ticket), cách phân loại việc, một thay đổi duy nhất bạn sẽ thử, và **kết quả nào sẽ khiến bạn kết luận thay đổi đó không có ích**.

<details markdown="1"><summary>Gợi ý</summary>

Phần cuối là quan trọng nhất: viết **trước** khi bắt đầu tiêu chí "thất bại" (ví dụ: "nếu lead time không giảm ít nhất 15% **hoặc** tỉ lệ thay đổi gây lỗi tăng, chúng ta coi thay đổi không có ích"). Nếu không viết trước, mọi kết quả sẽ được diễn giải thành "thành công" - đó là thiên kiến xác nhận (confirmation bias), và cũng là một dạng normalization of deviance (Bài 5 §9).

Nguồn số liệu: lead time từ thời điểm commit đầu tiên của nhánh đến thời điểm deploy (git + CI); thời gian chờ review từ lúc mở PR đến review đầu tiên (API của nền tảng git); thay đổi gây lỗi từ sự cố/rollback gắn với deploy; churn từ git (dòng bị sửa/xóa trong 21 ngày sau khi merge).

</details>

---

## ✅ Checklist hoàn thành

- [ ] Tôi vẽ được vòng lặp spec → generate → verify → integrate và chỉ ra nút thắt hiện tại của đội mình
- [ ] Tôi giải thích được vì sao tăng tốc viết code có thể làm hệ thống chậm đi (hàng đợi review, vòng tăng cường)
- [ ] Tôi xếp được một việc vào ma trận ủy quyền theo rủi ro, đảo ngược, kiểm chứng - và biết cách dịch nó sang ô an toàn hơn
- [ ] Tôi có context tầng dự án cho AI và cập nhật nó khi AI sai vì thiếu bối cảnh
- [ ] Tôi viết được spec có bất biến, ví dụ biên, non-goals, câu hỏi mở
- [ ] Tôi viết được property test và giải thích vì sao test gương còn tệ hơn không có test
- [ ] Tôi biết Python `round` và Go `math.Round` làm tròn khác nhau, và vì sao điều đó quan trọng khi AI chuyển code giữa hai ngôn ngữ
- [ ] Tôi review output AI với checklist: API bịa, package lạ, edge case, bảo mật, bản quyền, hiệu năng
- [ ] Tôi dùng kỹ thuật "làm hỏng có chủ đích" để kiểm tra test
- [ ] Tôi thiết kế được ranh giới quyền cho một agent: sandbox, quyền tối thiểu, cổng kiểm soát
- [ ] Tôi có thói quen giữ kỹ năng: tự làm trước, debug tay, viết phần lõi
- [ ] Tôi đo năng suất bằng kết quả hệ thống (lead time, tỉ lệ lỗi, thời gian chờ review), không bằng hoạt động

**Bài tiếp theo**: [Bài 8: Xây hệ thống có AI bên trong](./08-building-ai-systems.md)
