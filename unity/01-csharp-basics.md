# 📚 Bài 1: C# Cơ bản và Nâng cao cho Unity

## 🎯 Mục tiêu bài học

- Hiểu các kiểu dữ liệu cơ bản trong C#
- Học cách sử dụng biến, hàm và properties
- Nắm vững cấu trúc điều khiển (if/else, loops)
- Hiểu class, object và OOP
- Thành thạo access modifiers và assembly
- Sử dụng static, properties, events và delegates
- Hiểu virtual, abstract và interfaces
- Biết cách sử dụng generics cơ bản

> 💡 **Lưu ý trước khi đọc**: Các ví dụ trong bài này đã dùng một số thứ của Unity như `MonoBehaviour`, `Start()`, `Update()`, `Debug.Log`, `Vector3`, `transform`, `GetComponent`, `Input.GetKeyDown`. Bạn chỉ cần tạm hiểu:
>
> - `MonoBehaviour` = class gốc của mọi script gắn lên GameObject (học ở **Bài 2**)
> - `Start()` chạy 1 lần khi bắt đầu, `Update()` chạy mỗi frame (học chi tiết ở **Bài 4**)
> - `Debug.Log(...)` = in ra cửa sổ **Console** của Unity
> - `Input.GetKeyDown(...)` = kiểm tra phím vừa được nhấn (học ở **Bài 4**)
>
> Mỗi file script Unity cần `using UnityEngine;` ở đầu file (các ví dụ lược bỏ cho gọn). Khi dùng `List`/`Dictionary` cần thêm `using System.Collections.Generic;`, khi dùng `Action` cần `using System;`.
> Mỗi class kế thừa `MonoBehaviour` phải nằm trong **file riêng có tên trùng tên class** (vd: `PlayerController.cs`). Các ví dụ gộp nhiều class trong một khối code chỉ để dễ đọc, và nhiều ví dụ dùng lại tên như `Player`, `Enemy`, `GameManager` - đừng copy tất cả vào cùng một project.

## 📖 1. Kiểu dữ liệu cơ bản

### Các kiểu dữ liệu hay dùng trong Unity

```csharp
// Số nguyên
int playerHealth = 100;        // Số nguyên từ -2 tỷ đến 2 tỷ
long largeNumber = 1000000000L; // Số nguyên rất lớn
float playerSpeed = 5.5f;      // Số thập phân (phải có 'f' cuối)
double preciseValue = 3.14159; // Số thập phân chính xác cao

// Chuỗi và ký tự
string playerName = "Hero";    // Chuỗi ký tự
char grade = 'A';              // Một ký tự duy nhất

// Logic
bool isAlive = true;           // true hoặc false
bool isMoving = false;

// Unity specific
Vector3 position = new Vector3(1, 2, 3);  // Vị trí 3D
Vector2 velocity = new Vector2(5, 0);      // Vận tốc 2D
```

### 💡 Tips quan trọng

- **float** luôn cần có `f` cuối: `5.5f` ✅, `5.5` ❌
- **string** dùng dấu ngoặc kép: `"Hello"` ✅, `'Hello'` ❌
- **char** dùng dấu ngoặc đơn: `'A'` ✅, `"A"` ❌
- **int** cho số nguyên, **float** cho số thập phân trong game

## 🔧 2. Biến và Hằng số

### Khai báo biến

```csharp
public class PlayerController : MonoBehaviour
{
    // Biến public - hiển thị trong Inspector
    public float moveSpeed = 5f;
    public string playerName = "Player";

    // Biến private - chỉ dùng trong class này
    private int health = 100;
    private bool isGrounded = true;

    // Biến readonly - không thể thay đổi sau khi khởi tạo
    private readonly float jumpForce = 10f;

    // Hằng số - không bao giờ thay đổi, phải biết giá trị khi compile
    private const int MAX_HEALTH = 100;
    private const string PLAYER_TAG = "Player";
}
```

### 🔍 SerializeField - Hiển thị biến private trong Inspector

```csharp
public class AdvancedVariables : MonoBehaviour
{
    // SerializeField - hiển thị private trong Inspector
    [SerializeField] private float rotationSpeed = 90f;

    // Không hiển thị trong Inspector
    private float hiddenValue = 5f;

    // Tooltip giúp giải thích biến
    [SerializeField, Tooltip("Tốc độ di chuyển của player (m/s)")]
    private float speed = 5f;

    // Range giới hạn giá trị
    [SerializeField, Range(0f, 100f)]
    private float volume = 50f;
}
```

## 🎮 3. Toán tử và Phép tính

### Toán tử số học

```csharp
int a = 10;
int b = 3;

int sum = a + b;        // 13 - Cộng
int difference = a - b; // 7 - Trừ
int product = a * b;    // 30 - Nhân
int quotient = a / b;   // 3 - Chia nguyên
int remainder = a % b;  // 1 - Chia lấy dư (modulo)

// Toán tử gán
a += 5;  // Tương đương a = a + 5
a -= 2;  // Tương đương a = a - 2
a *= 3;  // Tương đương a = a * 3
a /= 2;  // Tương đương a = a / 2

// Increment và Decrement
int count = 0;
count++;  // count = 1 (tăng sau)
++count;  // count = 2 (tăng trước)
count--;  // count = 1 (giảm sau)
--count;  // count = 0 (giảm trước)
```

### Toán tử so sánh

```csharp
int health = 50;
int maxHealth = 100;

bool isFullHealth = (health == maxHealth);    // false - Bằng
bool isAlive = (health > 0);                  // true - Lớn hơn
bool isLowHealth = (health <= 25);            // false - Nhỏ hơn hoặc bằng
bool isNotDead = (health != 0);               // true - Không bằng
```

### Toán tử logic

```csharp
bool hasKey = true;
bool hasDoor = true;
bool isNight = false;

bool canEnter = hasKey && hasDoor;        // true - AND (cả hai phải true)
bool canSee = hasKey || isNight;          // true - OR (một trong hai true)
bool isDay = !isNight;                    // true - NOT (phủ định)

// Short-circuit evaluation
bool result = (health > 0) && (player != null); // Nếu health <= 0, không kiểm tra player
```

## 🎯 4. Cấu trúc điều khiển

### If/Else - Điều kiện

