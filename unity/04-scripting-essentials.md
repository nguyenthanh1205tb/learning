# 🎮 Bài 4: Scripting Essentials - Cơ bản và Nâng cao

## 🎯 Mục tiêu bài học

- Hiểu MonoBehaviour lifecycle chi tiết và khi nào dùng hàm nào
- Thành thạo Input system (keyboard, mouse, axes) với best practices
- Tạo movement system hiệu quả và frame-independent
- Sử dụng SerializeField và Inspector attributes chuyên nghiệp
- Biết cách sử dụng GetComponent và FindObjectOfType tối ưu
- Thành thạo Coroutine cơ bản và nâng cao
- Hiểu Time.deltaTime và frame-independent movement
- Sử dụng Invoke và InvokeRepeating
- Thành thạo Null-conditional operators

## 🔄 1. MonoBehaviour Lifecycle chi tiết

### MonoBehaviour Lifecycle là gì?

**MonoBehaviour Lifecycle** là chuỗi các hàm được Unity gọi **tự động** theo thứ tự nhất định trong vòng đời của GameObject.

### Tại sao cần hiểu Lifecycle?

✅ **Hiểu lifecycle giúp**:

- **Tối ưu performance** - Đặt code đúng chỗ
- **Tránh bugs** - Không gọi hàm khi object chưa sẵn sàng
- **Code organization** - Tổ chức logic rõ ràng
- **Debugging** - Biết hàm nào được gọi khi nào

### Các hàm lifecycle quan trọng

```csharp
public class LifecycleExample : MonoBehaviour
{
    // Awake - Gọi đầu tiên, ngay cả khi object chưa active
    void Awake()
    {
        Debug.Log("Awake - Khởi tạo ban đầu");
        // ✅ Dùng để: Khởi tạo biến, tìm reference, setup singleton
        // ❌ Không dùng: UI updates, physics calculations
    }

    // Start - Gọi một lần sau Awake, khi object active
    void Start()
    {
        Debug.Log("Start - Bắt đầu game");
        // ✅ Dùng để: Setup logic, UI, spawn objects, subscribe events
        // ❌ Không dùng: Khởi tạo biến quan trọng (dùng Awake)
    }

    // Update - Gọi mỗi frame (60fps = 60 lần/giây)
    void Update()
    {
        Debug.Log("Update - Mỗi frame");
        // ✅ Dùng cho: Input, movement, UI updates, game logic
        // ❌ Không dùng: Physics calculations (dùng FixedUpdate)
    }

    // FixedUpdate - Gọi với tần số cố định (50fps mặc định)
    void FixedUpdate()
    {
        Debug.Log("FixedUpdate - Physics update");
        // ✅ Dùng cho: Physics, Rigidbody movement, collision detection
        // ❌ Không dùng: Input handling, UI updates
    }

    // LateUpdate - Gọi sau tất cả Update
    void LateUpdate()
    {
        Debug.Log("LateUpdate - Sau Update");
        // ✅ Dùng cho: Camera follow, UI updates sau game logic
        // ❌ Không dùng: Game logic chính
    }

    // OnEnable - Khi object được kích hoạt
    void OnEnable()
    {
        Debug.Log("OnEnable - Object được bật");
        // ✅ Dùng để: Subscribe events, resume animations
    }

    // OnDisable - Khi object bị tắt
    void OnDisable()
    {
        Debug.Log("OnDisable - Object bị tắt");
        // ✅ Dùng để: Unsubscribe events, pause animations
    }

    // OnDestroy - Khi object bị xóa
    void OnDestroy()
    {
        Debug.Log("OnDestroy - Object bị xóa");
        // ✅ Dùng để: Cleanup resources, save data
    }
}
```

### Thứ tự thực thi chi tiết

```
1. Awake() - Tất cả objects (kể cả inactive)
2. OnEnable() - Khi object được activate
3. Start() - Tất cả active objects
4. Update() - Mỗi frame (60fps)
5. FixedUpdate() - Physics timestep (50fps)
6. LateUpdate() - Sau Update
7. OnGUI() - UI rendering
8. OnDisable() - Khi object bị deactivate
9. OnDestroy() - Khi object bị destroy
```

### Khi nào dùng hàm nào?

