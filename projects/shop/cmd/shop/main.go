package main

import (
	"context"
	"flag"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/nguyenthanh1205tb/learning/projects/shop/internal/cache"
	"github.com/nguyenthanh1205tb/learning/projects/shop/internal/httpserver"
	"github.com/nguyenthanh1205tb/learning/projects/shop/internal/money"
	"github.com/nguyenthanh1205tb/learning/projects/shop/internal/store"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	addr := flag.String("addr", ":8080", "địa chỉ lắng nghe")
	dsn := flag.String("db", "file:shop.db?_pragma=busy_timeout(5000)&_pragma=foreign_keys(1)", "DSN SQLite")
	redisAddr := flag.String("redis", os.Getenv("REDIS_ADDR"), "host:port của Redis, bỏ trống thì cache trong bộ nhớ")
	flag.Parse()

	secret := os.Getenv("SHOP_SECRET")
	if len(secret) < 16 {
		log.Fatal("đặt SHOP_SECRET dài ít nhất 16 ký tự")
	}
	st, err := store.Open(*dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer st.Close()
	seed(st)

	var c cache.Cache = cache.NewMemory()
	if *redisAddr != "" {
		c = cache.NewRedis(*redisAddr)
		log.Printf("cache: redis %s", *redisAddr)
	}
	srv := httpserver.New(st, c, []byte(secret), bcrypt.DefaultCost)
	log.Printf("shop lắng nghe %s", *addr)
	if err := http.ListenAndServe(*addr, srv); err != nil {
		log.Fatal(err)
	}
}

func seed(st *store.Store) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	list, err := st.ListProducts(ctx)
	if err != nil {
		log.Fatal(err)
	}
	if len(list) > 0 {
		return
	}
	if _, err := st.CreateProduct(ctx, "tai-nghe", "Tai nghe", money.VND(450_000), 20); err != nil {
		log.Fatal(err)
	}
}
