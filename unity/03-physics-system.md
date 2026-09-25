# ⚡ Bài 3: Physics System - Cơ bản và Nâng cao

## 🎯 Mục tiêu bài học

- Hiểu Rigidbody và cách sử dụng chuyên nghiệp
- Thành thạo các loại Collider và khi nào dùng
- Phân biệt Collision vs Trigger với best practices
- Sử dụng Raycast cho detection và AI
- Tạo physics-based movement mượt mà
- Thành thạo Physics Materials và Collision Matrix
- Sử dụng Joints cho physics interactions
- Tối ưu performance với physics best practices
- Biết Physics 2D (Rigidbody2D, Collider2D) cho game 2D

> ⚠️ **Lưu ý phiên bản Unity**: Từ **Unity 6**, một số API vật lý được đổi tên. Tên cũ vẫn chạy (có cảnh báo *obsolete*, Unity có thể tự cập nhật), nhưng nên dùng tên mới:
>
> | Unity 2022 trở về trước | Unity 6+ |
> | --- | --- |
> | `rb.velocity` | `rb.linearVelocity` |
> | `rb.drag` | `rb.linearDamping` |
> | `rb.angularDrag` | `rb.angularDamping` |
> | `PhysicMaterial`, `PhysicMaterialCombine` | `PhysicsMaterial`, `PhysicsMaterialCombine` |
>
> Các ví dụ trong bài giữ tên cũ để chạy được trên cả Unity 2022 LTS; nếu dùng Unity 6 hãy đổi sang tên mới. (Rigidbody2D cũng vậy: `velocity` → `linearVelocity`.)

> 💡 **Về `Input` và `Update`/`FixedUpdate`**: Một số ví dụ dùng `Input.GetKey`, `Input.GetAxis` (đọc bàn phím) - sẽ học chi tiết ở **Bài 4**. Để đơn giản, vài ví dụ đặt code vật lý trong `Update()`; trong game thật, **code tác động Rigidbody (AddForce, velocity liên tục) nên đặt trong `FixedUpdate()`**, còn đọc input thì trong `Update()` (xem Bài 4, phần 1 và 3).

## 🏃‍♂️ 1. Rigidbody - Vật lý cơ bản

### Rigidbody là gì?

**Rigidbody** làm cho GameObject chịu tác động của **physics engine**:

- **Trọng lực** (gravity)
- **Va chạm** với vật thể khác
- **Lực và xung lực** (forces và impulses)
- **Ma sát và đàn hồi** (friction và bounciness)

### Tại sao cần Rigidbody?

✅ **Dùng Rigidbody khi**:

- Object cần physics simulation
- Cần collision detection với physics
- Muốn object tự động rơi xuống
- Cần realistic movement

❌ **Không dùng Rigidbody khi**:

- Object chỉ cần collision detection (dùng Kinematic)
- Movement hoàn toàn scripted
- UI elements
- Static environment objects

### Thêm Rigidbody

```csharp
public class RigidbodyExample : MonoBehaviour
{
    void Start()
    {
        // Thêm Rigidbody vào GameObject này
        Rigidbody rb = gameObject.AddComponent<Rigidbody>();

        // Cấu hình Rigidbody
        rb.mass = 2f;           // Khối lượng (kg) - ảnh hưởng đến inertia
        rb.drag = 0.5f;         // Lực cản không khí (Unity 6: rb.linearDamping)
        rb.angularDrag = 0.1f;  // Lực cản xoay (Unity 6: rb.angularDamping)
        rb.useGravity = true;   // Có chịu trọng lực không

        // Kiểm tra Rigidbody
        if (GetComponent<Rigidbody>() != null)
        {
            Debug.Log("Có Rigidbody!");
        }
    }
}
```

### Rigidbody Properties chi tiết

```csharp
public class RigidbodyProperties : MonoBehaviour
{
    private Rigidbody rb;

    void Start()
    {
        rb = GetComponent<Rigidbody>();

        // Mass - Khối lượng
        rb.mass = 1f; // 1kg

        // Drag - Lực cản tuyến tính
        rb.drag = 0.5f; // Càng cao càng chậm

        // Angular Drag - Lực cản góc
        rb.angularDrag = 0.1f; // Càng cao càng ít xoay

        // Use Gravity - Có chịu trọng lực
        rb.useGravity = true;

        // Is Kinematic - Không chịu physics forces
        rb.isKinematic = false; // true = chỉ collision, không physics

        // Freeze Position - Khóa di chuyển theo trục
        rb.constraints = RigidbodyConstraints.FreezePositionY; // Không di chuyển Y

        // Freeze Rotation - Khóa xoay theo trục
        // Lưu ý: phép gán này GHI ĐÈ dòng trên. Muốn khóa nhiều thứ thì kết hợp bằng |
        rb.constraints = RigidbodyConstraints.FreezeRotationX | RigidbodyConstraints.FreezeRotationZ;

        // Center of Mass - Trọng tâm
        rb.centerOfMass = new Vector3(0, -0.5f, 0); // Thấp hơn để ổn định

        // Interpolation - Làm mượt movement
        rb.interpolation = RigidbodyInterpolation.Interpolate; // Smooth movement

        // Collision Detection - Độ chính xác collision
        rb.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;
    }
}
```

### Lực và Xung lực