```csharp
public class HealthSystem : MonoBehaviour
{
    public int health = 100;

    void Update()
    {
        if (health > 75)
        {
            Debug.Log("Sức khỏe tốt!");
        }
        else if (health > 25)
        {
            Debug.Log("Sức khỏe trung bình");
        }
        else if (health > 0)
        {
            Debug.Log("Sức khỏe thấp!");
        }
        else
        {
            Debug.Log("Đã chết!");
        }
    }
}
```

### Switch - Nhiều điều kiện

```csharp
public class WeaponSystem : MonoBehaviour
{
    public int weaponType = 1;

    void Start()
    {
        switch (weaponType)
        {
            case 1:
                Debug.Log("Sử dụng kiếm");
                break;
            case 2:
                Debug.Log("Sử dụng cung");
                break;
            case 3:
                Debug.Log("Sử dụng phép thuật");
                break;
            default:
                Debug.Log("Không có vũ khí");
                break;
        }
    }
}
```

### Vòng lặp

```csharp
public class Spawner : MonoBehaviour
{
    public int enemyCount = 5;

    void Start()
    {
        // For loop - biết trước số lần lặp
        for (int i = 0; i < enemyCount; i++)
        {
            Debug.Log($"Tạo enemy số {i + 1}");
        }

        // While loop - lặp khi điều kiện còn true
        int attempts = 0;
        while (attempts < 3)
        {
            Debug.Log($"Thử lại lần {attempts + 1}");
            attempts++;
        }

        // Do-While loop - chạy ít nhất 1 lần
        int count = 0;
        do
        {
            Debug.Log($"Đếm: {count}");
            count++;
        } while (count < 3);

        // Foreach loop - lặp qua từng phần tử trong collection
        string[] weapons = {"Kiếm", "Cung", "Phép thuật"};
        foreach (string weapon in weapons)
        {
            Debug.Log($"Có vũ khí: {weapon}");
        }
    }
}
```

### Mảng (Array) và List

```csharp
using System.Collections.Generic; // Cần cho List và Dictionary

public class CollectionExample : MonoBehaviour
{
    void Start()
    {
        // Mảng - số phần tử CỐ ĐỊNH khi tạo
        int[] scores = new int[3];      // [0, 0, 0]
        scores[0] = 10;                 // Chỉ số (index) bắt đầu từ 0
        Debug.Log(scores.Length);       // 3

        // List - số phần tử THAY ĐỔI được (hay dùng nhất trong game)
        List<string> items = new List<string>();
        items.Add("Kiếm");
        items.Add("Khiên");
        items.Remove("Kiếm");
        Debug.Log(items.Count);         // 1

        // Dictionary - lưu cặp key → value
        Dictionary<string, int> ammo = new Dictionary<string, int>();
        ammo["Pistol"] = 12;
        Debug.Log(ammo["Pistol"]);      // 12
    }
}
```

> 💡 `List<string>` có dấu `<>` là **Generics** - sẽ giải thích ở phần 13. Tạm hiểu: `List<T>` là danh sách chứa các phần tử kiểu `T`.

## 🔧 5. Hàm (Methods)

### Hàm cơ bản

```csharp
public class Calculator : MonoBehaviour
{
    void Start()
    {
        int result = Add(5, 3);
        Debug.Log($"Kết quả: {result}");

        SayHello("Unity");
        SayHello(); // Sử dụng giá trị mặc định
    }

    // Hàm có giá trị trả về
    int Add(int a, int b)
    {
        return a + b;
    }

    // Hàm không có giá trị trả về (void)
    void SayHello(string name = "Player")
    {
        Debug.Log($"Xin chào {name}!");
    }

    // Hàm với nhiều tham số
    void MovePlayer(float x, float y, float speed = 5f)
    {
        Vector3 newPosition = new Vector3(x, y, 0) * speed;
        transform.position = newPosition;
    }
}
```

### Hàm với tham số tùy chọn

```csharp
void SpawnEnemy(Vector3 position, int health = 100, float speed = 5f)
{
    // Tạo enemy với các tham số
    Debug.Log($"Spawn enemy tại {position}, máu: {health}, tốc độ: {speed}");
}

// Cách gọi hàm
SpawnEnemy(new Vector3(0, 0, 0));                    // Dùng giá trị mặc định
SpawnEnemy(new Vector3(5, 0, 0), 150);               // Chỉ thay đổi health
SpawnEnemy(new Vector3(10, 0, 0), 200, 8f);          // Thay đổi tất cả
```

## 🏗️ 6. Class và Object

### Tạo class đơn giản

```csharp
// Class định nghĩa một loại object (blueprint)
public class Enemy
{
    // Thuộc tính (Fields)
    public string name;
    public int health;
    public float speed;

    // Constructor - hàm khởi tạo
    public Enemy(string enemyName, int enemyHealth, float enemySpeed)
    {
        name = enemyName;
        health = enemyHealth;
        speed = enemySpeed;
    }

    // Phương thức (Methods)
    public void TakeDamage(int damage)
    {
        health -= damage;
        Debug.Log($"{name} nhận {damage} sát thương. Máu còn: {health}");
    }

    public bool IsAlive()
    {
        return health > 0;
    }
}
```

### Sử dụng class

```csharp
public class GameManager : MonoBehaviour
{
    void Start()
    {
        // Tạo object từ class (instantiation)
        Enemy goblin = new Enemy("Goblin", 50, 3f);
        Enemy orc = new Enemy("Orc", 100, 2f);

        // Sử dụng object
        goblin.TakeDamage(20);
        orc.TakeDamage(30);

        // Kiểm tra trạng thái
        if (goblin.IsAlive())
        {
            Debug.Log("Goblin vẫn còn sống!");
        }
    }
}
```

## 🔒 7. Access Modifiers và Assembly

### Access Modifiers là gì?

**Access modifiers** kiểm soát **ai có thể truy cập** vào class, method, hoặc biến của bạn.

### Assembly là gì?

**Assembly** là một file **DLL hoặc EXE** được compile từ code C#. Trong Unity:

- Mặc định, **tất cả** script trong Assets/ được compile chung vào `Assembly-CSharp.dll`
- Một folder chỉ trở thành assembly riêng khi bạn tạo file **Assembly Definition** (`.asmdef`) trong folder đó
- Các script trong cùng assembly có thể truy cập lẫn nhau qua `internal`
- Các script ở assembly khác KHÔNG thể truy cập `internal`

