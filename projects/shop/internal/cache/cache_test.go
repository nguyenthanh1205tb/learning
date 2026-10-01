package cache

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

func TestMemoryExpires(t *testing.T) {
	c := NewMemory()
	now := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	c.now = func() time.Time { return now }
	ctx := context.Background()
	if err := c.Set(ctx, "products", "[]", time.Second); err != nil {
		t.Fatal(err)
	}
	if v, ok, err := c.Get(ctx, "products"); err != nil || !ok || v != "[]" {
		t.Fatalf("get %q ok=%v err=%v", v, ok, err)
	}
	now = now.Add(2 * time.Second)
	if _, ok, err := c.Get(ctx, "products"); err != nil || ok {
		t.Fatalf("hết hạn vẫn còn: ok=%v err=%v", ok, err)
	}
}

func TestRedisRoundTrip(t *testing.T) {
	mr := miniredis.RunT(t)
	c := &Redis{client: redis.NewClient(&redis.Options{Addr: mr.Addr()})}
	ctx := context.Background()
	if err := c.Set(ctx, "products", `[{"sku":"sku-1"}]`, time.Minute); err != nil {
		t.Fatal(err)
	}
	v, ok, err := c.Get(ctx, "products")
	if err != nil || !ok || v == "" {
		t.Fatalf("get %q ok=%v err=%v", v, ok, err)
	}
	if err := c.Delete(ctx, "products"); err != nil {
		t.Fatal(err)
	}
	if _, ok, err := c.Get(ctx, "products"); err != nil || ok {
		t.Fatalf("sau delete ok=%v err=%v", ok, err)
	}
}