```csharp
public class ForceExample : MonoBehaviour
{
    public Rigidbody rb;

    void Start()
    {
        rb = GetComponent<Rigidbody>();
    }

    void Update()
    {
        // Thêm lực liên tục
        if (Input.GetKey(KeyCode.W))
        {
            rb.AddForce(Vector3.forward * 10f);
        }

        // Thêm lực một lần
        if (Input.GetKeyDown(KeyCode.Space))
        {
            rb.AddForce(Vector3.up * 500f, ForceMode.Impulse);
        }

        // Thêm lực tại vị trí cụ thể
        if (Input.GetKeyDown(KeyCode.F))
        {
            rb.AddForceAtPosition(Vector3.forward * 100f, transform.position + Vector3.up);
        }

        // Thêm xung lực (tức thời)
        if (Input.GetKeyDown(KeyCode.R))
        {
            rb.AddForce(Vector3.up * 10f, ForceMode.VelocityChange);
        }
    }
}
```

### ForceMode - Các chế độ lực chi tiết

```csharp
public class ForceModeExample : MonoBehaviour
{
    public Rigidbody rb;

    void Start()
    {
        rb = GetComponent<Rigidbody>();
    }

    void Update()
    {
        if (Input.GetKeyDown(KeyCode.Alpha1))
        {
            // Force - Lực liên tục (mặc định)
            // F = ma, bị ảnh hưởng bởi mass
            rb.AddForce(Vector3.forward * 10f, ForceMode.Force);
        }

        if (Input.GetKeyDown(KeyCode.Alpha2))
        {
            // Acceleration - Gia tốc (bỏ qua mass)
            // a = F, không bị ảnh hưởng bởi mass
            rb.AddForce(Vector3.forward * 10f, ForceMode.Acceleration);
        }

        if (Input.GetKeyDown(KeyCode.Alpha3))
        {
            // Impulse - Xung lực tức thời
            // F = ma, áp dụng trong 1 frame
            rb.AddForce(Vector3.forward * 10f, ForceMode.Impulse);
        }

        if (Input.GetKeyDown(KeyCode.Alpha4))
        {
            // VelocityChange - Thay đổi vận tốc tức thời
            // v = F, không bị ảnh hưởng bởi mass
            rb.AddForce(Vector3.forward * 10f, ForceMode.VelocityChange);
        }
    }
}
```

### Vận tốc và Angular Velocity

```csharp
public class VelocityExample : MonoBehaviour
{
    public Rigidbody rb;

    void Start()
    {
        rb = GetComponent<Rigidbody>();
    }

    void Update()
    {
        // Đặt vận tốc trực tiếp (Unity 6: rb.linearVelocity)
        if (Input.GetKey(KeyCode.W))
        {
            rb.velocity = new Vector3(0, rb.velocity.y, 5f);
        }

        // Đặt vận tốc góc (xoay)
        if (Input.GetKey(KeyCode.Q))
        {
            rb.angularVelocity = new Vector3(0, 2f, 0);
        }

        // Giới hạn vận tốc tối đa
        if (rb.velocity.magnitude > 10f)
        {
            rb.velocity = rb.velocity.normalized * 10f;
        }

        // Dừng hoàn toàn
        if (Input.GetKeyDown(KeyCode.S))
        {
            rb.velocity = Vector3.zero;
            rb.angularVelocity = Vector3.zero;
        }
    }
}
```

## 🎯 2. Collider - Hình dạng va chạm

### Collider là gì?

**Collider** định nghĩa **hình dạng va chạm** của GameObject. Unity sử dụng collider để:

- **Collision Detection** - Phát hiện va chạm
- **Physics Simulation** - Tính toán physics
- **Trigger Detection** - Phát hiện trigger events

### Các loại Collider và khi nào dùng

```csharp
public class ColliderExample : MonoBehaviour
{
    void Start()
    {
        // Box Collider - Hình hộp
        // ✅ Dùng cho: Buildings, platforms, crates
        BoxCollider boxCollider = gameObject.AddComponent<BoxCollider>();
        boxCollider.size = new Vector3(2, 2, 2);
        boxCollider.center = Vector3.zero;

        // Sphere Collider - Hình cầu
        // ✅ Dùng cho: Balls, projectiles, simple characters
        SphereCollider sphereCollider = gameObject.AddComponent<SphereCollider>();
        sphereCollider.radius = 1f;
        sphereCollider.center = Vector3.zero;

        // Capsule Collider - Hình viên nang
        // ✅ Dùng cho: Characters, humanoids
        CapsuleCollider capsuleCollider = gameObject.AddComponent<CapsuleCollider>();
        capsuleCollider.height = 2f;
        capsuleCollider.radius = 0.5f;

        // Mesh Collider - Theo hình dạng mesh
        // ✅ Dùng cho: Complex terrain, detailed objects
        MeshCollider meshCollider = gameObject.AddComponent<MeshCollider>();
        meshCollider.convex = true; // Phải convex để có thể di chuyển
        meshCollider.cookingOptions = MeshColliderCookingOptions.CookForFasterSimulation;
    }
}
```

### Collider Properties chi tiết

```csharp
public class ColliderProperties : MonoBehaviour
{
    void Start()
    {
        BoxCollider collider = GetComponent<BoxCollider>();

        // Kích thước và vị trí
        collider.size = new Vector3(2, 1, 3);
        collider.center = new Vector3(0, 0.5f, 0);

        // Vật liệu va chạm (Unity 6: PhysicsMaterial)
        PhysicMaterial bouncyMaterial = new PhysicMaterial("Bouncy");
        bouncyMaterial.bounciness = 0.8f;
        bouncyMaterial.dynamicFriction = 0.1f;
        bouncyMaterial.staticFriction = 0.1f;
        collider.material = bouncyMaterial;

        // Trigger mode
        collider.isTrigger = false; // false = va chạm vật lý, true = trigger

        // Enabled
        collider.enabled = true; // Bật/tắt collider
    }
}
```