```
Unity Project
├── Assembly-CSharp.dll (default assembly - code trong Assets/)
├── Assembly-CSharp-Editor.dll (code trong Editor/)
└── CustomAssembly.dll (nếu bạn tạo Assembly Definition)
```

### Các mức độ truy cập chi tiết

```csharp
public class AccessExample : MonoBehaviour
{
    // ✅ PUBLIC - Ai cũng có thể truy cập từ mọi nơi
    // Dùng khi: Muốn public API, cho phép các class khác sử dụng
    public int publicValue = 10;

    // ✅ PRIVATE - Chỉ class này mới truy cập được
    // Dùng khi: Internal implementation, không muốn class khác can thiệp
    private int privateValue = 20;

    // ✅ PROTECTED - Class này và class con (kế thừa) có thể truy cập
    // Dùng khi: Muốn class con override hoặc sử dụng
    protected int protectedValue = 30;

    // ✅ INTERNAL - Chỉ trong cùng assembly (DLL) mới truy cập được
    // Dùng khi: Muốn chia sẻ trong cùng module nhưng không public ra ngoài
    internal int internalValue = 40;

    // ✅ PROTECTED INTERNAL - Protected HOẶC Internal
    // Dùng khi: Class con ở assembly khác cũng có thể truy cập
    protected internal int protectedInternalValue = 50;

    void Start()
    {
        // Có thể truy cập tất cả trong cùng class
        Debug.Log(publicValue);           // OK
        Debug.Log(privateValue);          // OK
        Debug.Log(protectedValue);        // OK
        Debug.Log(internalValue);         // OK
        Debug.Log(protectedInternalValue); // OK
    }
}

// ❌ Class ở assembly KHÁC
public class AnotherAssemblyClass
{
    void Use(AccessExample example) // Nhận tham chiếu từ bên ngoài
    {

        Debug.Log(example.publicValue);    // ✅ OK - public
        // Debug.Log(example.privateValue); // ❌ ERROR - private
        // Debug.Log(example.protectedValue); // ❌ ERROR - protected
        // Debug.Log(example.internalValue);  // ❌ ERROR - internal
    }
}

// ✅ Class ở assembly GIỐNG
public class SameAssemblyClass : MonoBehaviour
{
    void Start()
    {
        // Lưu ý: KHÔNG tạo MonoBehaviour bằng `new` - dùng GetComponent (xem Bài 2)
        AccessExample example = GetComponent<AccessExample>();

        Debug.Log(example.publicValue);    // ✅ OK - public
        // Debug.Log(example.privateValue); // ❌ ERROR - private
        // Debug.Log(example.protectedValue); // ❌ ERROR - protected
        Debug.Log(example.internalValue);  // ✅ OK - internal (cùng assembly)
    }
}
```

### Ví dụ thực tế: Internal trong Unity

```csharp
// Giả sử folder Scripts/Core/ có file Core.asmdef (Assembly Definition riêng)
// File: Scripts/Core/GameManager.cs
public class GameManager : MonoBehaviour
{
    // Internal - chỉ các script trong assembly Core có thể truy cập
    internal int gameScore = 0;

    internal void AddScore(int points)
    {
        gameScore += points;
    }
}

// File: Scripts/Core/ScoreDisplay.cs (cùng assembly)
public class ScoreDisplay : MonoBehaviour
{
    void Start()
    {
        GameManager gm = FindFirstObjectByType<GameManager>();
        Debug.Log(gm.gameScore); // ✅ OK - cùng assembly
    }
}

// File: Scripts/ThirdParty/ExternalPlugin.cs (assembly khác, có tham chiếu tới Core.asmdef)
public class ExternalPlugin
{
    void UseGameManager()
    {
        // Class không kế thừa MonoBehaviour nên phải gọi qua Object.
        GameManager gm = Object.FindFirstObjectByType<GameManager>();
        // Debug.Log(gm.gameScore); // ❌ ERROR - khác assembly
    }
}
```

## ⚡ 8. Static - Thuộc về Class, không phải Object

### Static là gì?

**Static** nghĩa là thuộc về **CLASS**, không phải từng object riêng lẻ.

- **Static variable**: Chỉ có 1 bản sao duy nhất cho cả class
- **Static method**: Gọi trực tiếp từ class, không cần tạo object
- **Static class**: Không thể tạo object từ class này

### Khi nào dùng Static?

✅ **Dùng khi**:

- Utility functions (MathHelper, StringHelper)
- Singleton pattern (GameManager, SoundManager)
- Constants và shared data
- Extension methods

❌ **Không dùng khi**:

- Cần tạo nhiều objects riêng biệt
- Cần kế thừa
- Cần interface

### Static Variables và Methods

```csharp
public class Enemy : MonoBehaviour
{
    // ❌ Non-static - Mỗi enemy có health riêng
    public int health = 100;

    // ✅ Static - Tất cả enemies CHIA SẺ cùng 1 giá trị
    public static int totalEnemies = 0;

    void Start()
    {
        totalEnemies++; // Tăng cho tất cả enemies
        Debug.Log($"Tổng số enemies: {totalEnemies}");
    }

    void OnDestroy()
    {
        totalEnemies--; // Giảm khi enemy chết
    }

    // Static method - Gọi trực tiếp từ class
    public static int GetTotalEnemies()
    {
        return totalEnemies;
    }
}

// Sử dụng static
public class GameManager : MonoBehaviour
{
    void Update()
    {
        // Gọi trực tiếp từ class, không cần object
        int count = Enemy.GetTotalEnemies();
        Debug.Log($"Có {count} enemies");

        // Truy cập static variable trực tiếp
        Debug.Log($"Total: {Enemy.totalEnemies}");
    }
}
```

### Static Class

```csharp
// Static class - Không thể tạo object từ class này
public static class MathHelper
{
    // Tất cả members phải là static
    public static float Pi = 3.14159f;

    public static float Square(float x)
    {
        return x * x;
    }

    public static float Distance2D(Vector2 a, Vector2 b)
    {
        float dx = b.x - a.x;
        float dy = b.y - a.y;
        return Mathf.Sqrt(dx * dx + dy * dy);
    }
}

// Sử dụng static class
public class Player : MonoBehaviour
{
    void Start()
    {
        // Gọi trực tiếp, không cần new MathHelper()
        float area = MathHelper.Square(5f); // 25

        Vector2 pos1 = new Vector2(0, 0);
        Vector2 pos2 = new Vector2(3, 4);
        float dist = MathHelper.Distance2D(pos1, pos2); // 5
    }
}
```