```csharp
public class LifecycleUsage : MonoBehaviour
{
    private Rigidbody rb;
    private bool isInitialized = false;
    private PlayerController player;

    void Awake()
    {
        // ✅ Tìm component trước khi Start
        rb = GetComponent<Rigidbody>();

        // ✅ Khởi tạo biến quan trọng
        isInitialized = true;

        // ✅ Singleton setup
        if (Instance == null)
        {
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }
    }

    void Start()
    {
        // ✅ Setup chỉ làm một lần
        if (isInitialized)
        {
            rb.mass = 2f;
            Debug.Log("Setup hoàn thành!");
        }

        // ✅ Subscribe events
        GameManager.OnGameStart += HandleGameStart;
    }

    void Update()
    {
        // ✅ Input và logic mỗi frame
        HandleInput();
        UpdateUI();
    }

    void FixedUpdate()
    {
        // ✅ Physics movement
        HandlePhysicsMovement();
    }

    void LateUpdate()
    {
        // ✅ Camera follow sau khi player di chuyển
        FollowTarget();
    }

    void OnDisable()
    {
        // ✅ Unsubscribe events
        GameManager.OnGameStart -= HandleGameStart;
    }

    void HandleInput() { /* Input logic */ }
    void UpdateUI() { /* UI updates */ }
    void HandlePhysicsMovement() { /* Physics */ }
    void FollowTarget() { /* Camera follow */ }
    void HandleGameStart() { /* Event handler */ }
}
```

## 🎮 2. Input System chi tiết

### Input System là gì?

**Input System** của Unity cho phép bạn xử lý input từ:

- **Keyboard** - Bàn phím
- **Mouse** - Chuột
- **Gamepad** - Tay cầm
- **Touch** - Cảm ứng (mobile)

### Keyboard Input chi tiết

```csharp
public class KeyboardInput : MonoBehaviour
{
    void Update()
    {
        // Kiểm tra phím được nhấn (mỗi frame)
        if (Input.GetKey(KeyCode.W))
        {
            Debug.Log("Đang nhấn W");
        }

        // Kiểm tra phím vừa được nhấn (chỉ một lần)
        if (Input.GetKeyDown(KeyCode.Space))
        {
            Debug.Log("Vừa nhấn Space");
        }

        // Kiểm tra phím vừa được thả
        if (Input.GetKeyUp(KeyCode.Escape))
        {
            Debug.Log("Vừa thả Escape");
        }

        // Sử dụng KeyCode enum
        if (Input.GetKey(KeyCode.LeftShift))
        {
            Debug.Log("Đang chạy!");
        }
    }
}
```

### Mouse Input chi tiết

```csharp
public class MouseInput : MonoBehaviour
{
    void Update()
    {
        // Mouse buttons
        if (Input.GetMouseButton(0)) // Left click
        {
            Debug.Log("Đang giữ chuột trái");
        }

        if (Input.GetMouseButtonDown(1)) // Right click
        {
            Debug.Log("Vừa click chuột phải");
        }

        if (Input.GetMouseButtonUp(2)) // Middle click
        {
            Debug.Log("Vừa thả chuột giữa");
        }

        // Mouse position
        Vector3 mousePos = Input.mousePosition;
        Debug.Log($"Mouse position: {mousePos}");

        // Mouse movement
        float mouseX = Input.GetAxis("Mouse X");
        float mouseY = Input.GetAxis("Mouse Y");
        Debug.Log($"Mouse movement: {mouseX}, {mouseY}");

        // Scroll wheel
        float scroll = Input.GetAxis("Mouse ScrollWheel");
        if (scroll > 0)
        {
            Debug.Log("Scroll up");
        }
        else if (scroll < 0)
        {
            Debug.Log("Scroll down");
        }
    }
}
```

### Input Axes - Hệ thống trục

```csharp
public class InputAxes : MonoBehaviour
{
    void Update()
    {
        // Horizontal axis (A/D hoặc Left/Right arrow)
        float horizontal = Input.GetAxis("Horizontal");
        Debug.Log($"Horizontal: {horizontal}");

        // Vertical axis (W/S hoặc Up/Down arrow)
        float vertical = Input.GetAxis("Vertical");
        Debug.Log($"Vertical: {vertical}");

        // Raw input (không có smoothing)
        float horizontalRaw = Input.GetAxisRaw("Horizontal");
        float verticalRaw = Input.GetAxisRaw("Vertical");

        // Mouse axes
        float mouseX = Input.GetAxis("Mouse X");
        float mouseY = Input.GetAxis("Mouse Y");

        // Fire axes (Ctrl, Space, Mouse buttons)
        float fire1 = Input.GetAxis("Fire1"); // Left Ctrl
        float fire2 = Input.GetAxis("Fire2"); // Left Alt
        float fire3 = Input.GetAxis("Fire3"); // Space
    }
}
```