### Trigger vs Collision chi tiết

**Trigger** = Chỉ phát hiện va chạm, không có physics interaction
**Collision** = Có physics interaction (đẩy, bounce, friction)

> ⚠️ **Điều kiện để các hàm `OnTrigger...`/`OnCollision...` được gọi**:
>
> - Cả hai object đều phải có **Collider**
> - **Ít nhất một** trong hai object phải có **Rigidbody** (có thể là Kinematic)
> - Trigger: ít nhất một Collider bật **Is Trigger**; Collision: cả hai Collider đều **không** bật Is Trigger
> - Script chứa hàm phải gắn trên một trong hai GameObject đó

```csharp
public class TriggerExample : MonoBehaviour
{
    void OnTriggerEnter(Collider other)
    {
        Debug.Log($"Trigger Enter: {other.name}");

        if (other.CompareTag("Player"))
        {
            Debug.Log("Player đã vào vùng!");
            // Logic: Collect item, enter area, etc.
        }
    }

    void OnTriggerStay(Collider other)
    {
        Debug.Log($"Trigger Stay: {other.name}");
        // Logic: Damage over time, buffs, etc.
    }

    void OnTriggerExit(Collider other)
    {
        Debug.Log($"Trigger Exit: {other.name}");

        if (other.CompareTag("Player"))
        {
            Debug.Log("Player đã rời khỏi vùng!");
        }
    }
}

public class CollisionExample : MonoBehaviour
{
    void OnCollisionEnter(Collision collision)
    {
        Debug.Log($"Collision Enter: {collision.gameObject.name}");
        Debug.Log($"Impact Force: {collision.impulse.magnitude}");

        // Lấy điểm va chạm (GetContact không tạo mảng mới như collision.contacts)
        ContactPoint contact = collision.GetContact(0);
        Debug.Log($"Contact Point: {contact.point}");
        Debug.Log($"Contact Normal: {contact.normal}");

        // Logic: Damage, sound effects, particle effects
    }

    void OnCollisionStay(Collision collision)
    {
        Debug.Log($"Collision Stay: {collision.gameObject.name}");
        // Logic: Continuous damage, grinding sounds
    }

    void OnCollisionExit(Collision collision)
    {
        Debug.Log($"Collision Exit: {collision.gameObject.name}");
        // Logic: Stop effects
    }
}
```

### Collision Matrix - Kiểm soát va chạm

**Collision Matrix** cho phép bạn kiểm soát **object nào va chạm với object nào**. Cách thường dùng nhất là chỉnh trong Editor: **Edit → Project Settings → Physics → Layer Collision Matrix** (bỏ tick cặp layer không cần va chạm). Hoặc làm bằng code:

```csharp
using System.Linq; // Cho .Select() và .ToArray() (LINQ - thư viện xử lý collection của C#)
using UnityEngine;

public class CollisionMatrixExample : MonoBehaviour
{
    void Start()
    {
        // Disable collision giữa Player và Enemy
        Physics.IgnoreCollision(
            GameObject.FindWithTag("Player").GetComponent<Collider>(),
            GameObject.FindWithTag("Enemy").GetComponent<Collider>()
        );

        // Disable collision giữa layers
        Physics.IgnoreLayerCollision(
            LayerMask.NameToLayer("Player"),
            LayerMask.NameToLayer("Enemy")
        );

        // Ignore collision với specific collider
        Collider playerCollider = GetComponent<Collider>();
        Collider[] enemyColliders = GameObject.FindGameObjectsWithTag("Enemy")
            .Select(go => go.GetComponent<Collider>()).ToArray();

        foreach (Collider enemyCollider in enemyColliders)
        {
            Physics.IgnoreCollision(playerCollider, enemyCollider);
        }
    }
}
```

## 🎯 3. Raycast - Phát hiện từ xa

### Raycast là gì?

**Raycast** = Phát một "tia" từ điểm A đến điểm B để phát hiện object trên đường đi.

### Raycast cơ bản

```csharp
public class RaycastExample : MonoBehaviour
{
    void Update()
    {
        // Raycast đơn giản
        RaycastHit hit;
        if (Physics.Raycast(transform.position, transform.forward, out hit, 10f))
        {
            Debug.Log($"Hit: {hit.collider.name} at distance {hit.distance}");

            // Vẽ ray trong Scene view
            Debug.DrawRay(transform.position, transform.forward * hit.distance, Color.red);
        }
        else
        {
            Debug.DrawRay(transform.position, transform.forward * 10f, Color.green);
        }
    }
}
```

### Raycast với LayerMask

```csharp
public class RaycastLayerMask : MonoBehaviour
{
    public LayerMask enemyLayerMask;
    public LayerMask groundLayerMask;

    void Update()
    {
        // Raycast chỉ với Enemy layer
        RaycastHit hit;
        if (Physics.Raycast(transform.position, transform.forward, out hit, 10f, enemyLayerMask))
        {
            Debug.Log($"Hit enemy: {hit.collider.name}");
        }

        // Raycast xuống dưới để tìm ground
        if (Physics.Raycast(transform.position, Vector3.down, out hit, 5f, groundLayerMask))
        {
            Debug.Log($"Ground distance: {hit.distance}");
        }
    }
}
```

### Multiple Raycast