### Static Constructor

```csharp
public class GameSettings
{
    public static string GameName;
    public static int MaxPlayers;

    // Static constructor - Gọi TỰ ĐỘNG khi class được dùng lần đầu
    static GameSettings()
    {
        Debug.Log("GameSettings được khởi tạo!");
        GameName = "My Awesome Game";
        MaxPlayers = 4;
    }
}

public class Startup : MonoBehaviour
{
    void Start()
    {
        // Static constructor được gọi tự động
        Debug.Log(GameSettings.GameName); // "My Awesome Game"
    }
}
```

### Ví dụ thực tế: Singleton Pattern

> Đây là ví dụ xem trước - `Awake()`, `DontDestroyOnLoad` và Singleton sẽ được giải thích kỹ ở **Bài 2 (phần 7)** và **Bài 4 (Lifecycle)**.

```csharp
public class GameManager : MonoBehaviour
{
    // Static instance - Chỉ 1 GameManager duy nhất
    public static GameManager Instance { get; private set; }

    // Non-static data
    public int score = 0;
    public int lives = 3;

    void Awake()
    {
        // Singleton pattern
        if (Instance == null)
        {
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }
        else
        {
            Destroy(gameObject);
        }
    }

    public void AddScore(int points)
    {
        score += points;
    }
}

// Sử dụng Singleton
public class Enemy : MonoBehaviour
{
    void OnDestroy()
    {
        // Truy cập Singleton từ bất kỳ đâu
        GameManager.Instance.AddScore(100);
    }
}
```

## 🎁 9. Properties - Get và Set thông minh

### Properties là gì?

**Properties** là cách **an toàn** để truy cập private fields. Nó giống như functions nhưng dùng như variables.

### Tại sao cần Properties?

```csharp
// ❌ BAD - Direct access, không kiểm soát được
public class BadPlayer
{
    public int health = 100;
}

// Ai cũng có thể làm:
player.health = -50; // WTF? Health âm?
player.health = 999999; // God mode?

// ✅ GOOD - Properties kiểm soát access
public class GoodPlayer
{
    private int health = 100;

    public int Health
    {
        get { return health; }
        set
        {
            // Validation logic
            if (value < 0) health = 0;
            else if (value > 100) health = 100;
            else health = value;
        }
    }
}

// Sử dụng
player.Health = -50;    // health = 0 (validated)
player.Health = 999999; // health = 100 (capped)
```

### Auto-Properties

```csharp
public class PlayerData
{
    // Auto-property - Compiler tự tạo private field
    public string PlayerName { get; set; } = "Player";

    // Read-only auto-property
    public int MaxHealth { get; } = 100;

    // Property với private setter
    public int CurrentHealth { get; private set; } = 100;

    public void TakeDamage(int damage)
    {
        CurrentHealth -= damage;
        if (CurrentHealth < 0) CurrentHealth = 0;
    }
}
```

### Properties với Logic

```csharp
public class Character : MonoBehaviour
{
    private int health = 100;
    private int maxHealth = 100;

    // Property với validation
    public int Health
    {
        get { return health; }
        set
        {
            health = Mathf.Clamp(value, 0, maxHealth);

            // Side effects
            if (health <= 0)
            {
                Die();
            }

            // Update UI
            UpdateHealthBar();
        }
    }

    // Computed property - Tính toán mỗi lần get
    public float HealthPercent
    {
        get { return (float)health / maxHealth; }
    }

    // Read-only property
    public bool IsAlive
    {
        get { return health > 0; }
    }

    void Die()
    {
        Debug.Log("Player died!");
    }

    void UpdateHealthBar()
    {
        // Update UI logic
    }
}

// Sử dụng
public class Combat : MonoBehaviour
{
    public Character player;

    void Update()
    {
        if (Input.GetKeyDown(KeyCode.Space))
        {
            player.Health -= 10; // Gọi setter, tự động validate
        }

        // Read property
        Debug.Log($"Health: {player.HealthPercent * 100}%");
        Debug.Log($"Is Alive: {player.IsAlive}");
    }
}
```

### Expression-bodied Properties (C# 6.0+)

```csharp
public class ModernPlayer
{
    private int health = 100;
    private int maxHealth = 100;

    // Expression-bodied get-only property
    public float HealthPercent => (float)health / maxHealth;
    public bool IsAlive => health > 0;
    public bool IsDead => !IsAlive;

    // Expression-bodied với get/set
    public int Health
    {
        get => health;
        set => health = Mathf.Clamp(value, 0, maxHealth);
    }
}
```

## 🎯 10. Virtual, Override và Abstract - Polymorphism

### Virtual và Override là gì?

**Virtual** = "Phương thức này có thể bị ghi đè (override) bởi class con"
**Override** = "Tôi muốn thay đổi hành vi của phương thức cha"

### Tại sao cần Virtual/Override?

**Polymorphism** = Một phương thức, nhiều hành vi khác nhau

```csharp
// Ví dụ: Tất cả characters đều có thể Attack(), nhưng mỗi loại attack khác nhau

// ❌ KHÔNG dùng virtual/override - Phải viết logic phức tạp
public class BadCharacter
{
    public string type;

    public void Attack()
    {
        if (type == "Warrior")
        {
            Debug.Log("Slash with sword!");
        }
        else if (type == "Mage")
        {
            Debug.Log("Cast fireball!");
        }
        else if (type == "Archer")
        {
            Debug.Log("Shoot arrow!");
        }
        // Mỗi lần thêm character mới phải sửa class này!
    }
}

// ✅ DÙNG virtual/override - Clean và extensible
public class GoodCharacter
{
    public virtual void Attack()
    {
        Debug.Log("Base attack!");
    }
}

public class Warrior : GoodCharacter
{
    public override void Attack()
    {
        Debug.Log("Slash with sword!");
    }
}

public class Mage : GoodCharacter
{
    public override void Attack()
    {
        Debug.Log("Cast fireball!");
    }
}

// Thêm character mới - Không cần sửa code cũ!
public class Archer : GoodCharacter
{
    public override void Attack()
    {
        Debug.Log("Shoot arrow!");
    }
}
```

