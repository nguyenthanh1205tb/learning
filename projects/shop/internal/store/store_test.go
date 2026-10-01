package store

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/nguyenthanh1205tb/learning/projects/shop/internal/money"
)

func openTest(t *testing.T) *Store {
	t.Helper()
	dsn := "file:" + filepath.Join(t.TempDir(), "shop.db") + "?_pragma=busy_timeout(5000)&_pragma=foreign_keys(1)"
	s, err := Open(dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	return s
}

func TestPlaceOrderIsIdempotent(t *testing.T) {
	s := openTest(t)
	ctx := context.Background()
	user, err := s.CreateUser(ctx, "An@Shop.vn", "hash")
	if err != nil {
		t.Fatal(err)
	}
	if user.Email != "an@shop.vn" {
		t.Fatalf("email = %s", user.Email)
	}
	p, err := s.CreateProduct(ctx, "tai-nghe", "Tai nghe", 450_000, 2)
	if err != nil {
		t.Fatal(err)
	}
	first, err := s.PlaceOrder(ctx, user.ID, p.ID, 1, "key-00000001")
	if err != nil || !first.Created || first.TotalVND != 450_000 {
		t.Fatalf("first = %+v err=%v", first, err)
	}
	second, err := s.PlaceOrder(ctx, user.ID, p.ID, 1, "key-00000001")
	if err != nil || second.Created || second.ID != first.ID {
		t.Fatalf("replay = %+v err=%v", second, err)
	}
	stock, err := s.ProductStock(ctx, p.ID)
	if err != nil || stock != 1 {
		t.Fatalf("stock = %d err=%v", stock, err)
	}
	events, err := s.OutboxByOrder(ctx, first.ID)
	if err != nil || len(events) != 1 || events[0].Kind != "order.created" {
		t.Fatalf("outbox = %+v err=%v", events, err)
	}
	if _, err := s.PlaceOrder(ctx, user.ID, p.ID, 2, "key-00000001"); err != ErrIdempotency {
		t.Fatalf("đổi nội dung cùng key: %v", err)
	}
}

func TestStockRunsOut(t *testing.T) {
	s := openTest(t)
	ctx := context.Background()
	user, err := s.CreateUser(ctx, "b@shop.vn", "hash")
	if err != nil {
		t.Fatal(err)
	}
	p, err := s.CreateProduct(ctx, "op", "Op lung", money.VND(90_000), 1)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.PlaceOrder(ctx, user.ID, p.ID, 1, "key-aaaaaaaa"); err != nil {
		t.Fatal(err)
	}
	if _, err := s.PlaceOrder(ctx, user.ID, p.ID, 1, "key-bbbbbbbb"); err != ErrStock {
		t.Fatalf("hết hàng: %v", err)
	}
}

func TestDuplicateEmail(t *testing.T) {
	s := openTest(t)
	ctx := context.Background()
	if _, err := s.CreateUser(ctx, "a@shop.vn", "hash"); err != nil {
		t.Fatal(err)
	}
	if _, err := s.CreateUser(ctx, "a@shop.vn", "hash"); err != ErrEmailTaken {
		t.Fatalf("trùng email: %v", err)
	}
}