```csharp
public class MultipleRaycast : MonoBehaviour
{
    void Update()
    {
        // RaycastAll - Tất cả vật thể trong đường ray
        RaycastHit[] hits = Physics.RaycastAll(transform.position, transform.forward, 10f);

        foreach (RaycastHit hit in hits)
        {
            Debug.Log($"Hit: {hit.collider.name}");
        }

        // SphereCast - Raycast với hình cầu
        if (Physics.SphereCast(transform.position, 0.5f, transform.forward, out RaycastHit sphereHit, 10f))
        {
            Debug.Log($"Sphere hit: {sphereHit.collider.name}");
        }

        // BoxCast - Raycast với hình hộp
        if (Physics.BoxCast(transform.position, Vector3.one * 0.5f, transform.forward, out RaycastHit boxHit, transform.rotation, 10f))
        {
            Debug.Log($"Box hit: {boxHit.collider.name}");
        }

        // CapsuleCast - Raycast với hình viên nang
        if (Physics.CapsuleCast(
            transform.position + Vector3.up * 0.5f,  // Bottom
            transform.position + Vector3.up * 1.5f,  // Top
            0.5f,                                    // Radius
            transform.forward,                       // Direction
            out RaycastHit capsuleHit,              // Hit info
            10f))                                   // Distance
        {
            Debug.Log($"Capsule hit: {capsuleHit.collider.name}");
        }
    }
}
```

### Raycast từ Camera

```csharp
public class CameraRaycast : MonoBehaviour
{
    public Camera playerCamera;

    void Update()
    {
        if (Input.GetMouseButtonDown(0))
        {
            // Raycast từ vị trí chuột
            Ray ray = playerCamera.ScreenPointToRay(Input.mousePosition);
            RaycastHit hit;

            if (Physics.Raycast(ray, out hit))
            {
                Debug.Log($"Clicked on: {hit.collider.name}");

                // Làm gì đó với object được click
                if (hit.collider.CompareTag("Enemy"))
                {
                    // Tấn công enemy
                    AttackEnemy(hit.collider.gameObject);
                }
            }
        }
    }

    void AttackEnemy(GameObject enemy)
    {
        Debug.Log($"Attacking {enemy.name}!");
        // Logic tấn công
    }
}
```

## 🎮 4. Physics-based Movement

### Player Movement với Rigidbody

```csharp
public class PlayerMovement : MonoBehaviour
{
    public float moveSpeed = 5f;
    public float jumpForce = 10f;
    // Tia bắn từ TÂM nhân vật, nên phải dài hơn nửa chiều cao:
    // Capsule cao 2 → nửa chiều cao = 1, cộng thêm 0.1 dư → 1.1
    public float groundCheckDistance = 1.1f;
    public LayerMask groundLayerMask;

    private Rigidbody rb;
    private bool isGrounded;

    void Start()
    {
        rb = GetComponent<Rigidbody>();
        // Khóa xoay X/Z để nhân vật không bị ngã khi di chuyển
        rb.constraints = RigidbodyConstraints.FreezeRotationX | RigidbodyConstraints.FreezeRotationZ;
    }

    void Update()
    {
        // Kiểm tra có đang đứng trên ground không
        CheckGrounded();

        // Di chuyển
        HandleMovement();

        // Nhảy
        if (Input.GetKeyDown(KeyCode.Space) && isGrounded)
        {
            Jump();
        }
    }

    void CheckGrounded()
    {
        // Raycast xuống dưới để kiểm tra ground
        isGrounded = Physics.Raycast(transform.position, Vector3.down, groundCheckDistance, groundLayerMask);
    }

    void HandleMovement()
    {
        float horizontal = Input.GetAxis("Horizontal");
        float vertical = Input.GetAxis("Vertical");

        Vector3 movement = new Vector3(horizontal, 0, vertical) * moveSpeed;

        // Đặt vận tốc theo trục X và Z, giữ nguyên Y (để trọng lực/nhảy vẫn hoạt động)
        // Unity 6: rb.linearVelocity
        rb.velocity = new Vector3(movement.x, rb.velocity.y, movement.z);
    }

    void Jump()
    {
        rb.AddForce(Vector3.up * jumpForce, ForceMode.Impulse);
    }
}
```

### Enemy AI với Physics

```csharp
public class EnemyAI : MonoBehaviour
{
    public float moveSpeed = 3f;
    public float detectionRange = 10f;
    public float attackRange = 2f;

    private Rigidbody rb;
    private Transform player;
    private bool isChasing = false;

    void Start()
    {
        rb = GetComponent<Rigidbody>();
        player = GameObject.FindWithTag("Player").transform;
    }

    void Update()
    {
        float distanceToPlayer = Vector3.Distance(transform.position, player.position);

        if (distanceToPlayer <= detectionRange)
        {
            isChasing = true;

            if (distanceToPlayer <= attackRange)
            {
                Attack();
            }
            else
            {
                ChasePlayer();
            }
        }
        else
        {
            isChasing = false;
        }
    }

    void ChasePlayer()
    {
        Vector3 direction = (player.position - transform.position).normalized;
        rb.velocity = new Vector3(direction.x * moveSpeed, rb.velocity.y, direction.z * moveSpeed);

        // Xoay để nhìn vào player
        transform.LookAt(player);
    }

    void Attack()
    {
        // Dừng di chuyển
        rb.velocity = new Vector3(0, rb.velocity.y, 0);

        // Logic tấn công
        Debug.Log("Enemy attacking!");
    }
}
```

### Projectile với Physics

