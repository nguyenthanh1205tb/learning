// Package cache nhớ tạm danh sách sản phẩm. Memory dùng trong test và khi
// không có Redis. Redis dùng khi chạy với REDIS_ADDR.
package cache

import (
	"context"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// Cache là bộ nhớ tạm key-value có hạn.
type Cache interface {
	Get(ctx context.Context, key string) (string, bool, error)
	Set(ctx context.Context, key, value string, ttl time.Duration) error
	Delete(ctx context.Context, key string) error
}

type item struct {
	value   string
	expires time.Time
}

// Memory là cache trong process.
type Memory struct {
	mu  sync.Mutex
	m   map[string]item
	now func() time.Time
}

// NewMemory tạo cache rỗng.
func NewMemory() *Memory {
	return &Memory{m: map[string]item{}, now: time.Now}
}

func (c *Memory) Get(_ context.Context, key string) (string, bool, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	it, ok := c.m[key]
	if !ok || !c.now().Before(it.expires) {
		delete(c.m, key)
		return "", false, nil
	}
	return it.value, true, nil
}

func (c *Memory) Set(_ context.Context, key, value string, ttl time.Duration) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.m[key] = item{value: value, expires: c.now().Add(ttl)}
	return nil
}

func (c *Memory) Delete(_ context.Context, key string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.m, key)
	return nil
}

// Redis bọc go-redis.
type Redis struct {
	client *redis.Client
}

// NewRedis kết nối Redis tại addr (host:port).
func NewRedis(addr string) *Redis {
	return &Redis{client: redis.NewClient(&redis.Options{Addr: addr})}
}

func (c *Redis) Get(ctx context.Context, key string) (string, bool, error) {
	v, err := c.client.Get(ctx, key).Result()
	if err == redis.Nil {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return v, true, nil
}

func (c *Redis) Set(ctx context.Context, key, value string, ttl time.Duration) error {
	return c.client.Set(ctx, key, value, ttl).Err()
}

func (c *Redis) Delete(ctx context.Context, key string) error {
	return c.client.Del(ctx, key).Err()
}