### Virtual, Override, và Base

```csharp
public class Character
{
    public string name;
    public int health;
    public float speed;

    public Character(string characterName, int characterHealth, float characterSpeed)
    {
        name = characterName;
        health = characterHealth;
        speed = characterSpeed;
    }

    // Virtual method - Có thể override
    public virtual void Attack()
    {
        Debug.Log($"{name} attacks!");
    }

    // Non-virtual method - Không thể override
    public void TakeDamage(int damage)
    {
        health -= damage;
        Debug.Log($"{name} takes {damage} damage. Health: {health}");
    }
}

public class Warrior : Character
{
    public int swordDamage;

    public Warrior(string name, int health, float speed, int damage)
        : base(name, health, speed) // Gọi constructor của class cha
    {
        swordDamage = damage;
    }

    // Override - Thay đổi hoàn toàn hành vi
    public override void Attack()
    {
        Debug.Log($"{name} slashes with sword! Damage: {swordDamage}");
    }

    // Method riêng của Warrior
    public void ShieldBash()
    {
        Debug.Log($"{name} bashes with shield!");
    }
}

public class Mage : Character
{
    public int mana;

    public Mage(string name, int health, float speed, int manaPoints)
        : base(name, health, speed)
    {
        mana = manaPoints;
    }

    // Override với base call
    public override void Attack()
    {
        // Gọi implementation của class cha
        base.Attack();

        // Thêm logic riêng
        if (mana >= 10)
        {
            Debug.Log($"{name} casts fireball! Mana: {mana}");
            mana -= 10;
        }
        else
        {
            Debug.Log($"{name} is out of mana!");
        }
    }

    public void Heal()
    {
        if (mana >= 20)
        {
            health += 30;
            mana -= 20;
            Debug.Log($"{name} heals!");
        }
    }
}
```

### Polymorphism trong thực tế

```csharp
public class BattleSystem : MonoBehaviour
{
    void Start()
    {
        // Polymorphism - Một array chứa nhiều loại character
        Character[] party = new Character[3];
        party[0] = new Warrior("Knight", 120, 3f, 25);
        party[1] = new Mage("Wizard", 80, 2f, 100);
        party[2] = new Warrior("Berserker", 150, 2.5f, 35);

        // Gọi Attack() - Mỗi character attack theo cách riêng!
        foreach (Character member in party)
        {
            member.Attack(); // Polymorphism in action!
        }

        // Output:
        // "Knight slashes with sword! Damage: 25"
        // "Wizard attacks!"
        // "Wizard casts fireball! Mana: 100"
        // "Berserker slashes with sword! Damage: 35"
    }
}
```

### Abstract Classes - Bắt buộc phải Override

**Abstract class** = Class không thể tạo object trực tiếp, CHỈ để kế thừa
**Abstract method** = Phương thức PHẢI được override bởi class con

```csharp
// Abstract class - Không thể new Character()
public abstract class Character
{
    public string name;
    public int health;

    public Character(string characterName, int characterHealth)
    {
        name = characterName;
        health = characterHealth;
    }

    // Abstract method - Không có implementation, class con PHẢI override
    public abstract void Attack();

    // Virtual method - Có implementation, class con CÓ THỂ override
    public virtual void TakeDamage(int damage)
    {
        health -= damage;
        Debug.Log($"{name} takes {damage} damage");
    }

    // Normal method - Không thể override
    public void Die()
    {
        Debug.Log($"{name} has died!");
    }
}

// Class con PHẢI implement tất cả abstract methods
public class Warrior : Character
{
    public Warrior(string name, int health) : base(name, health) { }

    // PHẢI override abstract method
    public override void Attack()
    {
        Debug.Log($"{name} slashes!");
    }
}

// ❌ ERROR - Không implement abstract method
// public class BadWarrior : Character
// {
//     // ERROR: must implement Attack()
// }
```

### Khi nào dùng Virtual vs Abstract?

```csharp
// ✅ VIRTUAL - Khi có default behavior hợp lý
public class Animal
{
    public virtual void MakeSound()
    {
        Debug.Log("Some generic animal sound");
    }
}

// ✅ ABSTRACT - Khi KHÔNG có default behavior hợp lý
public abstract class Shape
{
    // Mỗi shape tính diện tích khác nhau, không có "default" hợp lý
    public abstract float CalculateArea();
}

public class Circle : Shape
{
    public float radius;

    public override float CalculateArea()
    {
        return Mathf.PI * radius * radius;
    }
}

public class Rectangle : Shape
{
    public float width;
    public float height;

    public override float CalculateArea()
    {
        return width * height;
    }
}
```

## 🔌 11. Interfaces - Hợp đồng (Contract)

### Interface là gì?

**Interface** = Hợp đồng (contract) mà class phải tuân theo

- Chỉ định nghĩa **signature**, không có implementation
- Một class có thể implement nhiều interfaces
- Dùng để define **behaviors** chung

### Tại sao cần Interfaces?

C# không hỗ trợ **multiple inheritance** (kế thừa nhiều class), nhưng có thể implement nhiều interfaces!

```csharp
// ❌ ERROR - Không thể kế thừa nhiều class
// public class Player : Character, Vehicle { } // ERROR!

// ✅ OK - Có thể implement nhiều interfaces
public class Player : Character, IDamageable, IHealable, IInteractable
{
    // Implementation
}
```

### Interface cơ bản

```csharp
// Interface - Convention: Tên bắt đầu bằng "I"
public interface IDamageable
{
    int Health { get; set; }        // Property
    void TakeDamage(int damage);    // Method
    void Die();                     // Method
}

// Class implement interface PHẢI implement tất cả members
public class Player : MonoBehaviour, IDamageable
{
    // Implement property
    public int Health { get; set; } = 100;

    // Implement methods
    public void TakeDamage(int damage)
    {
        Health -= damage;
        Debug.Log($"Player took {damage} damage. Health: {Health}");

        if (Health <= 0)
        {
            Die();
        }
    }

    public void Die()
    {
        Debug.Log("Player died!");
        gameObject.SetActive(false);
    }
}

public class Enemy : MonoBehaviour, IDamageable
{
    public int Health { get; set; } = 50;

    public void TakeDamage(int damage)
    {
        Health -= damage;
        Debug.Log($"Enemy took {damage} damage");

        if (Health <= 0)
        {
            Die();
        }
    }

    public void Die()
    {
        Debug.Log("Enemy died!");
        Destroy(gameObject);
    }
}
```