### Custom Input Mapping

```csharp
public class CustomInput : MonoBehaviour
{
    void Update()
    {
        // Kiểm tra nhiều phím cùng lúc
        if (Input.GetKey(KeyCode.LeftShift) && Input.GetKey(KeyCode.W))
        {
            Debug.Log("Đang chạy lên!");
        }

        // Kiểm tra phím số
        for (int i = 1; i <= 9; i++)
        {
            if (Input.GetKeyDown(KeyCode.Alpha0 + i))
            {
                Debug.Log($"Nhấn phím số {i}");
            }
        }

        // Kiểm tra phím chữ
        if (Input.GetKeyDown(KeyCode.Q))
        {
            Debug.Log("Nhấn Q");
        }

        // Kiểm tra phím đặc biệt
        if (Input.GetKeyDown(KeyCode.Return))
        {
            Debug.Log("Nhấn Enter");
        }
    }
}
```

## 🏃‍♂️ 3. Movement Systems chi tiết

### Transform-based Movement

```csharp
public class TransformMovement : MonoBehaviour
{
    public float moveSpeed = 5f;
    public float rotationSpeed = 90f;

    void Update()
    {
        // Di chuyển bằng Transform
        float horizontal = Input.GetAxis("Horizontal");
        float vertical = Input.GetAxis("Vertical");

        Vector3 movement = new Vector3(horizontal, 0, vertical) * moveSpeed * Time.deltaTime;
        transform.Translate(movement);

        // Xoay bằng Transform
        float mouseX = Input.GetAxis("Mouse X");
        transform.Rotate(0, mouseX * rotationSpeed * Time.deltaTime, 0);
    }
}
```

### Rigidbody Movement

```csharp
public class RigidbodyMovement : MonoBehaviour
{
    public float moveSpeed = 5f;
    public float jumpForce = 10f;

    private Rigidbody rb;
    private bool isGrounded;

    void Start()
    {
        rb = GetComponent<Rigidbody>();
    }

    void FixedUpdate()
    {
        // Movement trong FixedUpdate cho physics
        HandleMovement();
    }

    void Update()
    {
        // Jump trong Update cho input
        HandleJump();
    }

    void HandleMovement()
    {
        float horizontal = Input.GetAxis("Horizontal");
        float vertical = Input.GetAxis("Vertical");

        Vector3 movement = new Vector3(horizontal, 0, vertical) * moveSpeed;

        // Sử dụng velocity thay vì AddForce cho movement mượt
        rb.velocity = new Vector3(movement.x, rb.velocity.y, movement.z);
    }

    void HandleJump()
    {
        if (Input.GetKeyDown(KeyCode.Space) && isGrounded)
        {
            rb.AddForce(Vector3.up * jumpForce, ForceMode.Impulse);
        }
    }

    void OnCollisionStay(Collision collision)
    {
        // Kiểm tra ground
        if (collision.gameObject.CompareTag("Ground"))
        {
            isGrounded = true;
        }
    }

    void OnCollisionExit(Collision collision)
    {
        if (collision.gameObject.CompareTag("Ground"))
        {
            isGrounded = false;
        }
    }
}
```

### Character Controller Movement

```csharp
public class CharacterControllerMovement : MonoBehaviour
{
    public float moveSpeed = 5f;
    public float jumpSpeed = 8f;
    public float gravity = 20f;

    private CharacterController controller;
    private Vector3 moveDirection = Vector3.zero;

    void Start()
    {
        controller = GetComponent<CharacterController>();
    }

    void Update()
    {
        // Kiểm tra có đang đứng trên ground không
        if (controller.isGrounded)
        {
            // Input movement
            float horizontal = Input.GetAxis("Horizontal");
            float vertical = Input.GetAxis("Vertical");

            moveDirection = new Vector3(horizontal, 0, vertical);
            moveDirection = transform.TransformDirection(moveDirection);
            moveDirection *= moveSpeed;

            // Jump
            if (Input.GetKeyDown(KeyCode.Space))
            {
                moveDirection.y = jumpSpeed;
            }
        }

        // Áp dụng gravity
        moveDirection.y -= gravity * Time.deltaTime;

        // Di chuyển
        controller.Move(moveDirection * Time.deltaTime);
    }
}
```