```csharp
public class Projectile : MonoBehaviour
{
    public float speed = 20f;
    public float lifetime = 5f;
    public int damage = 25;

    private Rigidbody rb;

    void Start()
    {
        rb = GetComponent<Rigidbody>();

        // Đặt vận tốc ban đầu
        rb.velocity = transform.forward * speed;

        // Tự động xóa sau lifetime
        Destroy(gameObject, lifetime);
    }

    void OnTriggerEnter(Collider other)
    {
        if (other.CompareTag("Enemy"))
        {
            // Gây sát thương
            EnemyHealth enemyHealth = other.GetComponent<EnemyHealth>();
            if (enemyHealth != null)
            {
                enemyHealth.TakeDamage(damage);
            }

            // Xóa projectile
            Destroy(gameObject);
        }
        else if (other.CompareTag("Ground"))
        {
            // Xóa khi chạm ground
            Destroy(gameObject);
        }
    }
}
```

## 🎯 5. Physics Materials chi tiết

### Physics Material là gì?

**Physics Material** định nghĩa **tính chất vật lý** của surface khi objects va chạm:

- **Friction** - Ma sát
- **Bounciness** - Độ đàn hồi
- **Combine modes** - Cách tính toán khi 2 materials va chạm

### Tạo và sử dụng Physics Material

```csharp
public class PhysicsMaterialExample : MonoBehaviour
{
    void Start()
    {
        // Tạo vật liệu bouncy (Unity 6: PhysicsMaterial / PhysicsMaterialCombine)
        PhysicMaterial bouncyMaterial = new PhysicMaterial("Bouncy");
        bouncyMaterial.bounciness = 0.8f;        // Độ đàn hồi (0-1)
        bouncyMaterial.dynamicFriction = 0.1f;   // Ma sát động (0-1)
        bouncyMaterial.staticFriction = 0.1f;    // Ma sát tĩnh (0-1)
        bouncyMaterial.bounceCombine = PhysicMaterialCombine.Multiply;
        bouncyMaterial.frictionCombine = PhysicMaterialCombine.Minimum;

        // Tạo vật liệu sticky
        PhysicMaterial stickyMaterial = new PhysicMaterial("Sticky");
        stickyMaterial.bounciness = 0f;           // Không đàn hồi
        stickyMaterial.staticFriction = 1f;      // Ma sát tĩnh cao
        stickyMaterial.dynamicFriction = 1f;     // Ma sát động cao

        // Tạo vật liệu ice
        PhysicMaterial iceMaterial = new PhysicMaterial("Ice");
        iceMaterial.bounciness = 0f;
        iceMaterial.staticFriction = 0.1f;       // Ma sát thấp
        iceMaterial.dynamicFriction = 0.1f;

        // Áp dụng vật liệu cho collider
        GetComponent<Collider>().material = bouncyMaterial;
    }
}
```

### Physics Material Combine Modes

```csharp
public class PhysicsMaterialCombine : MonoBehaviour
{
    void Start()
    {
        PhysicMaterial material1 = new PhysicMaterial("Material1");
        PhysicMaterial material2 = new PhysicMaterial("Material2");

        // Combine modes cho bounciness
        material1.bounceCombine = PhysicMaterialCombine.Average;    // Trung bình
        material1.bounceCombine = PhysicMaterialCombine.Minimum;   // Giá trị nhỏ nhất
        material1.bounceCombine = PhysicMaterialCombine.Maximum;   // Giá trị lớn nhất
        material1.bounceCombine = PhysicMaterialCombine.Multiply; // Nhân với nhau

        // Combine modes cho friction
        material1.frictionCombine = PhysicMaterialCombine.Average;
        material1.frictionCombine = PhysicMaterialCombine.Minimum;
        material1.frictionCombine = PhysicMaterialCombine.Maximum;
        material1.frictionCombine = PhysicMaterialCombine.Multiply;
    }
}
```

### Ví dụ thực tế: Surface Materials

```csharp
public class SurfaceMaterials : MonoBehaviour
{
    void Start()
    {
        // Concrete - Bê tông
        PhysicMaterial concrete = new PhysicMaterial("Concrete");
        concrete.bounciness = 0.1f;
        concrete.staticFriction = 0.8f;
        concrete.dynamicFriction = 0.7f;

        // Rubber - Cao su
        PhysicMaterial rubber = new PhysicMaterial("Rubber");
        rubber.bounciness = 0.6f;
        rubber.staticFriction = 1.0f;
        rubber.dynamicFriction = 0.9f;

        // Ice - Băng
        PhysicMaterial ice = new PhysicMaterial("Ice");
        ice.bounciness = 0.0f;
        ice.staticFriction = 0.1f;
        ice.dynamicFriction = 0.1f;

        // Metal - Kim loại
        PhysicMaterial metal = new PhysicMaterial("Metal");
        metal.bounciness = 0.3f;
        metal.staticFriction = 0.6f;
        metal.dynamicFriction = 0.5f;

        // Wood - Gỗ
        PhysicMaterial wood = new PhysicMaterial("Wood");
        wood.bounciness = 0.2f;
        wood.staticFriction = 0.7f;
        wood.dynamicFriction = 0.6f;
    }
}
```

## 🔗 6. Joints - Kết nối Physics Objects

### Joints là gì?

**Joints** kết nối 2 hoặc nhiều Rigidbody để tạo **physics constraints**:

- **FixedJoint** - Kết nối cố định
- **HingeJoint** - Kết nối bản lề
- **SpringJoint** - Kết nối lò xo
- **ConfigurableJoint** - Kết nối có thể cấu hình

### FixedJoint - Kết nối cố định