### Interface trong Unity - Weapon System

```csharp
// Interface cho weapons
public interface IWeapon
{
    string WeaponName { get; }
    int Damage { get; }
    float AttackSpeed { get; }

    void Attack();
    void Reload();
}

// Sword implementation
public class Sword : IWeapon
{
    public string WeaponName => "Iron Sword";
    public int Damage => 25;
    public float AttackSpeed => 1.5f;

    public void Attack()
    {
        Debug.Log($"{WeaponName} slashes! Damage: {Damage}");
    }

    public void Reload()
    {
        // Swords don't reload
        Debug.Log("Swords don't need reloading!");
    }
}

// Bow implementation
public class Bow : IWeapon
{
    public string WeaponName => "Longbow";
    public int Damage => 20;
    public float AttackSpeed => 2f;
    private int arrows = 30;

    public void Attack()
    {
        if (arrows > 0)
        {
            Debug.Log($"{WeaponName} shoots arrow! Damage: {Damage}");
            arrows--;
        }
        else
        {
            Debug.Log("Out of arrows! Reload!");
        }
    }

    public void Reload()
    {
        arrows = 30;
        Debug.Log("Reloaded arrows!");
    }
}

// Player sử dụng interface
public class Player : MonoBehaviour
{
    private IWeapon currentWeapon;

    void Start()
    {
        currentWeapon = new Sword();
    }

    void Update()
    {
        if (Input.GetKeyDown(KeyCode.Mouse0))
        {
            currentWeapon.Attack(); // Polymorphism!
        }

        if (Input.GetKeyDown(KeyCode.R))
        {
            currentWeapon.Reload();
        }

        if (Input.GetKeyDown(KeyCode.Alpha1))
        {
            currentWeapon = new Sword();
        }

        if (Input.GetKeyDown(KeyCode.Alpha2))
        {
            currentWeapon = new Bow();
        }
    }
}
```

### Multiple Interfaces

```csharp
public interface IDamageable
{
    void TakeDamage(int damage);
}

public interface IHealable
{
    void Heal(int amount);
}

public interface IInteractable
{
    void Interact();
}

// Player implement nhiều interfaces
public class Player : MonoBehaviour, IDamageable, IHealable, IInteractable
{
    public int health = 100;

    public void TakeDamage(int damage)
    {
        health -= damage;
        Debug.Log($"Took damage: {damage}");
    }

    public void Heal(int amount)
    {
        health += amount;
        Debug.Log($"Healed: {amount}");
    }

    public void Interact()
    {
        Debug.Log("Player interacted!");
    }
}

// Combat system sử dụng interfaces
public class CombatSystem : MonoBehaviour
{
    public void DealDamage(IDamageable target, int damage)
    {
        target.TakeDamage(damage);
    }

    public void HealTarget(IHealable target, int amount)
    {
        target.Heal(amount);
    }

    public void InteractWith(IInteractable obj)
    {
        obj.Interact();
    }
}
```

### Abstract Class vs Interface - Khi nào dùng cái nào?

```csharp
// ✅ Abstract Class - Khi:
// - Có shared implementation (common code)
// - Class con có chung base functionality
// - Cần constructor
public abstract class Vehicle
{
    public float speed;
    public float fuel;

    // Shared implementation
    public void Refuel()
    {
        fuel = 100f;
    }

    // Abstract - phải override
    public abstract void Move();
}

// ✅ Interface - Khi:
// - Chỉ define contract, không có implementation
// - Muốn multiple inheritance
// - Không liên quan về class hierarchy
public interface IFlyable
{
    float MaxAltitude { get; }
    void Fly();
    void Land();
}

public interface ISwimmable
{
    float MaxDepth { get; }
    void Swim();
}

// Class có thể implement nhiều interfaces
public class Duck : Animal, IFlyable, ISwimmable
{
    public float MaxAltitude => 100f;
    public float MaxDepth => 5f;

    public void Fly()
    {
        Debug.Log("Duck is flying!");
    }

    public void Land()
    {
        Debug.Log("Duck landed!");
    }

    public void Swim()
    {
        Debug.Log("Duck is swimming!");
    }
}
```

## 📦 12. Namespace - Tổ chức Code

### Namespace là gì?

**Namespace** = "Folder" cho code, tránh xung đột tên

```csharp
// Trong game có nhiều "Player" khác nhau
namespace MyGame.Characters
{
    public class Player
    {
        // Game player
    }
}

namespace MyGame.Audio
{
    public class Player
    {
        // Audio player
    }
}

// Sử dụng - Không bị xung đột
MyGame.Characters.Player gamePlayer = new MyGame.Characters.Player();
MyGame.Audio.Player audioPlayer = new MyGame.Audio.Player();
```

### Using Statements

```csharp
// Using - Import namespace để không cần viết tên đầy đủ
using UnityEngine;
using System.Collections.Generic;
using MyGame.Characters;

public class GameManager : MonoBehaviour
{
    void Start()
    {
        // Không cần MyGame.Characters.Player
        Player player = new Player();

        // Không cần System.Collections.Generic.List
        List<Enemy> enemies = new List<Enemy>();
    }
}
```

### Using Alias

```csharp
// Using alias - Đặt tên ngắn cho namespace dài
using PlayerChar = MyGame.Characters.Player;
using AudioPlayer = MyGame.Audio.Player;

public class Test : MonoBehaviour
{
    void Start()
    {
        PlayerChar player = new PlayerChar();
        AudioPlayer audio = new AudioPlayer();
    }
}
```

### Namespace Best Practices

```csharp
// ✅ GOOD - Tổ chức rõ ràng
namespace MyGame.Combat
{
    public class Weapon { }
    public class Damage { }
}

namespace MyGame.UI
{
    public class HealthBar { }
    public class MainMenu { }
}

namespace MyGame.AI
{
    public class EnemyAI { }
    public class Pathfinding { }
}

// ❌ BAD - Không có namespace, dễ xung đột
public class Weapon { }
public class Damage { }
public class HealthBar { }
```