## ⏰ 4. Time.deltaTime - Frame-independent Movement

### Time.deltaTime là gì?

**Time.deltaTime** = Thời gian giữa frame hiện tại và frame trước (tính bằng giây).

### Tại sao cần Time.deltaTime?

❌ **Không dùng deltaTime**:

```csharp
void Update()
{
    // Movement phụ thuộc vào FPS!
    transform.Translate(Vector3.forward * 5f); // 60fps = 300 units/s, 30fps = 150 units/s
}
```

✅ **Dùng deltaTime**:

```csharp
void Update()
{
    // Movement độc lập với FPS!
    transform.Translate(Vector3.forward * 5f * Time.deltaTime); // Luôn 5 units/s
}
```

### Time.deltaTime chi tiết

```csharp
public class TimeDeltaTimeExample : MonoBehaviour
{
    public float moveSpeed = 5f;
    public float rotationSpeed = 90f;

    void Update()
    {
        // Movement với deltaTime
        float horizontal = Input.GetAxis("Horizontal");
        float vertical = Input.GetAxis("Vertical");

        Vector3 movement = new Vector3(horizontal, 0, vertical) * moveSpeed * Time.deltaTime;
        transform.Translate(movement);

        // Rotation với deltaTime
        float mouseX = Input.GetAxis("Mouse X");
        transform.Rotate(0, mouseX * rotationSpeed * Time.deltaTime, 0);

        // Debug deltaTime
        Debug.Log($"DeltaTime: {Time.deltaTime}, FPS: {1f / Time.deltaTime}");
    }
}
```

### Time Properties chi tiết

```csharp
public class TimeProperties : MonoBehaviour
{
    void Update()
    {
        // Time.deltaTime - Thời gian giữa frames
        Debug.Log($"DeltaTime: {Time.deltaTime}");

        // Time.time - Thời gian từ khi game bắt đầu
        Debug.Log($"Time: {Time.time}");

        // Time.timeScale - Tốc độ thời gian (1 = bình thường, 0 = dừng)
        Debug.Log($"TimeScale: {Time.timeScale}");

        // Time.fixedDeltaTime - Thời gian giữa FixedUpdate calls
        Debug.Log($"FixedDeltaTime: {Time.fixedDeltaTime}");

        // Time.unscaledDeltaTime - DeltaTime không bị ảnh hưởng bởi timeScale
        Debug.Log($"UnscaledDeltaTime: {Time.unscaledDeltaTime}");

        // Time.unscaledTime - Time không bị ảnh hưởng bởi timeScale
        Debug.Log($"UnscaledTime: {Time.unscaledTime}");

        // Time.frameCount - Số frame đã render
        Debug.Log($"FrameCount: {Time.frameCount}");
    }
}
```

### Frame-independent Animation

```csharp
public class FrameIndependentAnimation : MonoBehaviour
{
    public float animationSpeed = 2f;
    public float rotationSpeed = 45f;

    private float animationTime = 0f;

    void Update()
    {
        // Animation time độc lập với FPS
        animationTime += Time.deltaTime * animationSpeed;

        // Sine wave animation
        float yOffset = Mathf.Sin(animationTime) * 2f;
        transform.position = new Vector3(transform.position.x, yOffset, transform.position.z);

        // Rotation độc lập với FPS
        transform.Rotate(0, rotationSpeed * Time.deltaTime, 0);

        // Color animation
        Color color = Color.Lerp(Color.red, Color.blue, Mathf.PingPong(animationTime, 1f));
        GetComponent<Renderer>().material.color = color;
    }
}
```

### Time.timeScale Effects

```csharp
public class TimeScaleEffects : MonoBehaviour
{
    void Update()
    {
        // Pause game
        if (Input.GetKeyDown(KeyCode.P))
        {
            Time.timeScale = 0f; // Dừng thời gian
        }

        // Resume game
        if (Input.GetKeyDown(KeyCode.R))
        {
            Time.timeScale = 1f; // Bình thường
        }

        // Slow motion
        if (Input.GetKeyDown(KeyCode.S))
        {
            Time.timeScale = 0.5f; // Chậm 50%
        }

        // Fast forward
        if (Input.GetKeyDown(KeyCode.F))
        {
            Time.timeScale = 2f; // Nhanh gấp đôi
        }

        // UI animation không bị ảnh hưởng bởi timeScale
        if (Input.GetKeyDown(KeyCode.U))
        {
            StartCoroutine(UIAnimation());
        }
    }

    IEnumerator UIAnimation()
    {
        // Sử dụng unscaledDeltaTime cho UI
        float duration = 1f;
        float elapsed = 0f;

        while (elapsed < duration)
        {
            elapsed += Time.unscaledDeltaTime; // Không bị ảnh hưởng bởi timeScale
            float progress = elapsed / duration;

            // UI animation logic
            transform.localScale = Vector3.Lerp(Vector3.one, Vector3.one * 1.2f, progress);

            yield return null;
        }

        transform.localScale = Vector3.one;
    }
}
```

