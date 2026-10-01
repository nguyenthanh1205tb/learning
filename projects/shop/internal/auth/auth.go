// Package auth băm mật khẩu và ký token phiên làm việc.
package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

var (
	ErrPassword = errors.New("auth: mật khẩu phải dài 8-72 byte")
	ErrToken    = errors.New("auth: token không hợp lệ")
)

// HashPassword băm mật khẩu. cost dùng bcrypt.MinCost trong test, bcrypt.DefaultCost khi chạy thật.
func HashPassword(password string, cost int) (string, error) {
	if len(password) < 8 || len(password) > 72 {
		return "", ErrPassword
	}
	sum, err := bcrypt.GenerateFromPassword([]byte(password), cost)
	if err != nil {
		return "", err
	}
	return string(sum), nil
}

// CheckPassword so khớp mật khẩu với hash.
func CheckPassword(hash, password string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
}

// Issue ký token "userID.expiry.mac". Hết hạn sau ttl.
func Issue(secret []byte, userID int64, now time.Time, ttl time.Duration) (string, error) {
	if len(secret) < 16 {
		return "", errors.New("auth: secret quá ngắn")
	}
	exp := now.Add(ttl).Unix()
	payload := fmt.Sprintf("%d.%d", userID, exp)
	mac := sign(secret, payload)
	return payload + "." + mac, nil
}

// Parse kiểm tra chữ ký và hạn dùng. now là thời điểm kiểm tra.
func Parse(secret []byte, token string, now time.Time) (int64, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return 0, ErrToken
	}
	payload := parts[0] + "." + parts[1]
	if !hmac.Equal([]byte(sign(secret, payload)), []byte(parts[2])) {
		return 0, ErrToken
	}
	exp, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil || now.Unix() >= exp {
		return 0, ErrToken
	}
	id, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil || id <= 0 {
		return 0, ErrToken
	}
	return id, nil
}

func sign(secret []byte, payload string) string {
	m := hmac.New(sha256.New, secret)
	m.Write([]byte(payload))
	return base64.RawURLEncoding.EncodeToString(m.Sum(nil))
}
