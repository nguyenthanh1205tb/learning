// Package store lưu user, sản phẩm, đơn và outbox trong cùng một database.
// Bản chạy được dùng SQLite để go test không cần Docker. Câu SQL dùng kiểu
// viết mà PostgreSQL cũng nhận (INTEGER, TEXT, tham số ? cần đổi thành $1
// khi chuyển driver).
package store

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/nguyenthanh1205tb/learning/projects/shop/internal/money"
	_ "modernc.org/sqlite"
)

var (
	ErrEmailTaken  = errors.New("store: email đã tồn tại")
	ErrNotFound    = errors.New("store: không thấy")
	ErrStock       = errors.New("store: không đủ hàng")
	ErrIdempotency = errors.New("store: cùng Idempotency-Key nhưng nội dung khác")
	ErrBadInput    = errors.New("store: dữ liệu không hợp lệ")
)

const schema = `
CREATE TABLE IF NOT EXISTS users (
	id INTEGER PRIMARY KEY,
	email TEXT NOT NULL UNIQUE,
	password_hash TEXT NOT NULL,
	created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
	id INTEGER PRIMARY KEY,
	sku TEXT NOT NULL UNIQUE,
	name TEXT NOT NULL,
	price_vnd INTEGER NOT NULL CHECK (price_vnd >= 0),
	stock INTEGER NOT NULL CHECK (stock >= 0)
);
CREATE TABLE IF NOT EXISTS orders (
	id INTEGER PRIMARY KEY,
	user_id INTEGER NOT NULL REFERENCES users(id),
	product_id INTEGER NOT NULL REFERENCES products(id),
	qty INTEGER NOT NULL CHECK (qty > 0),
	total_vnd INTEGER NOT NULL,
	idempotency_key TEXT NOT NULL,
	request_hash TEXT NOT NULL,
	created_at TEXT NOT NULL,
	UNIQUE (user_id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS outbox (
	id INTEGER PRIMARY KEY,
	order_id INTEGER NOT NULL REFERENCES orders(id),
	kind TEXT NOT NULL,
	payload TEXT NOT NULL,
	created_at TEXT NOT NULL
);
`

// User là tài khoản.
type User struct {
	ID           int64
	Email        string
	PasswordHash string
}

// Product là hàng bán.
type Product struct {
	ID       int64     `json:"id"`
	SKU      string    `json:"sku"`
	Name     string    `json:"name"`
	PriceVND money.VND `json:"price_vnd"`
	Stock    int64     `json:"stock"`
}

// Order là một dòng đơn (một sản phẩm).
type Order struct {
	ID        int64     `json:"id"`
	UserID    int64     `json:"user_id"`
	ProductID int64     `json:"product_id"`
	Qty       int64     `json:"qty"`
	TotalVND  money.VND `json:"total_vnd"`
	Created   bool      `json:"-"`
}

// OutboxEvent là sự kiện ghi cùng transaction với đơn.
type OutboxEvent struct {
	ID      int64
	OrderID int64
	Kind    string
	Payload string
}

// Store là kho SQLite.
type Store struct {
	db *sql.DB
}

// Open mở file SQLite (hoặc file::memory:?cache=shared) và tạo bảng.
func Open(dsn string) (*Store, error) {
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, err
	}
	return &Store{db: db}, nil
}

// Close đóng database.
func (s *Store) Close() error { return s.db.Close() }

// Ping kiểm tra database còn sống.
func (s *Store) Ping(ctx context.Context) error { return s.db.PingContext(ctx) }

// CreateUser lưu email đã chuẩn hóa và hash mật khẩu.
func (s *Store) CreateUser(ctx context.Context, email, passwordHash string) (User, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if !strings.Contains(email, "@") || passwordHash == "" {
		return User{}, ErrBadInput
	}
	now := time.Now().UTC().Format(time.RFC3339)
	res, err := s.db.ExecContext(ctx,
		`INSERT INTO users(email, password_hash, created_at) VALUES (?, ?, ?)`,
		email, passwordHash, now)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			return User{}, ErrEmailTaken
		}
		return User{}, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return User{}, err
	}
	return User{ID: id, Email: email, PasswordHash: passwordHash}, nil
}

// UserByEmail tìm user theo email.
func (s *Store) UserByEmail(ctx context.Context, email string) (User, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	var u User
	err := s.db.QueryRowContext(ctx,
		`SELECT id, email, password_hash FROM users WHERE email = ?`, email).
		Scan(&u.ID, &u.Email, &u.PasswordHash)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, ErrNotFound
	}
	return u, err
}

// CreateProduct thêm sản phẩm.
func (s *Store) CreateProduct(ctx context.Context, sku, name string, price money.VND, stock int64) (Product, error) {
	if sku == "" || name == "" || price < 0 || stock < 0 {
		return Product{}, ErrBadInput
	}
	res, err := s.db.ExecContext(ctx,
		`INSERT INTO products(sku, name, price_vnd, stock) VALUES (?, ?, ?, ?)`,
		sku, name, int64(price), stock)
	if err != nil {
		return Product{}, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return Product{}, err
	}
	return Product{ID: id, SKU: sku, Name: name, PriceVND: price, Stock: stock}, nil
}