## 🔧 5. SerializeField và Inspector chi tiết

### SerializeField - Hiển thị biến trong Inspector

```csharp
public class InspectorExample : MonoBehaviour
{
    // Public - hiển thị trong Inspector
    public float publicValue = 10f;
    public string playerName = "Player";
    public bool isActive = true;

    // SerializeField - hiển thị private trong Inspector
    [SerializeField] private float privateValue = 5f;
    [SerializeField] private int health = 100;
    [SerializeField] private Vector3 spawnPosition = Vector3.zero;

    // Không hiển thị trong Inspector
    private float hiddenValue = 0f;

    // SerializeField với tooltip
    [SerializeField, Tooltip("Tốc độ di chuyển của player")]
    private float moveSpeed = 5f;

    // SerializeField với Range
    [SerializeField, Range(0f, 100f)]
    private float volume = 50f;

    // SerializeField với Header
    [Header("Player Settings")]
    [SerializeField] private float jumpHeight = 2f;
    [SerializeField] private float runSpeed = 8f;

    [Header("Combat Settings")]
    [SerializeField] private int damage = 25;
    [SerializeField] private float attackRange = 2f;
}
```

### Custom Inspector Attributes

```csharp
public class CustomAttributes : MonoBehaviour
{
    [Header("Movement")]
    [SerializeField, Range(1f, 20f)] private float moveSpeed = 5f;
    [SerializeField, Range(1f, 10f)] private float jumpForce = 5f;

    [Header("Combat")]
    [SerializeField, Range(1, 100)] private int health = 100;
    [SerializeField, Range(1, 50)] private int damage = 25;

    [Space(10)] // Khoảng trống
    [SerializeField, Tooltip("Có thể nhảy hay không")]
    private bool canJump = true;

    [Space(5)]
    [SerializeField, Tooltip("Có thể chạy hay không")]
    private bool canRun = true;

    [Header("Audio")]
    [SerializeField, Range(0f, 1f)] private float volume = 0.5f;
    [SerializeField] private AudioClip jumpSound;
    [SerializeField] private AudioClip attackSound;
}
```

## 🔍 6. GetComponent và FindObjectOfType chi tiết

### GetComponent - Lấy component từ GameObject

```csharp
public class ComponentAccess : MonoBehaviour
{
    private Rigidbody rb;
    private Renderer renderer;
    private Collider collider;

    void Start()
    {
        // Lấy component từ GameObject này
        rb = GetComponent<Rigidbody>();
        renderer = GetComponent<Renderer>();
        collider = GetComponent<Collider>();

        // Kiểm tra component có tồn tại không
        if (rb != null)
        {
            rb.mass = 2f;
        }

        // Cách ngắn gọn với TryGetComponent
        if (TryGetComponent<AudioSource>(out AudioSource audioSource))
        {
            audioSource.volume = 0.5f;
        }

        // Lấy tất cả component cùng loại
        Renderer[] allRenderers = GetComponents<Renderer>();

        // Lấy component từ GameObject con
        Transform childTransform = GetComponentInChildren<Transform>();

        // Lấy component từ GameObject cha
        Transform parentTransform = GetComponentInParent<Transform>();
    }
}
```

### FindObjectOfType - Tìm GameObject trong Scene

```csharp
public class FindObjectExample : MonoBehaviour
{
    private PlayerController player;
    private GameManager gameManager;
    private Camera mainCamera;

    void Start()
    {
        // Tìm GameObject theo component
        player = FindObjectOfType<PlayerController>();
        gameManager = FindObjectOfType<GameManager>();
        mainCamera = FindObjectOfType<Camera>();

        // Tìm tất cả GameObject có component
        EnemyController[] enemies = FindObjectsOfType<EnemyController>();

        // Tìm GameObject theo tên
        GameObject playerObject = GameObject.Find("Player");

        // Tìm GameObject theo tag
        GameObject playerByTag = GameObject.FindWithTag("Player");
        GameObject[] enemiesByTag = GameObject.FindGameObjectsWithTag("Enemy");

        // Kiểm tra có tìm thấy không
        if (player != null)
        {
            Debug.Log($"Tìm thấy player: {player.name}");
        }
        else
        {
            Debug.Log("Không tìm thấy player!");
        }
    }
}
```