```csharp
public class FixedJointExample : MonoBehaviour
{
    public GameObject objectToConnect;

    void Start()
    {
        // Tạo FixedJoint
        FixedJoint fixedJoint = gameObject.AddComponent<FixedJoint>();

        // Kết nối với object khác
        fixedJoint.connectedBody = objectToConnect.GetComponent<Rigidbody>();

        // Cấu hình joint
        fixedJoint.breakForce = 1000f;  // Lực cần thiết để phá vỡ joint
        fixedJoint.breakTorque = 1000f; // Moment cần thiết để phá vỡ joint

        // Muốn ngắt kết nối thủ công (vd: khi nhấn phím), dùng: Destroy(fixedJoint);
        // KHÔNG gán connectedBody = null ở đây - nó sẽ ngắt kết nối ngay lập tức!
    }

    // Unity tự gọi hàm này khi joint bị phá vỡ (lực vượt breakForce)
    void OnJointBreak(float breakForce)
    {
        Debug.Log($"Joint broke with force: {breakForce}");
    }
}
```

### HingeJoint - Bản lề

```csharp
public class HingeJointExample : MonoBehaviour
{
    public GameObject door;

    void Start()
    {
        // Tạo HingeJoint cho door
        HingeJoint hingeJoint = door.AddComponent<HingeJoint>();

        // Cấu hình axis của rotation
        hingeJoint.axis = Vector3.up; // Xoay quanh trục Y

        // Giới hạn góc xoay
        hingeJoint.useLimits = true;
        JointLimits limits = hingeJoint.limits;
        limits.min = -90f;  // Góc tối thiểu
        limits.max = 90f;   // Góc tối đa
        hingeJoint.limits = limits;

        // Motor để tự động xoay
        hingeJoint.useMotor = true;
        JointMotor motor = hingeJoint.motor;
        motor.targetVelocity = 30f;  // Tốc độ xoay
        motor.force = 100f;          // Lực motor
        hingeJoint.motor = motor;
    }
}
```

### SpringJoint - Lò xo

```csharp
public class SpringJointExample : MonoBehaviour
{
    public GameObject target;

    void Start()
    {
        // Tạo SpringJoint
        SpringJoint springJoint = gameObject.AddComponent<SpringJoint>();

        // Kết nối với target
        springJoint.connectedBody = target.GetComponent<Rigidbody>();

        // Cấu hình spring
        springJoint.spring = 10f;        // Độ cứng của lò xo
        springJoint.damper = 1f;         // Damping (giảm dao động)
        springJoint.minDistance = 2f;    // Khoảng cách tối thiểu
        springJoint.maxDistance = 5f;    // Khoảng cách tối đa

        // Auto configure connected anchor
        springJoint.autoConfigureConnectedAnchor = true;
    }
}
```

### ConfigurableJoint - Kết nối có thể cấu hình

```csharp
public class ConfigurableJointExample : MonoBehaviour
{
    public GameObject target;

    void Start()
    {
        // Tạo ConfigurableJoint
        ConfigurableJoint configJoint = gameObject.AddComponent<ConfigurableJoint>();

        // Kết nối với target
        configJoint.connectedBody = target.GetComponent<Rigidbody>();

        // Cấu hình movement constraints
        configJoint.xMotion = ConfigurableJointMotion.Limited;    // Giới hạn X
        configJoint.yMotion = ConfigurableJointMotion.Free;       // Tự do Y
        configJoint.zMotion = ConfigurableJointMotion.Locked;    // Khóa Z

        // Cấu hình rotation constraints
        configJoint.angularXMotion = ConfigurableJointMotion.Free;
        configJoint.angularYMotion = ConfigurableJointMotion.Locked;
        configJoint.angularZMotion = ConfigurableJointMotion.Free;

        // Linear limits (SoftJointLimit chỉ có limit/bounciness/contactDistance)
        configJoint.linearLimit = new SoftJointLimit() { limit = 5f };
        // Độ "mềm" của giới hạn cấu hình riêng bằng SoftJointLimitSpring
        configJoint.linearLimitSpring = new SoftJointLimitSpring() { spring = 10f, damper = 1f };

        // Angular limits
        configJoint.angularYLimit = new SoftJointLimit() { limit = 45f };
        configJoint.angularYZLimitSpring = new SoftJointLimitSpring() { spring = 10f, damper = 1f };
    }
}
```

### Ví dụ thực tế: Rope System

```csharp
using System.Collections.Generic;
using UnityEngine;

// GameObject gắn script này là điểm treo: cần có Rigidbody với Is Kinematic = true
public class RopeSystem : MonoBehaviour
{
    public GameObject ropeSegmentPrefab;
    public int segmentCount = 10;
    public float segmentLength = 0.5f;

    private List<GameObject> ropeSegments = new List<GameObject>();

    void Start()
    {
        CreateRope();
    }

    void CreateRope()
    {
        GameObject previousSegment = gameObject;

        for (int i = 0; i < segmentCount; i++)
        {
            // Tạo rope segment
            GameObject segment = Instantiate(ropeSegmentPrefab);
            segment.transform.position = transform.position + Vector3.down * (i + 1) * segmentLength;

            // Thêm Rigidbody
            Rigidbody segmentRb = segment.GetComponent<Rigidbody>();
            if (segmentRb == null)
            {
                segmentRb = segment.AddComponent<Rigidbody>();
            }

            // Tạo ConfigurableJoint
            ConfigurableJoint joint = segment.AddComponent<ConfigurableJoint>();
            joint.connectedBody = previousSegment.GetComponent<Rigidbody>();

            // Cấu hình joint
            joint.xMotion = ConfigurableJointMotion.Locked;
            joint.yMotion = ConfigurableJointMotion.Limited;
            joint.zMotion = ConfigurableJointMotion.Locked;

            joint.angularXMotion = ConfigurableJointMotion.Free;
            joint.angularYMotion = ConfigurableJointMotion.Free;
            joint.angularZMotion = ConfigurableJointMotion.Free;

            // Linear limit + độ mềm
            joint.linearLimit = new SoftJointLimit() { limit = segmentLength };
            joint.linearLimitSpring = new SoftJointLimitSpring() { spring = 100f, damper = 10f };

            ropeSegments.Add(segment);
            previousSegment = segment;
        }
    }
}
```