## 🎁 13. Generics - Code tái sử dụng

### Generics là gì?

**Generics** = Code có thể làm việc với **nhiều kiểu dữ liệu** khác nhau

```csharp
// ❌ Không dùng Generics - Phải viết nhiều class
public class IntList
{
    private int[] items;
    public void Add(int item) { }
}

public class StringList
{
    private string[] items;
    public void Add(string item) { }
}

public class EnemyList
{
    private Enemy[] items;
    public void Add(Enemy item) { }
}

// ✅ Dùng Generics - Chỉ cần 1 class!
public class MyList<T>
{
    private T[] items;
    public void Add(T item) { }
}

// Sử dụng
MyList<int> intList = new MyList<int>();
MyList<string> stringList = new MyList<string>();
MyList<Enemy> enemyList = new MyList<Enemy>();
```

### Generic Class

```csharp
using System.Collections.Generic;

// Generic class với type parameter T
public class Inventory<T>
{
    private List<T> items = new List<T>();

    public void AddItem(T item)
    {
        items.Add(item);
        Debug.Log($"Added {item}");
    }

    public void RemoveItem(T item)
    {
        items.Remove(item);
        Debug.Log($"Removed {item}");
    }

    public T GetItem(int index)
    {
        return items[index];
    }

    public int Count => items.Count;
}

// Sử dụng với nhiều kiểu khác nhau
public class InventoryTest : MonoBehaviour
{
    void Start()
    {
        // Inventory cho weapons (IWeapon, Sword, Bow ở phần 11)
        Inventory<IWeapon> weaponInventory = new Inventory<IWeapon>();
        weaponInventory.AddItem(new Sword());
        weaponInventory.AddItem(new Bow());

        // Inventory cho tên vật phẩm (string)
        Inventory<string> itemInventory = new Inventory<string>();
        itemInventory.AddItem("Health Potion");
        itemInventory.AddItem("Mana Potion");
    }
}
```

### Generic Methods

```csharp
public class Utilities
{
    // Generic method
    public static T GetRandom<T>(List<T> list)
    {
        int index = Random.Range(0, list.Count);
        return list[index];
    }

    public static void Swap<T>(ref T a, ref T b)
    {
        T temp = a;
        a = b;
        b = temp;
    }
}

// Sử dụng
public class Test : MonoBehaviour
{
    void Start()
    {
        List<string> names = new List<string> { "Alice", "Bob", "Charlie" };
        string randomName = Utilities.GetRandom(names);

        List<int> numbers = new List<int> { 1, 2, 3, 4, 5 };
        int randomNumber = Utilities.GetRandom(numbers);

        int x = 10;
        int y = 20;
        Utilities.Swap(ref x, ref y); // x = 20, y = 10
    }
}
```

### Generic với Constraints

```csharp
// Constraint - T phải là class (reference type)
public class ObjectPool<T> where T : class, new()
{
    private List<T> pool = new List<T>();

    public T Get()
    {
        if (pool.Count > 0)
        {
            T obj = pool[0];
            pool.RemoveAt(0);
            return obj;
        }

        return new T(); // Cần new() constraint
    }

    public void Return(T obj)
    {
        pool.Add(obj);
    }
}

// Constraint - T phải là MonoBehaviour
public class ComponentPool<T> where T : MonoBehaviour
{
    private List<T> pool = new List<T>();
    public GameObject prefab;

    public T Get()
    {
        if (pool.Count > 0)
        {
            T component = pool[0];
            pool.RemoveAt(0);
            component.gameObject.SetActive(true);
            return component;
        }

        GameObject obj = GameObject.Instantiate(prefab);
        return obj.GetComponent<T>();
    }

    public void Return(T component)
    {
        component.gameObject.SetActive(false);
        pool.Add(component);
    }
}
```

### Unity Generics - FindFirstObjectByType

```csharp
public class GenericFinder : MonoBehaviour
{
    void Start()
    {
        // FindFirstObjectByType là generic method
        // (Unity cũ dùng FindObjectOfType<T>() - đã deprecated từ Unity 2023.1 / Unity 6)
        Player player = FindFirstObjectByType<Player>();
        Enemy enemy = FindFirstObjectByType<Enemy>();
        GameManager gm = FindFirstObjectByType<GameManager>();

        // GetComponent là generic method
        Rigidbody rb = GetComponent<Rigidbody>();
        Collider collider = GetComponent<Collider>();
    }
}
```

## 🎪 14. Events và Delegates - Hệ thống thông báo

### Delegates là gì?

**Delegate** = Biến chứa **function** (function pointer)

```csharp
// Khai báo delegate type
public delegate void OnHealthChanged(int newHealth);

public class Player : MonoBehaviour
{
    private int health = 100;

    // Delegate variable
    public OnHealthChanged onHealthChanged;

    public void TakeDamage(int damage)
    {
        health -= damage;

        // Cách 1: Kiểm tra null thủ công rồi gọi delegate (nếu có ai subscribe)
        // if (onHealthChanged != null)
        // {
        //     onHealthChanged(health);
        // }

        // Cách 2 (ngắn gọn, tương đương): dùng ?. (null-conditional)
        // Chỉ dùng MỘT trong hai cách, nếu không delegate bị gọi 2 lần!
        onHealthChanged?.Invoke(health);
    }
}

// Subscribe to delegate
public class HealthUI : MonoBehaviour
{
    public Player player;

    void Start()
    {
        // Subscribe - Thêm method vào delegate
        player.onHealthChanged += UpdateHealthBar;
    }

    void UpdateHealthBar(int newHealth)
    {
        Debug.Log($"Health UI: {newHealth}");
    }

    void OnDestroy()
    {
        // Unsubscribe - Quan trọng để tránh memory leak!
        player.onHealthChanged -= UpdateHealthBar;
    }
}
```

### Events - Delegates an toàn hơn

**Event** = Delegate với access control (chỉ class owner mới invoke được)

`Action<int>` là delegate có sẵn trong namespace `System` (hàm nhận 1 tham số `int`, trả về `void`) - không cần tự khai báo `delegate` nữa. `Action` = không tham số, `Action<T1, T2>` = 2 tham số...