// ListProducts trả về mọi sản phẩm theo id.
func (s *Store) ListProducts(ctx context.Context) ([]Product, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, sku, name, price_vnd, stock FROM products ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Product
	for rows.Next() {
		var p Product
		if err := rows.Scan(&p.ID, &p.SKU, &p.Name, &p.PriceVND, &p.Stock); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// PlaceOrder trừ kho, ghi đơn và outbox trong một transaction.
// Gọi lại cùng user và cùng idempotency key thì trả đơn cũ, không trừ kho lần hai.
// Created báo đây là đơn mới hay đơn được phát lại.
func (s *Store) PlaceOrder(ctx context.Context, userID, productID, qty int64, idemKey string) (Order, error) {
	if userID <= 0 || productID <= 0 || qty <= 0 || len(idemKey) < 8 || len(idemKey) > 128 {
		return Order{}, ErrBadInput
	}
	hash := requestHash(productID, qty)
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Order{}, err
	}
	defer tx.Rollback()

	existing, err := orderByKey(ctx, tx, userID, idemKey)
	if err == nil {
		if existing.hash != hash {
			return Order{}, ErrIdempotency
		}
		existing.order.Created = false
		return existing.order, nil
	}
	if !errors.Is(err, ErrNotFound) {
		return Order{}, err
	}

	var price int64
	res, err := tx.ExecContext(ctx,
		`UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?`,
		qty, productID, qty)
	if err != nil {
		return Order{}, err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return Order{}, err
	}
	if n == 0 {
		var one int
		err := tx.QueryRowContext(ctx, `SELECT 1 FROM products WHERE id = ?`, productID).Scan(&one)
		if errors.Is(err, sql.ErrNoRows) {
			return Order{}, ErrNotFound
		}
		if err != nil {
			return Order{}, err
		}
		return Order{}, ErrStock
	}
	if err := tx.QueryRowContext(ctx, `SELECT price_vnd FROM products WHERE id = ?`, productID).Scan(&price); err != nil {
		return Order{}, err
	}
	total, err := money.Line(money.VND(price), qty)
	if err != nil {
		return Order{}, err
	}
	now := time.Now().UTC().Format(time.RFC3339)
	res, err = tx.ExecContext(ctx, `
		INSERT INTO orders(user_id, product_id, qty, total_vnd, idempotency_key, request_hash, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		userID, productID, qty, int64(total), idemKey, hash, now)
	if err != nil {
		return Order{}, err
	}
	orderID, err := res.LastInsertId()
	if err != nil {
		return Order{}, err
	}
	payload, err := json.Marshal(map[string]any{
		"order_id":   orderID,
		"user_id":    userID,
		"product_id": productID,
		"qty":        qty,
		"total_vnd":  int64(total),
	})
	if err != nil {
		return Order{}, err
	}
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO outbox(order_id, kind, payload, created_at) VALUES (?, 'order.created', ?, ?)`,
		orderID, string(payload), now); err != nil {
		return Order{}, err
	}
	if err := tx.Commit(); err != nil {
		return Order{}, err
	}
	return Order{
		ID: orderID, UserID: userID, ProductID: productID, Qty: qty, TotalVND: total, Created: true,
	}, nil
}

// OutboxByOrder đọc sự kiện của một đơn.
func (s *Store) OutboxByOrder(ctx context.Context, orderID int64) ([]OutboxEvent, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, order_id, kind, payload FROM outbox WHERE order_id = ? ORDER BY id`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []OutboxEvent
	for rows.Next() {
		var e OutboxEvent
		if err := rows.Scan(&e.ID, &e.OrderID, &e.Kind, &e.Payload); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// ProductStock đọc tồn kho.
func (s *Store) ProductStock(ctx context.Context, id int64) (int64, error) {
	var stock int64
	err := s.db.QueryRowContext(ctx, `SELECT stock FROM products WHERE id = ?`, id).Scan(&stock)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, ErrNotFound
	}
	return stock, err
}

type keyed struct {
	order Order
	hash  string
}

func orderByKey(ctx context.Context, tx *sql.Tx, userID int64, key string) (keyed, error) {
	var k keyed
	err := tx.QueryRowContext(ctx, `
		SELECT id, user_id, product_id, qty, total_vnd, request_hash
		FROM orders WHERE user_id = ? AND idempotency_key = ?`, userID, key).
		Scan(&k.order.ID, &k.order.UserID, &k.order.ProductID, &k.order.Qty, &k.order.TotalVND, &k.hash)
	if errors.Is(err, sql.ErrNoRows) {
		return keyed{}, ErrNotFound
	}
	return k, err
}

func requestHash(productID, qty int64) string {
	sum := sha256.Sum256([]byte(fmt.Sprintf("%d:%d", productID, qty)))
	return hex.EncodeToString(sum[:])
}