## ⚡ 7. Physics Best Practices

### Performance Optimization

```csharp
public class PhysicsOptimization : MonoBehaviour
{
    void Start()
    {
        // 1. Sử dụng appropriate collision detection
        Rigidbody rb = GetComponent<Rigidbody>();

        // Discrete - Nhanh nhất, cho static objects
        rb.collisionDetectionMode = CollisionDetectionMode.Discrete;

        // Continuous - Cho fast moving objects
        rb.collisionDetectionMode = CollisionDetectionMode.Continuous;

        // ContinuousDynamic - Cho objects cần detect fast moving objects
        rb.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;

        // 2. Sử dụng appropriate interpolation
        rb.interpolation = RigidbodyInterpolation.Interpolate; // Smooth movement

        // 3. Optimize colliders
        BoxCollider boxCollider = GetComponent<BoxCollider>();
        boxCollider.size = Vector3.one; // Đơn giản nhất

        // 4. Use layers để giảm collision checks
        gameObject.layer = LayerMask.NameToLayer("Enemy");
    }
}
```

### Physics Settings Optimization

```csharp
public class PhysicsSettings : MonoBehaviour
{
    void Start()
    {
        // Cấu hình Physics Settings
        Physics.defaultSolverIterations = 6;        // Tăng độ chính xác
        Physics.defaultSolverVelocityIterations = 1; // Tăng performance

        // Gravity
        Physics.gravity = new Vector3(0, -9.81f, 0); // Realistic gravity

        // Bounce threshold
        Physics.bounceThreshold = 2f; // Objects phải có velocity > 2 để bounce

        // Sleep threshold
        Physics.sleepThreshold = 0.005f; // Objects sleep khi velocity < 0.005

        // Default contact offset
        Physics.defaultContactOffset = 0.01f; // Distance để detect contacts
    }
}
```

### Common Physics Mistakes

```csharp
public class PhysicsMistakes : MonoBehaviour
{
    // (Các đoạn dưới chỉ để minh họa - trong game thật, code input đặt trong Update,
    //  code vật lý đặt trong FixedUpdate)
    void Start()
    {
        // ❌ MISTAKE 1: Di chuyển object có Rigidbody bằng Transform.position
        // void FixedUpdate()
        // {
        //     transform.position += Vector3.forward * Time.deltaTime; // WRONG!
        // }

        // ✅ CORRECT: Sử dụng Rigidbody.velocity (Unity 6: linearVelocity) hoặc rb.MovePosition
        Rigidbody rb = GetComponent<Rigidbody>();
        rb.velocity = Vector3.forward * 5f; // CORRECT!

        // ❌ MISTAKE 2: Không kiểm tra isGrounded
        // void Update()
        // {
        //     if (Input.GetKeyDown(KeyCode.Space))
        //     {
        //         Jump(); // Có thể jump nhiều lần!
        //     }
        // }

        // ✅ CORRECT: Kiểm tra isGrounded (1.1 = nửa chiều cao nhân vật + 0.1)
        bool isGrounded = Physics.Raycast(transform.position, Vector3.down, 1.1f);
        if (Input.GetKeyDown(KeyCode.Space) && isGrounded)
        {
            Jump(); // Chỉ jump khi grounded
        }

        // ❌ MISTAKE 3: Gọi AddForce liên tục trong Update
        // void Update()
        // {
        //     rb.AddForce(Vector3.forward * 10f); // Lực phụ thuộc FPS - máy nhanh đẩy mạnh hơn!
        // }

        // ✅ CORRECT: Gọi AddForce trong FixedUpdate, hoặc đặt velocity trực tiếp
        rb.velocity = new Vector3(Input.GetAxis("Horizontal") * 5f, rb.velocity.y, 0);
    }

    void Jump()
    {
        Rigidbody rb = GetComponent<Rigidbody>();
        rb.AddForce(Vector3.up * 10f, ForceMode.Impulse);
    }
}
```

### Physics Debugging

```csharp
public class PhysicsDebugging : MonoBehaviour
{
    void Update()
    {
        // Debug raycast
        RaycastHit hit;
        if (Physics.Raycast(transform.position, transform.forward, out hit, 10f))
        {
            Debug.DrawRay(transform.position, transform.forward * hit.distance, Color.red);
            Debug.Log($"Hit: {hit.collider.name} at {hit.point}");
        }

        // Debug rigidbody info
        Rigidbody rb = GetComponent<Rigidbody>();
        if (rb != null)
        {
            Debug.Log($"Velocity: {rb.velocity.magnitude}");
            Debug.Log($"Angular Velocity: {rb.angularVelocity.magnitude}");
        }
    }

    void OnDrawGizmos()
    {
        // Draw ground check ray
        Gizmos.color = Color.green;
        Gizmos.DrawRay(transform.position, Vector3.down * 0.1f);

        // Draw detection range
        Gizmos.color = Color.yellow;
        Gizmos.DrawWireSphere(transform.position, 10f);

        // Debug collider bounds (Debug không có DrawWireCube - phải dùng Gizmos)
        Collider col = GetComponent<Collider>();
        if (col != null)
        {
            Gizmos.color = Color.blue;
            Gizmos.DrawWireCube(col.bounds.center, col.bounds.size);
        }
    }
}
```