### Performance Tips

```csharp
public class PerformanceTips : MonoBehaviour
{
    // Cache references để tránh tìm kiếm nhiều lần
    private PlayerController player;
    private Rigidbody rb;

    void Start()
    {
        // Tìm một lần và cache
        player = FindObjectOfType<PlayerController>();
        rb = GetComponent<Rigidbody>();
    }

    void Update()
    {
        // Sử dụng cached reference thay vì tìm lại
        if (player != null)
        {
            float distance = Vector3.Distance(transform.position, player.transform.position);
            Debug.Log($"Distance to player: {distance}");
        }

        // Không làm điều này trong Update!
        // PlayerController badPlayer = FindObjectOfType<PlayerController>();
    }
}
```

## ⏰ 7. Coroutine Advanced

### Coroutine là gì?

**Coroutine** cho phép thực thi code **theo thời gian** thay vì mỗi frame.

### Cú pháp cơ bản

```csharp
public class CoroutineExample : MonoBehaviour
{
    void Start()
    {
        // Bắt đầu coroutine
        StartCoroutine(MyCoroutine());

        // Hoặc với tên string
        StartCoroutine("MyCoroutine");

        // Dừng coroutine
        // StopCoroutine(MyCoroutine());
        // StopCoroutine("MyCoroutine");
    }

    // Coroutine phải trả về IEnumerator
    IEnumerator MyCoroutine()
    {
        Debug.Log("Coroutine bắt đầu");

        // Chờ 1 giây
        yield return new WaitForSeconds(1f);

        Debug.Log("Sau 1 giây");

        // Chờ frame tiếp theo
        yield return null;

        Debug.Log("Frame tiếp theo");

        // Chờ đến khi điều kiện đúng
        yield return new WaitUntil(() => Input.GetKeyDown(KeyCode.Space));

        Debug.Log("Space được nhấn!");
    }
}
```

### Các loại Wait

```csharp
public class WaitTypes : MonoBehaviour
{
    IEnumerator WaitExamples()
    {
        // Chờ thời gian cố định
        yield return new WaitForSeconds(2f);

        // Chờ thời gian thực (không bị ảnh hưởng bởi Time.timeScale)
        yield return new WaitForSecondsRealtime(1f);

        // Chờ frame tiếp theo
        yield return null;

        // Chờ end of frame
        yield return new WaitForEndOfFrame();

        // Chờ fixed update
        yield return new WaitForFixedUpdate();

        // Chờ đến khi điều kiện đúng
        yield return new WaitUntil(() => Input.GetKeyDown(KeyCode.Space));

        // Chờ đến khi điều kiện sai
        yield return new WaitWhile(() => Input.GetKey(KeyCode.Space));

        // Chờ coroutine khác hoàn thành
        yield return StartCoroutine(AnotherCoroutine());
    }

    IEnumerator AnotherCoroutine()
    {
        yield return new WaitForSeconds(1f);
        Debug.Log("Another coroutine hoàn thành");
    }
}
```

### Coroutine Advanced Techniques

```csharp
public class CoroutineAdvanced : MonoBehaviour
{
    private Coroutine currentCoroutine;

    void Start()
    {
        // Start coroutine và lưu reference
        currentCoroutine = StartCoroutine(AdvancedCoroutine());
    }

    IEnumerator AdvancedCoroutine()
    {
        Debug.Log("Advanced coroutine started");

        // Nested coroutines
        yield return StartCoroutine(SubCoroutine1());
        yield return StartCoroutine(SubCoroutine2());

        // Parallel coroutines
        Coroutine coroutine1 = StartCoroutine(ParallelCoroutine1());
        Coroutine coroutine2 = StartCoroutine(ParallelCoroutine2());

        // Chờ cả hai hoàn thành
        yield return coroutine1;
        yield return coroutine2;

        Debug.Log("All coroutines completed");
    }

    IEnumerator SubCoroutine1()
    {
        Debug.Log("Sub coroutine 1");
        yield return new WaitForSeconds(1f);
    }

    IEnumerator SubCoroutine2()
    {
        Debug.Log("Sub coroutine 2");
        yield return new WaitForSeconds(1f);
    }

    IEnumerator ParallelCoroutine1()
    {
        Debug.Log("Parallel coroutine 1");
        yield return new WaitForSeconds(2f);
    }

    IEnumerator ParallelCoroutine2()
    {
        Debug.Log("Parallel coroutine 2");
        yield return new WaitForSeconds(3f);
    }

    void StopCurrentCoroutine()
    {
        if (currentCoroutine != null)
        {
            StopCoroutine(currentCoroutine);
            currentCoroutine = null;
        }
    }
}
```

