# Shop mẫu

API nhỏ đi cùng [Bài 17](../../backend/17-shop-capstone.md): đăng ký, đăng nhập, xem hàng, đặt một dòng đơn. Tiền là số nguyên, đặt lại cùng `Idempotency-Key` không trừ kho lần hai, sự kiện nằm trong bảng `outbox`.

Cần Go 1.23 trở lên.

```bash
cd projects/shop
go test ./...
export SHOP_SECRET=dev-secret-change-me
go run ./cmd/shop
```

Cache trong bộ nhớ là mặc định. Trỏ Redis bằng `REDIS_ADDR=127.0.0.1:6379` hoặc `-redis 127.0.0.1:6379`. Database mặc định là file SQLite `shop.db` để test không cần Docker.
