package auth

import (
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"
)

func TestPasswordRoundTrip(t *testing.T) {
	hash, err := HashPassword("correct-horse", bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	if err := CheckPassword(hash, "correct-horse"); err != nil {
		t.Fatal(err)
	}
	if err := CheckPassword(hash, "wrong-horse"); err == nil {
		t.Fatal("mật khẩu sai vẫn khớp")
	}
	if _, err := HashPassword("short", bcrypt.MinCost); err != ErrPassword {
		t.Fatalf("password ngắn: %v", err)
	}
}

func TestTokenExpiryAndTamper(t *testing.T) {
	secret := []byte("sixteen-byte-key")
	now := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	tok, err := Issue(secret, 7, now, time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	id, err := Parse(secret, tok, now.Add(30*time.Minute))
	if err != nil || id != 7 {
		t.Fatalf("id=%d err=%v", id, err)
	}
	if _, err := Parse(secret, tok, now.Add(2*time.Hour)); err != ErrToken {
		t.Fatalf("hết hạn: %v", err)
	}
	if _, err := Parse(secret, tok+"x", now); err != ErrToken {
		t.Fatalf("sửa token: %v", err)
	}
}