### Coroutine trong thực tế

```csharp
public class CoroutinePractice : MonoBehaviour
{
    public float fadeTime = 2f;

    void Start()
    {
        StartCoroutine(FadeIn());
    }

    IEnumerator FadeIn()
    {
        Renderer renderer = GetComponent<Renderer>();
        Color color = renderer.material.color;

        // Fade từ trong suốt đến đục
        for (float t = 0; t < fadeTime; t += Time.deltaTime)
        {
            float alpha = Mathf.Lerp(0f, 1f, t / fadeTime);
            color.a = alpha;
            renderer.material.color = color;
            yield return null;
        }

        // Đảm bảo alpha = 1
        color.a = 1f;
        renderer.material.color = color;
    }

    IEnumerator SpawnEnemies()
    {
        while (true)
        {
            // Spawn enemy
            Debug.Log("Spawning enemy...");

            // Chờ 3 giây
            yield return new WaitForSeconds(3f);
        }
    }

    IEnumerator DelayedAction()
    {
        Debug.Log("Bắt đầu đếm ngược...");

        for (int i = 3; i > 0; i--)
        {
            Debug.Log($"{i}...");
            yield return new WaitForSeconds(1f);
        }

        Debug.Log("BOOM!");
    }
}
```

## 🔄 8. Invoke và InvokeRepeating

### Invoke là gì?

**Invoke** cho phép gọi hàm sau một khoảng thời gian delay.

### Invoke cơ bản

```csharp
public class InvokeExample : MonoBehaviour
{
    void Start()
    {
        // Gọi hàm sau 2 giây
        Invoke("DelayedFunction", 2f);

        // Gọi hàm với tham số (không hỗ trợ trực tiếp)
        Invoke("DelayedFunctionWithParam", 3f);

        // Hủy invoke
        CancelInvoke("DelayedFunction");
    }

    void DelayedFunction()
    {
        Debug.Log("Hàm được gọi sau 2 giây!");
    }

    void DelayedFunctionWithParam()
    {
        Debug.Log("Hàm với tham số được gọi!");
    }
}
```

### InvokeRepeating - Lặp lại

```csharp
public class InvokeRepeatingExample : MonoBehaviour
{
    void Start()
    {
        // Gọi hàm sau 1 giây, sau đó lặp lại mỗi 2 giây
        InvokeRepeating("RepeatingFunction", 1f, 2f);

        // Hủy tất cả invoke
        CancelInvoke();
    }

    void RepeatingFunction()
    {
        Debug.Log($"Repeating function called at {Time.time}");
    }
}
```

### Invoke vs Coroutine

```csharp
public class InvokeVsCoroutine : MonoBehaviour
{
    void Start()
    {
        // Invoke - Đơn giản nhưng hạn chế
        Invoke("SimpleDelayedFunction", 2f);

        // Coroutine - Linh hoạt hơn
        StartCoroutine(AdvancedDelayedFunction());
    }

    void SimpleDelayedFunction()
    {
        Debug.Log("Simple delayed function");
    }

    IEnumerator AdvancedDelayedFunction()
    {
        Debug.Log("Advanced coroutine started");

        // Có thể làm nhiều thứ phức tạp
        for (int i = 0; i < 5; i++)
        {
            Debug.Log($"Step {i + 1}");
            yield return new WaitForSeconds(0.5f);
        }

        Debug.Log("Advanced coroutine completed");
    }
}
```

## ❓ 9. Null-conditional Operators

### Null-conditional Operators là gì?

**Null-conditional operators** (`?.` và `??`) giúp xử lý null values một cách an toàn.

### Null-conditional Operator (?.)