```csharp
using System;
using UnityEngine;

public class Player : MonoBehaviour
{
    private int health = 100;

    // Event - Chỉ Player mới có thể invoke
    public event Action<int> OnHealthChanged;

    public void TakeDamage(int damage)
    {
        health -= damage;
        OnHealthChanged?.Invoke(health); // Chỉ Player có thể gọi
    }
}

public class HealthUI : MonoBehaviour
{
    public Player player;

    void Start()
    {
        player.OnHealthChanged += UpdateHealthBar; // OK - Subscribe
        // player.OnHealthChanged.Invoke(50); // ERROR - Không thể invoke từ bên ngoài!
    }

    void UpdateHealthBar(int newHealth)
    {
        Debug.Log($"UI: Health = {newHealth}");
    }

    void OnDestroy()
    {
        player.OnHealthChanged -= UpdateHealthBar; // Unsubscribe
    }
}
```

### Event Pattern trong Unity

```csharp
using System;
using UnityEngine;

public class GameManager : MonoBehaviour
{
    // Events cho game states
    public event Action OnGameStart;
    public event Action OnGamePause;
    public event Action OnGameOver;

    // Events với parameters
    public event Action<int> OnScoreChanged;
    public event Action<string> OnPlayerNameChanged;

    private int score = 0;

    public void StartGame()
    {
        Debug.Log("Game Started!");
        OnGameStart?.Invoke();
    }

    public void PauseGame()
    {
        Debug.Log("Game Paused!");
        OnGamePause?.Invoke();
    }

    public void GameOver()
    {
        Debug.Log("Game Over!");
        OnGameOver?.Invoke();
    }

    public void AddScore(int points)
    {
        score += points;
        OnScoreChanged?.Invoke(score);
    }
}

// Nhiều class có thể subscribe cùng event
public class UIManager : MonoBehaviour
{
    public GameManager gameManager;

    void Start()
    {
        gameManager.OnGameStart += ShowGameUI;
        gameManager.OnGamePause += ShowPauseMenu;
        gameManager.OnGameOver += ShowGameOverScreen;
        gameManager.OnScoreChanged += UpdateScoreText;
    }

    void ShowGameUI() { Debug.Log("Show Game UI"); }
    void ShowPauseMenu() { Debug.Log("Show Pause Menu"); }
    void ShowGameOverScreen() { Debug.Log("Show Game Over"); }
    void UpdateScoreText(int score) { Debug.Log($"Score: {score}"); }

    void OnDestroy()
    {
        // Unsubscribe để tránh memory leak
        gameManager.OnGameStart -= ShowGameUI;
        gameManager.OnGamePause -= ShowPauseMenu;
        gameManager.OnGameOver -= ShowGameOverScreen;
        gameManager.OnScoreChanged -= UpdateScoreText;
    }
}

public class AudioManager : MonoBehaviour
{
    public GameManager gameManager;

    void Start()
    {
        gameManager.OnGameStart += PlayGameMusic;
        gameManager.OnGamePause += PlayPauseSound;
        gameManager.OnGameOver += PlayGameOverSound;
    }

    void PlayGameMusic() { Debug.Log("Playing game music"); }
    void PlayPauseSound() { Debug.Log("Playing pause sound"); }
    void PlayGameOverSound() { Debug.Log("Playing game over sound"); }
}
```

### UnityEvent - Events trong Inspector

```csharp
using UnityEngine;
using UnityEngine.Events;

// Đặt tên SimpleButton để không trùng với UnityEngine.UI.Button (Bài 5)
public class SimpleButton : MonoBehaviour
{
    // UnityEvent có thể assign trong Inspector!
    public UnityEvent onClick;
    public UnityEvent<int> onScoreChanged;

    void Update()
    {
        if (Input.GetMouseButtonDown(0))
        {
            onClick?.Invoke();
        }
    }
}

// Có thể assign methods trong Inspector
public class ButtonHandler : MonoBehaviour
{
    public void OnButtonClicked()
    {
        Debug.Log("Button clicked!");
    }

    public void OnScoreChanged(int newScore)
    {
        Debug.Log($"Score: {newScore}");
    }
}
```

## 🎮 Bài tập thực hành nâng cao

### Bài tập 1: Weapon System với Interfaces

Tạo weapon system với:

- Interface `IWeapon` với properties và methods
- Nhiều loại weapons (Sword, Bow, Magic Staff)
- Player có thể switch weapons
- Weapon upgrading system

### Bài tập 2: Event-driven Game Manager

Tạo GameManager với:

- Events cho game states (Start, Pause, GameOver)
- Multiple listeners (UI, Audio, Analytics)
- Score system với events
- Achievement system

### Bài tập 3: Generic Object Pool

Tạo Object Pool system:

- Generic class `ObjectPool<T>` where T : Component (xem Object Pooling ở Bài 2)
- Pool cho bullets, enemies, effects
- Auto-expand khi hết objects
- Performance comparison vs Instantiate

## ✅ Checklist hoàn thành nâng cao

- [ ] Hiểu Assembly và Internal access modifier
- [ ] Thành thạo Static classes, methods, properties
- [ ] Sử dụng Properties thay vì public fields
- [ ] Hiểu Virtual, Override và Abstract
- [ ] Biết khi nào dùng Abstract Class vs Interface
- [ ] Tổ chức code với Namespace
- [ ] Sử dụng Generics cho code reusable
- [ ] Implement Events và Delegates
- [ ] Hiểu Polymorphism trong thực tế
- [ ] Hoàn thành ít nhất 2 bài tập nâng cao

## 🚀 Tiếp theo

Bạn đã hoàn thành C# cơ bản VÀ nâng cao! Giờ bạn có đủ kiến thức để:

- Viết code Unity chuyên nghiệp
- Hiểu design patterns
- Tạo systems phức tạp và scalable

**Bài tiếp theo**: [Unity Fundamentals - GameObject, Component, Transform](./02-unity-fundamentals.md)

---

💡 **Tips nâng cao**:

- **Properties** > **public fields** - Luôn dùng properties cho encapsulation
- **Events** rất mạnh cho decoupling - UI không cần biết Game Logic
- **Interfaces** giúp code flexible và testable
- **Generics** giúp tránh code duplication
- **Static** phải cẩn thận - khó test và có thể gây memory leak
