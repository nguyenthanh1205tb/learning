package money

import "testing"

func TestLineAndVAT(t *testing.T) {
	line, err := Line(199_000, 2)
	if err != nil || line != 398_000 {
		t.Fatalf("line = %d, %v", line, err)
	}
	gross, err := Gross(199_000, 10)
	if err != nil || gross != 218_900 {
		t.Fatalf("gross = %d, %v", gross, err)
	}
}

func TestRejectsFloatStyleDrift(t *testing.T) {
	// Hằng số chưa gán kiểu trong Go được tính chính xác. Phải ép float64
	// thì mới thấy 0.1 + 0.2 không bằng 0.3.
	var a, b float64 = 0.1, 0.2
	if a+b == 0.3 {
		t.Fatal("float64 cộng đúng bằng nhau, bài học cần ví dụ khác")
	}
	got, err := Add(10, 20)
	if err != nil || got != 30 {
		t.Fatalf("Add = %d, %v", got, err)
	}
}

func TestOverflowAndRange(t *testing.T) {
	if _, err := Line(1, 0); err != ErrRange {
		t.Fatalf("qty 0: %v", err)
	}
	if _, err := Line(VND(1<<62), 4); err != ErrOverflow {
		t.Fatalf("overflow: %v", err)
	}
	if _, err := VAT(100, 101); err != ErrPercent {
		t.Fatalf("percent: %v", err)
	}
}
