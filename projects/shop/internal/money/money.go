// Package money tính tiền bằng số nguyên. VND không có đơn vị nhỏ hơn đồng
// đang lưu hành, nên 1 đơn vị = 1 đồng. Không dùng float64 cho tiền.
package money

import (
	"errors"
	"math"
)

// VND là số tiền tính bằng đồng.
type VND int64

var (
	ErrOverflow = errors.New("money: tràn số")
	ErrRange    = errors.New("money: số lượng hoặc đơn giá không hợp lệ")
	ErrPercent  = errors.New("money: phần trăm không hợp lệ")
)

// Line tính thành tiền = đơn giá × số lượng.
func Line(unit VND, qty int64) (VND, error) {
	if unit < 0 || qty <= 0 {
		return 0, ErrRange
	}
	if int64(unit) > math.MaxInt64/qty {
		return 0, ErrOverflow
	}
	return unit * VND(qty), nil
}

// Add cộng hai số tiền.
func Add(a, b VND) (VND, error) {
	if b > 0 && a > math.MaxInt64-b {
		return 0, ErrOverflow
	}
	if b < 0 && a < math.MinInt64-b {
		return 0, ErrOverflow
	}
	return a + b, nil
}

// VAT tính tiền thuế bằng số nguyên: net × percent / 100, phần dư bỏ (làm tròn xuống).
// percent nằm trong [0, 100].
func VAT(net VND, percent int64) (VND, error) {
	if net < 0 {
		return 0, ErrRange
	}
	if percent < 0 || percent > 100 {
		return 0, ErrPercent
	}
	if percent == 0 || net == 0 {
		return 0, nil
	}
	if int64(net) > math.MaxInt64/percent {
		return 0, ErrOverflow
	}
	return VND(int64(net) * percent / 100), nil
}

// Gross = net + VAT.
func Gross(net VND, percent int64) (VND, error) {
	tax, err := VAT(net, percent)
	if err != nil {
		return 0, err
	}
	return Add(net, tax)
}
