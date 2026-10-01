// Package httpserver là API HTTP của shop: đăng ký, đăng nhập, xem hàng, đặt đơn.
package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"sync/atomic"
	"time"

	"github.com/nguyenthanh1205tb/learning/projects/shop/internal/auth"
	"github.com/nguyenthanh1205tb/learning/projects/shop/internal/cache"
	"github.com/nguyenthanh1205tb/learning/projects/shop/internal/store"
)

const productCacheKey = "products:v1"

// Server phục vụ HTTP.
type Server struct {
	store      *store.Store
	cache      cache.Cache
	secret     []byte
	bcryptCost int
	mux        *http.ServeMux
	requests   atomic.Int64
	orders     atomic.Int64
}

// New tạo server. secret dài ít nhất 16 byte.
func New(st *store.Store, c cache.Cache, secret []byte, bcryptCost int) *Server {
	s := &Server{store: st, cache: c, secret: secret, bcryptCost: bcryptCost, mux: http.NewServeMux()}
	s.mux.HandleFunc("GET /healthz", s.health)
	s.mux.HandleFunc("GET /readyz", s.ready)
	s.mux.HandleFunc("GET /metrics", s.metrics)
	s.mux.HandleFunc("POST /v1/register", s.register)
	s.mux.HandleFunc("POST /v1/login", s.login)
	s.mux.HandleFunc("GET /v1/products", s.authed(s.products))
	s.mux.HandleFunc("POST /v1/orders", s.authed(s.ordersHandler))
	return s
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.requests.Add(1)
	s.mux.ServeHTTP(w, r)
}

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) ready(w http.ResponseWriter, r *http.Request) {
	if err := s.store.Ping(r.Context()); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "db"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) metrics(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; version=0.0.4")
	body := "shop_http_requests_total " + itoa(s.requests.Load()) + "\n" +
		"shop_orders_created_total " + itoa(s.orders.Load()) + "\n"
	_, _ = io.WriteString(w, body)
}

func (s *Server) register(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "json"})
		return
	}
	hash, err := auth.HashPassword(body.Password, s.bcryptCost)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "password"})
		return
	}
	user, err := s.store.CreateUser(r.Context(), body.Email, hash)
	if errors.Is(err, store.ErrEmailTaken) {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "email"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "email"})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"id": user.ID, "email": user.Email})
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "json"})
		return
	}
	user, err := s.store.UserByEmail(r.Context(), body.Email)
	if err != nil || auth.CheckPassword(user.PasswordHash, body.Password) != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "login"})
		return
	}
	tok, err := auth.Issue(s.secret, user.ID, time.Now(), 24*time.Hour)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "token"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"token": tok})
}

func (s *Server) products(w http.ResponseWriter, r *http.Request) {
	if raw, ok, err := s.cache.Get(r.Context(), productCacheKey); err == nil && ok {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Cache", "HIT")
		_, _ = io.WriteString(w, raw)
		return
	}
	list, err := s.store.ListProducts(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "store"})
		return
	}
	if list == nil {
		list = []store.Product{}
	}
	raw, err := json.Marshal(list)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "json"})
		return
	}
	_ = s.cache.Set(r.Context(), productCacheKey, string(raw), 30*time.Second)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Cache", "MISS")
	_, _ = w.Write(raw)
}

func (s *Server) ordersHandler(w http.ResponseWriter, r *http.Request) {
	key := r.Header.Get("Idempotency-Key")
	var body struct {
		ProductID int64 `json:"product_id"`
		Qty       int64 `json:"qty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "json"})
		return
	}
	userID, _ := r.Context().Value(userKey{}).(int64)
	order, err := s.store.PlaceOrder(r.Context(), userID, body.ProductID, body.Qty, key)
	switch {
	case errors.Is(err, store.ErrBadInput):
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "input"})
	case errors.Is(err, store.ErrNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "product"})
	case errors.Is(err, store.ErrStock):
		writeJSON(w, http.StatusConflict, map[string]string{"error": "stock"})
	case errors.Is(err, store.ErrIdempotency):
		writeJSON(w, http.StatusConflict, map[string]string{"error": "idempotency"})
	case err != nil:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "store"})
	default:
		if order.Created {
			s.orders.Add(1)
			_ = s.cache.Delete(r.Context(), productCacheKey)
			writeJSON(w, http.StatusCreated, order)
			return
		}
		writeJSON(w, http.StatusOK, order)
	}
}

type userKey struct{}

func (s *Server) authed(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		h := r.Header.Get("Authorization")
		token, ok := strings.CutPrefix(h, "Bearer ")
		if !ok {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "auth"})
			return
		}
		id, err := auth.Parse(s.secret, token, time.Now())
		if err != nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "auth"})
			return
		}
		ctx := context.WithValue(r.Context(), userKey{}, id)
		next(w, r.WithContext(ctx))
	}
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func itoa(n int64) string {
	if n == 0 {
		return "0"
	}
	var b [20]byte
	i := len(b)
	neg := n < 0
	if neg {
		n = -n
	}
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		b[i] = '-'
	}
	return string(b[i:])
}