```csharp
public class NullConditionalExample : MonoBehaviour
{
    public PlayerController player;
    public GameManager gameManager;

    void Start()
    {
        // ❌ Cách cũ - Có thể gây NullReferenceException
        // if (player != null)
        // {
        //     player.TakeDamage(10);
        // }

        // ✅ Cách mới - An toàn với null
        player?.TakeDamage(10);

        // Với properties
        string playerName = player?.name ?? "Unknown Player";
        Debug.Log($"Player name: {playerName}");

        // Với method calls
        gameManager?.AddScore(100);

        // Với arrays
        PlayerController[] players = FindObjectsOfType<PlayerController>();
        players?[0]?.TakeDamage(5);
    }
}
```

### Null-coalescing Operator (??)

```csharp
public class NullCoalescingExample : MonoBehaviour
{
    public string playerName;
    public int playerScore;

    void Start()
    {
        // Null-coalescing operator
        string displayName = playerName ?? "Default Player";
        int displayScore = playerScore ?? 0;

        Debug.Log($"Player: {displayName}, Score: {displayScore}");

        // Với method calls
        string result = GetPlayerName() ?? "No Name";
        Debug.Log($"Result: {result}");
    }

    string GetPlayerName()
    {
        // Có thể trả về null
        return null;
    }
}
```

### Null-conditional trong Unity

```csharp
public class UnityNullConditional : MonoBehaviour
{
    void Update()
    {
        // Safe component access
        Rigidbody rb = GetComponent<Rigidbody>();
        rb?.AddForce(Vector3.forward * 10f);

        // Safe GameObject access
        GameObject player = GameObject.Find("Player");
        player?.SetActive(true);

        // Safe Transform access
        Transform playerTransform = player?.transform;
        Vector3 playerPosition = playerTransform?.position ?? Vector3.zero;

        // Safe method calls
        PlayerController controller = player?.GetComponent<PlayerController>();
        controller?.TakeDamage(10);

        // Safe array access
        Collider[] colliders = Physics.OverlapSphere(transform.position, 5f);
        colliders?[0]?.gameObject.SetActive(false);
    }
}
```

## 🎮 Bài tập thực hành nâng cao

### Bài tập 1: Advanced Player Controller

Tạo Player Controller với:

- Frame-independent movement
- Coyote time (jump grace period)
- Variable jump height
- Dash ability với cooldown
- Wall running và wall jumping
- Sử dụng Coroutine cho abilities

### Bài tập 2: Time Management System

Tạo Time Management System với:

- Pause/Resume functionality
- Slow motion effects
- Time-based events
- UI animations không bị ảnh hưởng bởi timeScale
- Time-based achievements

### Bài tập 3: Coroutine Utilities Library

Tạo Coroutine Utilities với:

- FadeIn/FadeOut cho UI
- MoveTo/RotateTo/ScaleTo animations
- Delayed function calls
- Parallel coroutine execution
- Coroutine pooling system

## ✅ Checklist hoàn thành nâng cao

- [ ] Hiểu MonoBehaviour lifecycle chi tiết và khi nào dùng hàm nào
- [ ] Thành thạo Input system với best practices
- [ ] Tạo movement system frame-independent
- [ ] Sử dụng SerializeField và Inspector attributes chuyên nghiệp
- [ ] Biết cách sử dụng GetComponent và FindObjectOfType tối ưu
- [ ] Thành thạo Coroutine cơ bản và nâng cao
- [ ] Hiểu Time.deltaTime và frame-independent movement
- [ ] Sử dụng Invoke và InvokeRepeating
- [ ] Thành thạo Null-conditional operators
- [ ] Hoàn thành ít nhất 2 bài tập nâng cao

## 🚀 Tiếp theo

Bạn đã nắm vững Scripting Essentials cơ bản VÀ nâng cao! Giờ bạn có thể:

- Tạo movement systems mượt mà và frame-independent
- Sử dụng Coroutines cho complex animations
- Handle null values safely
- Optimize performance với proper lifecycle usage

**Bài tiếp theo**: [UI System - Canvas, Button, Text, Scene management](./05-ui-system.md)

---

💡 **Tips nâng cao**:

- **Time.deltaTime** là key cho frame-independent movement
- **Coroutines** rất mạnh cho animations và timing
- **Null-conditional operators** giúp code safe và clean
- **Invoke** đơn giản nhưng **Coroutines** linh hoạt hơn
- **Lifecycle** đúng chỗ = performance tốt
