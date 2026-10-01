package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/nguyenthanh1205tb/learning/projects/shop/internal/cache"
	"github.com/nguyenthanh1205tb/learning/projects/shop/internal/store"
	"golang.org/x/crypto/bcrypt"
)

func newTestServer(t *testing.T) *Server {
	t.Helper()
	dsn := "file:" + filepath.Join(t.TempDir(), "shop.db")
	st, err := store.Open(dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	if _, err := st.CreateProduct(context.Background(), "tai-nghe", "Tai nghe", 450_000, 5); err != nil {
		t.Fatal(err)
	}
	return New(st, cache.NewMemory(), []byte("sixteen-byte-key"), bcrypt.MinCost)
}

func TestRegisterLoginOrderOnce(t *testing.T) {
	srv := newTestServer(t)
	reg := do(t, srv, http.MethodPost, "/v1/register", "", map[string]string{
		"email": "an@shop.vn", "password": "correct-horse",
	})
	if reg.Code != http.StatusCreated {
		t.Fatalf("register %d %s", reg.Code, reg.Body.String())
	}
	login := do(t, srv, http.MethodPost, "/v1/login", "", map[string]string{
		"email": "an@shop.vn", "password": "wrong-horse",
	})
	if login.Code != http.StatusUnauthorized {
		t.Fatalf("bad login %d", login.Code)
	}
	login = do(t, srv, http.MethodPost, "/v1/login", "", map[string]string{
		"email": "an@shop.vn", "password": "correct-horse",
	})
	if login.Code != http.StatusOK {
		t.Fatalf("login %d %s", login.Code, login.Body.String())
	}
	var tok struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(login.Body.Bytes(), &tok); err != nil {
		t.Fatal(err)
	}

	miss := do(t, srv, http.MethodGet, "/v1/products", tok.Token, nil)
	if miss.Code != http.StatusOK || miss.Header().Get("X-Cache") != "MISS" {
		t.Fatalf("products miss %d cache=%s", miss.Code, miss.Header().Get("X-Cache"))
	}
	hit := do(t, srv, http.MethodGet, "/v1/products", tok.Token, nil)
	if hit.Header().Get("X-Cache") != "HIT" {
		t.Fatalf("cache %s", hit.Header().Get("X-Cache"))
	}

	body := map[string]any{"product_id": 1, "qty": 1}
	first := doKey(t, srv, tok.Token, "idem-key-01", body)
	if first.Code != http.StatusCreated {
		t.Fatalf("order %d %s", first.Code, first.Body.String())
	}
	replay := doKey(t, srv, tok.Token, "idem-key-01", body)
	if replay.Code != http.StatusOK {
		t.Fatalf("replay %d %s", replay.Code, replay.Body.String())
	}
	var a, b map[string]any
	_ = json.Unmarshal(first.Body.Bytes(), &a)
	_ = json.Unmarshal(replay.Body.Bytes(), &b)
	if a["id"] != b["id"] || a["total_vnd"] != float64(450000) {
		t.Fatalf("orders %v %v", a, b)
	}

	health := do(t, srv, http.MethodGet, "/healthz", "", nil)
	if health.Code != http.StatusOK {
		t.Fatal(health.Code)
	}
	metrics := do(t, srv, http.MethodGet, "/metrics", "", nil)
	if !bytes.Contains(metrics.Body.Bytes(), []byte("shop_orders_created_total 1\n")) {
		t.Fatalf("metrics:\n%s", metrics.Body.String())
	}
}

func do(t *testing.T, srv http.Handler, method, path, token string, body any) *httptest.ResponseRecorder {
	t.Helper()
	return doKey(t, srv, token, "", body, method, path)
}

func doKey(t *testing.T, srv http.Handler, token, idem string, body any, extra ...string) *httptest.ResponseRecorder {
	t.Helper()
	method, path := http.MethodPost, "/v1/orders"
	if len(extra) == 2 {
		method, path = extra[0], extra[1]
	}
	var rdr io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		rdr = bytes.NewReader(raw)
	}
	req := httptest.NewRequest(method, path, rdr)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	if idem != "" {
		req.Header.Set("Idempotency-Key", idem)
	}
	rr := httptest.NewRecorder()
	srv.ServeHTTP(rr, req)
	return rr
}