## 🟩 8. Physics 2D - Rigidbody2D và Collider2D

### Physics 2D khác gì Physics 3D?

Unity có **2 hệ thống vật lý riêng biệt**. Game 2D (platformer, top-down...) dùng bộ **2D**, và hai bộ **không tương tác với nhau** (Collider 3D không va chạm với Collider2D).

| 3D | 2D |
| --- | --- |
| `Rigidbody` | `Rigidbody2D` |
| `BoxCollider`, `SphereCollider`, `CapsuleCollider` | `BoxCollider2D`, `CircleCollider2D`, `CapsuleCollider2D` |
| `OnCollisionEnter(Collision)` | `OnCollisionEnter2D(Collision2D)` |
| `OnTriggerEnter(Collider)` | `OnTriggerEnter2D(Collider2D)` |
| `Physics.Raycast` | `Physics2D.Raycast` |
| `Physics.OverlapSphere` | `Physics2D.OverlapCircle` |
| `ForceMode.Impulse` | `ForceMode2D.Impulse` |

### Ví dụ: Nhân vật 2D đơn giản

```csharp
using UnityEngine;

[RequireComponent(typeof(Rigidbody2D))] // Tự thêm Rigidbody2D nếu chưa có
public class Player2D : MonoBehaviour
{
    public float moveSpeed = 5f;
    public float jumpForce = 7f;
    public Transform groundCheck;      // Empty object đặt ở chân nhân vật
    public LayerMask groundLayer;

    private Rigidbody2D rb;
    private float moveX;
    private bool jumpRequested;

    void Awake()
    {
        rb = GetComponent<Rigidbody2D>();
        rb.freezeRotation = true; // Không cho nhân vật 2D bị lật
    }

    void Update()
    {
        // Đọc input trong Update
        moveX = Input.GetAxisRaw("Horizontal");

        // Kiểm tra chạm đất bằng một vòng tròn nhỏ ở chân
        bool isGrounded = Physics2D.OverlapCircle(groundCheck.position, 0.1f, groundLayer);

        if (Input.GetKeyDown(KeyCode.Space) && isGrounded)
        {
            jumpRequested = true; // Ghi nhớ, xử lý trong FixedUpdate
        }
    }

    void FixedUpdate()
    {
        // Giữ nguyên vận tốc Y (trọng lực) - Unity 6: rb.linearVelocity, bản cũ: rb.velocity
        rb.linearVelocity = new Vector2(moveX * moveSpeed, rb.linearVelocity.y);

        if (jumpRequested)
        {
            jumpRequested = false;
            rb.AddForce(Vector2.up * jumpForce, ForceMode2D.Impulse);
        }
    }

    void OnTriggerEnter2D(Collider2D other)
    {
        if (other.CompareTag("Coin"))
        {
            Debug.Log("Nhặt được xu!");
            Destroy(other.gameObject);
        }
    }
}
```

> 💡 Trong game 2D, trọng lực chỉnh bằng **Gravity Scale** của Rigidbody2D (mặc định 1). Bạn sẽ dùng lại toàn bộ kiến thức này trong **Bài 8 - Dự án cuối khóa**.

## 🎮 Bài tập thực hành nâng cao

### Bài tập 1: Advanced Physics Player Controller

Tạo Physics Player Controller với:

- Wall running và wall jumping
- Dash ability với cooldown
- Coyote time (jump grace period)
- Variable jump height (hold longer = jump higher)
- Slope sliding và slope jumping
- Physics-based grappling hook

### Bài tập 2: Physics Puzzle Game

Tạo physics puzzle với:

- Weighted objects với different masses
- Pressure plates và switches
- Moving platforms với joints
- Physics-based doors và gates
- Chain reactions với domino effects
- Time-based physics challenges

### Bài tập 3: Physics Simulation System

Tạo physics simulation với:

- Fluid simulation với particles
- Cloth simulation với joints
- Soft body physics
- Destructible environment
- Physics-based weather effects
- Realistic vehicle physics

## ✅ Checklist hoàn thành nâng cao

- [ ] Hiểu Rigidbody và các thuộc tính chi tiết
- [ ] Biết cách sử dụng AddForce với các ForceMode
- [ ] Thành thạo các loại Collider và khi nào dùng
- [ ] Phân biệt được Collision vs Trigger với best practices
- [ ] Sử dụng Raycast cho detection và AI
- [ ] Tạo movement system với Physics mượt mà
- [ ] Thành thạo Physics Materials và Combine Modes
- [ ] Sử dụng Collision Matrix để kiểm soát va chạm
- [ ] Implement Joints cho physics interactions
- [ ] Áp dụng Physics Best Practices
- [ ] Biết dùng Rigidbody2D, Collider2D và các hàm `...2D` cho game 2D
- [ ] Hoàn thành ít nhất 2 bài tập nâng cao

## 🚀 Tiếp theo

Bạn đã nắm vững Physics System cơ bản VÀ nâng cao! Giờ bạn có thể:

- Tạo realistic physics interactions
- Optimize physics performance
- Implement complex physics puzzles
- Debug physics issues effectively

**Bài tiếp theo**: [Scripting Essentials - MonoBehaviour, Input, Movement](./04-scripting-essentials.md)

---

💡 **Tips nâng cao**:

- **Physics Materials** rất quan trọng cho realistic feel
- **Joints** mở ra nhiều possibilities cho creative gameplay
- **Collision Matrix** giúp optimize performance
- **Raycast** là foundation của AI và detection systems
- **Physics Best Practices** giúp tránh common pitfalls
