# 🖥️ Bài 5: UI System - Cơ bản và Nâng cao

## 🎯 Mục tiêu bài học

- Hiểu Canvas và Canvas Scaler với best practices
- Thành thạo các UI Elements (Text, Button, Image, Slider) và TextMeshPro
- Sử dụng Event System hiệu quả với custom handlers
- Tạo Button onClick events và drag & drop
- Quản lý Scene và Scene transitions mượt mà
- Tạo Health bar và Score display với animations
- Thành thạo Layout Groups cho responsive UI
- Hiểu Anchors và Pivots chi tiết
- Tạo Responsive Design cho multiple screen sizes
- Sử dụng TextMeshPro cho typography chuyên nghiệp

> 💡 **Chuẩn bị trước khi code UI**:
>
> - Các script UI cần thêm `using` ở đầu file (các ví dụ bên dưới lược bỏ cho gọn):
>
>   ```csharp
>   using UnityEngine;
>   using UnityEngine.UI;              // Canvas Scaler, Button, Image, Slider, Text, Layout Groups
>   using UnityEngine.EventSystems;    // EventSystem, IPointerClickHandler, PointerEventData...
>   using UnityEngine.SceneManagement; // SceneManager (phần 7)
>   using TMPro;                       // TextMeshProUGUI, TextAlignmentOptions
>   using System.Collections;          // IEnumerator (Coroutine)
>   ```
>
> - Cách nhanh nhất để tạo UI là dùng menu **GameObject → UI → ...** (Unity tự tạo Canvas + EventSystem). Lần đầu tạo Text - TextMeshPro, bấm **Import TMP Essentials** khi được hỏi.
> - Các ví dụ tạo UI bằng code chỉ để hiểu cấu trúc; thực tế nên dựng UI trong Editor rồi kéo reference vào Inspector.
> - Một số ví dụ dùng `GameManager.Instance`, `PlayerHealth.Instance` - đây là các Singleton giả định (xem Bài 2, phần 7).

## 🎨 1. Canvas - Nền tảng UI chi tiết

### Canvas là gì?

**Canvas** là **container** chứa tất cả UI elements. Canvas quyết định cách UI được render và scale.

### Tại sao cần Canvas?

✅ **Canvas cung cấp**:

- **Rendering system** - Cách UI được vẽ
- **Scaling system** - Tự động scale trên các màn hình
- **Event handling** - Xử lý input cho UI
- **Sorting** - Thứ tự hiển thị UI elements

### Các loại Canvas

```csharp
public class CanvasExample : MonoBehaviour
{
    void Start()
    {
        // Lấy Canvas component
        Canvas canvas = GetComponent<Canvas>();

        // Kiểm tra loại Canvas
        if (canvas.renderMode == RenderMode.ScreenSpaceOverlay)
        {
            Debug.Log("Screen Space - Overlay Canvas");
            // ✅ Ưu điểm: Đơn giản, không cần camera
            // ❌ Nhược điểm: Không thể có 3D effects
        }
        else if (canvas.renderMode == RenderMode.ScreenSpaceCamera)
        {
            Debug.Log("Screen Space - Camera Canvas");
            // ✅ Ưu điểm: Có thể có 3D effects, depth
            // ❌ Nhược điểm: Phức tạp hơn, cần camera
        }
        else if (canvas.renderMode == RenderMode.WorldSpace)
        {
            Debug.Log("World Space Canvas");
            // ✅ Ưu điểm: UI trong 3D world
            // ❌ Nhược điểm: Phức tạp nhất
        }
    }
}
```

### Canvas Scaler - Tự động scale chi tiết

```csharp
public class CanvasScalerExample : MonoBehaviour
{
    void Start()
    {
        CanvasScaler scaler = GetComponent<CanvasScaler>();

        // Scale với Screen Size - Phổ biến nhất
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1920, 1080); // Reference resolution
        scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
        scaler.matchWidthOrHeight = 0.5f; // 0 = match width, 1 = match height

        // Scale với Constant Physical Size - Cho VR/AR
        // scaler.uiScaleMode = CanvasScaler.ScaleMode.ConstantPhysicalSize;
        // scaler.physicalUnit = CanvasScaler.Unit.Millimeters;

        // Scale với Constant Pixel Size - Cho pixel art games
        // scaler.uiScaleMode = CanvasScaler.ScaleMode.ConstantPixelSize;
    }
}
```

### Canvas Scaler Modes chi tiết

```csharp
public class CanvasScalerModes : MonoBehaviour
{
    void Start()
    {
        CanvasScaler scaler = GetComponent<CanvasScaler>();

        // Scale With Screen Size - Responsive design
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1920, 1080);

        // Screen Match Modes
        scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
        scaler.matchWidthOrHeight = 0.5f; // Balance between width and height

        // scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidth;
        // scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchHeight;

        // Expand - UI có thể lớn hơn reference resolution
        scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.Expand;

        // Shrink - UI có thể nhỏ hơn reference resolution
        scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.Shrink;
    }
}
```

### Tạo Canvas programmatically

```csharp
public class CreateCanvas : MonoBehaviour
{
    void Start()
    {
        // Tạo Canvas
        GameObject canvasGO = new GameObject("Canvas");
        Canvas canvas = canvasGO.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;

        // Thêm CanvasScaler
        CanvasScaler scaler = canvasGO.AddComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1920, 1080);

        // Thêm GraphicRaycaster
        canvasGO.AddComponent<GraphicRaycaster>();

        // Thêm EventSystem
        GameObject eventSystemGO = new GameObject("EventSystem");
        eventSystemGO.AddComponent<EventSystem>();
        // StandaloneInputModule dùng Input Manager (cũ).
        // Nếu project dùng Input System (mới) thì thay bằng InputSystemUIInputModule.
        eventSystemGO.AddComponent<StandaloneInputModule>();
    }
}
```

## 📝 2. UI Elements cơ bản và TextMeshPro

### Text - Hiển thị văn bản (Legacy)

```csharp
public class TextExample : MonoBehaviour
{
    public Text scoreText;
    public Text healthText;

    void Start()
    {
        // Tạo Text programmatically
        GameObject textGO = new GameObject("Score Text");
        textGO.transform.SetParent(transform);

        Text text = textGO.AddComponent<Text>();
        text.text = "Score: 0";
        // Unity 2022.2+ đổi font mặc định thành "LegacyRuntime.ttf" (bản cũ hơn dùng "Arial.ttf")
        text.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
        text.fontSize = 24;
        text.color = Color.white;

        // Đặt vị trí
        RectTransform rectTransform = textGO.GetComponent<RectTransform>();
        rectTransform.anchorMin = new Vector2(0, 1);
        rectTransform.anchorMax = new Vector2(0, 1);
        rectTransform.anchoredPosition = new Vector2(100, -50);
        rectTransform.sizeDelta = new Vector2(200, 50);
    }

    void Update()
    {
        // Cập nhật text
        if (scoreText != null)
        {
            scoreText.text = $"Score: {GameManager.Instance.score}";
        }

        if (healthText != null)
        {
            healthText.text = $"Health: {PlayerHealth.Instance.currentHealth}";
        }
    }
}
```

### TextMeshPro - Typography chuyên nghiệp

```csharp
public class TextMeshProExample : MonoBehaviour
{
    public TextMeshProUGUI scoreText;
    public TextMeshProUGUI healthText;
    public TextMeshProUGUI titleText;

    void Start()
    {
        // Tạo TextMeshPro programmatically
        GameObject textGO = new GameObject("Score Text");
        textGO.transform.SetParent(transform);

        TextMeshProUGUI tmpText = textGO.AddComponent<TextMeshProUGUI>();
        tmpText.text = "Score: <color=#00FF00>0</color>";
        tmpText.fontSize = 24;
        tmpText.color = Color.white;
        tmpText.alignment = TextAlignmentOptions.Center;

        // Rich text formatting
        tmpText.text = "Score: <b>1000</b> <i>points</i>";
        tmpText.text = "Health: <color=#FF0000>50</color>/100";
        tmpText.text = "Damage: <size=30>25</size>";

        // Đặt RectTransform
        RectTransform rectTransform = textGO.GetComponent<RectTransform>();
        rectTransform.anchorMin = new Vector2(0, 1);
        rectTransform.anchorMax = new Vector2(0, 1);
        rectTransform.anchoredPosition = new Vector2(100, -50);
        rectTransform.sizeDelta = new Vector2(200, 50);
    }

    void Update()
    {
        // Cập nhật TextMeshPro với rich text
        if (scoreText != null)
        {
            scoreText.text = $"Score: <color=#00FF00>{GameManager.Instance.score:N0}</color>";
        }

        if (healthText != null)
        {
            // Ép kiểu float để tránh chia số nguyên (vd 50 / 100 = 0 nếu cả hai là int)
            float healthPercent = (float)PlayerHealth.Instance.currentHealth / PlayerHealth.Instance.maxHealth;
            string healthColor = healthPercent > 0.6f ? "#00FF00" : healthPercent > 0.3f ? "#FFFF00" : "#FF0000";
            healthText.text = $"Health: <color={healthColor}>{PlayerHealth.Instance.currentHealth:F0}</color>/<color=#FFFFFF>{PlayerHealth.Instance.maxHealth:F0}</color>";
        }
    }
}
```

### TextMeshPro Advanced Features

```csharp
public class TextMeshProAdvanced : MonoBehaviour
{
    public TextMeshProUGUI animatedText;
    public TextMeshProUGUI gradientText;

    void Start()
    {
        // Animated text
        StartCoroutine(AnimateText());

        // Gradient text
        SetupGradientText();

        // Text effects
        SetupTextEffects();
    }

    IEnumerator AnimateText()
    {
        string originalText = "Loading...";
        animatedText.text = originalText;

        while (true)
        {
            for (int i = 0; i <= 3; i++)
            {
                animatedText.text = originalText + new string('.', i);
                yield return new WaitForSeconds(0.5f);
            }
        }
    }

    void SetupGradientText()
    {
        // Gradient text với rich text
        // (Cần tạo Color Gradient Preset tên "red_to_blue"... trong thư mục Resources/Color Gradient Presets)
        gradientText.text = "<gradient=\"red_to_blue\">Gradient Text</gradient>";

        // Multiple gradients
        gradientText.text = "<gradient=\"red_to_yellow\">Red to Yellow</gradient> <gradient=\"blue_to_green\">Blue to Green</gradient>";
    }

    void SetupTextEffects()
    {
        // Text với effects
        animatedText.text = "<b>Bold</b> <i>Italic</i> <u>Underline</u>";
        animatedText.text = "<s>Strikethrough</s> <sup>Superscript</sup> <sub>Subscript</sub>";
        animatedText.text = "<mark=#FFFF00>Highlighted</mark> <link=\"https://unity.com\">Link</link>";
    }
}
```

### Button - Nút bấm chi tiết

```csharp
public class ButtonExample : MonoBehaviour
{
    public Button startButton;
    public Button pauseButton;
    public Button quitButton;

    void Start()
    {
        // Tạo Button programmatically
        GameObject buttonGO = new GameObject("Start Button");
        buttonGO.transform.SetParent(transform);

        Button button = buttonGO.AddComponent<Button>();
        Image buttonImage = buttonGO.AddComponent<Image>();
        button.targetGraphic = buttonImage;

        // Button colors
        ColorBlock colors = button.colors;
        colors.normalColor = Color.white;
        colors.highlightedColor = Color.yellow;
        colors.pressedColor = Color.gray;
        colors.selectedColor = Color.cyan;
        colors.disabledColor = Color.gray;
        button.colors = colors;

        // Thêm Text vào Button
        GameObject textGO = new GameObject("Text");
        textGO.transform.SetParent(buttonGO.transform);

        TextMeshProUGUI buttonText = textGO.AddComponent<TextMeshProUGUI>();
        buttonText.text = "Start Game";
        buttonText.fontSize = 18;
        buttonText.color = Color.black;
        buttonText.alignment = TextAlignmentOptions.Center;

        // Đặt RectTransform cho Text
        RectTransform textRect = textGO.GetComponent<RectTransform>();
        textRect.anchorMin = Vector2.zero;
        textRect.anchorMax = Vector2.one;
        textRect.offsetMin = Vector2.zero;
        textRect.offsetMax = Vector2.zero;

        // Thêm onClick event
        button.onClick.AddListener(OnStartButtonClick);
    }

    void OnStartButtonClick()
    {
        Debug.Log("Start Button clicked!");
        // Logic bắt đầu game
    }

    void OnPauseButtonClick()
    {
        Debug.Log("Pause Button clicked!");
        // Logic pause game
    }

    void OnQuitButtonClick()
    {
        Debug.Log("Quit Button clicked!");
        Application.Quit();
    }
}
```

### Image - Hiển thị hình ảnh chi tiết

```csharp
public class ImageExample : MonoBehaviour
{
    public Image healthBar;
    public Image playerAvatar;
    public Sprite[] avatarSprites;

    void Start()
    {
        // Tạo Image programmatically
        GameObject imageGO = new GameObject("Health Bar");
        imageGO.transform.SetParent(transform);

        Image image = imageGO.AddComponent<Image>();
        image.color = Color.red;
        image.type = Image.Type.Filled; // Filled, Simple, Sliced, Tiled

        // Đặt RectTransform
        RectTransform rectTransform = imageGO.GetComponent<RectTransform>();
        rectTransform.anchorMin = new Vector2(0, 0);
        rectTransform.anchorMax = new Vector2(1, 0);
        rectTransform.anchoredPosition = new Vector2(0, 50);
        rectTransform.sizeDelta = new Vector2(0, 20);
    }

    void Update()
    {
        // Cập nhật health bar
        if (healthBar != null)
        {
            float healthPercent = (float)PlayerHealth.Instance.currentHealth / PlayerHealth.Instance.maxHealth;
            healthBar.fillAmount = healthPercent;

            // Đổi màu theo health
            if (healthPercent > 0.6f)
            {
                healthBar.color = Color.green;
            }
            else if (healthPercent > 0.3f)
            {
                healthBar.color = Color.yellow;
            }
            else
            {
                healthBar.color = Color.red;
            }
        }

        // Thay đổi avatar
        if (playerAvatar != null && avatarSprites.Length > 0)
        {
            int avatarIndex = Mathf.FloorToInt(Time.time) % avatarSprites.Length;
            playerAvatar.sprite = avatarSprites[avatarIndex];
        }
    }
}
```

### Slider - Thanh trượt chi tiết

```csharp
public class SliderExample : MonoBehaviour
{
    public Slider volumeSlider;
    public Slider brightnessSlider;

    void Start()
    {
        // Tạo Slider programmatically
        GameObject sliderGO = new GameObject("Volume Slider");
        sliderGO.transform.SetParent(transform);

        Slider slider = sliderGO.AddComponent<Slider>();
        slider.minValue = 0f;
        slider.maxValue = 1f;
        slider.value = 0.5f;
        slider.wholeNumbers = false; // Cho phép decimal values

        // Thêm Background
        GameObject backgroundGO = new GameObject("Background");
        backgroundGO.transform.SetParent(sliderGO.transform);

        Image background = backgroundGO.AddComponent<Image>();
        background.color = Color.gray;
        slider.targetGraphic = background;

        // Thêm Fill Area (không có component UI nào nên phải tự thêm RectTransform)
        GameObject fillAreaGO = new GameObject("Fill Area", typeof(RectTransform));
        fillAreaGO.transform.SetParent(sliderGO.transform);

        RectTransform fillAreaRect = fillAreaGO.GetComponent<RectTransform>();
        fillAreaRect.anchorMin = Vector2.zero;
        fillAreaRect.anchorMax = Vector2.one;
        fillAreaRect.offsetMin = Vector2.zero;
        fillAreaRect.offsetMax = Vector2.zero;

        // Thêm Fill
        GameObject fillGO = new GameObject("Fill");
        fillGO.transform.SetParent(fillAreaGO.transform);

        Image fill = fillGO.AddComponent<Image>();
        fill.color = Color.blue;
        slider.fillRect = fillGO.GetComponent<RectTransform>();

        // Thêm Handle
        GameObject handleGO = new GameObject("Handle");
        handleGO.transform.SetParent(sliderGO.transform);

        Image handle = handleGO.AddComponent<Image>();
        handle.color = Color.white;
        slider.handleRect = handleGO.GetComponent<RectTransform>();

        // Thêm event
        slider.onValueChanged.AddListener(OnVolumeChanged);
    }

    void OnVolumeChanged(float value)
    {
        Debug.Log($"Volume changed to: {value}");
        AudioListener.volume = value;
    }

    void OnBrightnessChanged(float value)
    {
        Debug.Log($"Brightness changed to: {value}");
        // Logic thay đổi độ sáng
    }
}
```

## 🎯 3. Event System chi tiết

### Event System cơ bản

```csharp
public class EventSystemExample : MonoBehaviour
{
    void Start()
    {
        // Lấy EventSystem
        EventSystem eventSystem = EventSystem.current;

        if (eventSystem != null)
        {
            Debug.Log("EventSystem found!");
        }
        else
        {
            Debug.Log("No EventSystem found!");
        }
    }

    void Update()
    {
        // Kiểm tra UI có được hover không
        if (EventSystem.current.IsPointerOverGameObject())
        {
            Debug.Log("Mouse over UI");
        }

        // Kiểm tra UI có được hover với touch không
        if (EventSystem.current.IsPointerOverGameObject(0))
        {
            Debug.Log("Touch over UI");
        }
    }
}
```

### Custom Event Handlers

```csharp
public class CustomEventHandler : MonoBehaviour, IPointerClickHandler, IPointerEnterHandler, IPointerExitHandler, IPointerDownHandler, IPointerUpHandler
{
    public void OnPointerClick(PointerEventData eventData)
    {
        Debug.Log("UI Element clicked!");
    }

    public void OnPointerEnter(PointerEventData eventData)
    {
        Debug.Log("Mouse entered UI Element");
        // Thay đổi màu khi hover
        GetComponent<Image>().color = Color.yellow;
    }

    public void OnPointerExit(PointerEventData eventData)
    {
        Debug.Log("Mouse exited UI Element");
        // Trở về màu ban đầu
        GetComponent<Image>().color = Color.white;
    }

    public void OnPointerDown(PointerEventData eventData)
    {
        Debug.Log("Pointer down on UI Element");
        // Scale down effect
        transform.localScale = Vector3.one * 0.95f;
    }

    public void OnPointerUp(PointerEventData eventData)
    {
        Debug.Log("Pointer up on UI Element");
        // Scale back to normal
        transform.localScale = Vector3.one;
    }
}
```

### Drag and Drop chi tiết

```csharp
// Cần thêm component CanvasGroup vào object được kéo
public class DragDropHandler : MonoBehaviour, IBeginDragHandler, IDragHandler, IEndDragHandler, IDropHandler
{
    private Vector2 originalPosition;
    private Transform originalParent;
    private Canvas canvas;
    private CanvasGroup canvasGroup;

    void Start()
    {
        canvas = GetComponentInParent<Canvas>();
        canvasGroup = GetComponent<CanvasGroup>();
    }

    public void OnBeginDrag(PointerEventData eventData)
    {
        originalPosition = transform.position;
        originalParent = transform.parent;

        // Đặt làm con của Canvas để drag trên tất cả UI
        transform.SetParent(canvas.transform);

        // Đưa xuống cuối danh sách con để vẽ trên cùng
        transform.SetAsLastSibling();

        // Cho raycast "xuyên qua" object đang kéo, để phát hiện được ô bên dưới khi thả
        canvasGroup.blocksRaycasts = false;

        Debug.Log("Begin drag");
    }

    public void OnDrag(PointerEventData eventData)
    {
        // Đúng với Canvas Screen Space - Overlay (vị trí chuột = vị trí màn hình)
        transform.position = eventData.position;
    }

    public void OnEndDrag(PointerEventData eventData)
    {
        // Kiểm tra có drop vào vùng hợp lệ không
        if (eventData.pointerCurrentRaycast.gameObject != null)
        {
            Debug.Log("Dropped on: " + eventData.pointerCurrentRaycast.gameObject.name);

            // Logic drop
            HandleDrop(eventData.pointerCurrentRaycast.gameObject);
        }
        else
        {
            // Trở về vị trí ban đầu
            transform.position = originalPosition;
            transform.SetParent(originalParent);
        }

        // Bật lại raycast
        canvasGroup.blocksRaycasts = true;

        Debug.Log("End drag");
    }

    public void OnDrop(PointerEventData eventData)
    {
        Debug.Log("Item dropped on this object");
        // Logic khi có item được drop vào
    }

    void HandleDrop(GameObject target)
    {
        // Logic xử lý drop
        if (target.CompareTag("InventorySlot"))
        {
            // Drop vào inventory slot
            transform.SetParent(target.transform);
            transform.localPosition = Vector3.zero;
        }
        else
        {
            // Trở về vị trí ban đầu
            transform.position = originalPosition;
            transform.SetParent(originalParent);
        }
    }
}
```

## 📐 4. Layout Groups - Responsive UI

### Layout Groups là gì?

**Layout Groups** tự động sắp xếp UI elements theo các quy tắc layout khác nhau.

### Horizontal Layout Group

```csharp
public class HorizontalLayoutExample : MonoBehaviour
{
    void Start()
    {
        // Tạo Horizontal Layout Group
        GameObject layoutGO = new GameObject("Horizontal Layout");
        layoutGO.transform.SetParent(transform);

        HorizontalLayoutGroup layout = layoutGO.AddComponent<HorizontalLayoutGroup>();
        layout.spacing = 10f; // Khoảng cách giữa elements
        layout.childControlWidth = true; // Tự động control width
        layout.childControlHeight = true; // Tự động control height
        layout.childForceExpandWidth = false; // Không force expand width
        layout.childForceExpandHeight = true; // Force expand height

        // Padding
        layout.padding.left = 20;
        layout.padding.right = 20;
        layout.padding.top = 10;
        layout.padding.bottom = 10;

        // Tạo buttons trong layout
        for (int i = 0; i < 5; i++)
        {
            CreateButtonInLayout(layoutGO.transform, $"Button {i + 1}");
        }
    }

    void CreateButtonInLayout(Transform parent, string buttonText)
    {
        GameObject buttonGO = new GameObject(buttonText);
        buttonGO.transform.SetParent(parent);

        Button button = buttonGO.AddComponent<Button>();
        Image buttonImage = buttonGO.AddComponent<Image>();
        button.targetGraphic = buttonImage;

        // Thêm text
        GameObject textGO = new GameObject("Text");
        textGO.transform.SetParent(buttonGO.transform);

        TextMeshProUGUI text = textGO.AddComponent<TextMeshProUGUI>();
        text.text = buttonText;
        text.fontSize = 14;
        text.color = Color.black;
        text.alignment = TextAlignmentOptions.Center;

        // Đặt RectTransform
        RectTransform textRect = textGO.GetComponent<RectTransform>();
        textRect.anchorMin = Vector2.zero;
        textRect.anchorMax = Vector2.one;
        textRect.offsetMin = Vector2.zero;
        textRect.offsetMax = Vector2.zero;
    }
}
```

### Vertical Layout Group

```csharp
public class VerticalLayoutExample : MonoBehaviour
{
    void Start()
    {
        // Tạo Vertical Layout Group
        GameObject layoutGO = new GameObject("Vertical Layout");
        layoutGO.transform.SetParent(transform);

        VerticalLayoutGroup layout = layoutGO.AddComponent<VerticalLayoutGroup>();
        layout.spacing = 5f;
        layout.childControlWidth = true;
        layout.childControlHeight = true;
        layout.childForceExpandWidth = true;
        layout.childForceExpandHeight = false;

        // Child alignment
        layout.childAlignment = TextAnchor.MiddleCenter;

        // Tạo menu items
        string[] menuItems = { "Start Game", "Settings", "Credits", "Quit" };
        foreach (string item in menuItems)
        {
            CreateMenuItem(layoutGO.transform, item);
        }
    }

    void CreateMenuItem(Transform parent, string itemText)
    {
        GameObject itemGO = new GameObject(itemText);
        itemGO.transform.SetParent(parent);

        Button button = itemGO.AddComponent<Button>();
        Image buttonImage = itemGO.AddComponent<Image>();
        button.targetGraphic = buttonImage;

        // Thêm text
        GameObject textGO = new GameObject("Text");
        textGO.transform.SetParent(itemGO.transform);

        TextMeshProUGUI text = textGO.AddComponent<TextMeshProUGUI>();
        text.text = itemText;
        text.fontSize = 18;
        text.color = Color.white;
        text.alignment = TextAlignmentOptions.Center;

        // Đặt RectTransform
        RectTransform textRect = textGO.GetComponent<RectTransform>();
        textRect.anchorMin = Vector2.zero;
        textRect.anchorMax = Vector2.one;
        textRect.offsetMin = Vector2.zero;
        textRect.offsetMax = Vector2.zero;
    }
}
```

### Grid Layout Group

```csharp
public class GridLayoutExample : MonoBehaviour
{
    void Start()
    {
        // Tạo Grid Layout Group
        GameObject layoutGO = new GameObject("Grid Layout");
        layoutGO.transform.SetParent(transform);

        GridLayoutGroup layout = layoutGO.AddComponent<GridLayoutGroup>();
        layout.cellSize = new Vector2(100, 100); // Kích thước mỗi cell
        layout.spacing = new Vector2(10, 10); // Khoảng cách giữa cells
        layout.startCorner = GridLayoutGroup.Corner.UpperLeft;
        layout.startAxis = GridLayoutGroup.Axis.Horizontal;
        layout.childAlignment = TextAnchor.MiddleCenter;

        // Constraint
        layout.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
        layout.constraintCount = 3; // 3 cột

        // Tạo grid items
        for (int i = 0; i < 12; i++)
        {
            CreateGridItem(layoutGO.transform, $"Item {i + 1}");
        }
    }

    void CreateGridItem(Transform parent, string itemText)
    {
        GameObject itemGO = new GameObject(itemText);
        itemGO.transform.SetParent(parent);

        Image image = itemGO.AddComponent<Image>();
        image.color = new Color(Random.value, Random.value, Random.value);

        // Thêm text
        GameObject textGO = new GameObject("Text");
        textGO.transform.SetParent(itemGO.transform);

        TextMeshProUGUI text = textGO.AddComponent<TextMeshProUGUI>();
        text.text = itemText;
        text.fontSize = 12;
        text.color = Color.white;
        text.alignment = TextAlignmentOptions.Center;

        // Đặt RectTransform
        RectTransform textRect = textGO.GetComponent<RectTransform>();
        textRect.anchorMin = Vector2.zero;
        textRect.anchorMax = Vector2.one;
        textRect.offsetMin = Vector2.zero;
        textRect.offsetMax = Vector2.zero;
    }
}
```

### Content Size Fitter

```csharp
public class ContentSizeFitterExample : MonoBehaviour
{
    void Start()
    {
        // Tạo Content Size Fitter
        GameObject fitterGO = new GameObject("Content Size Fitter");
        fitterGO.transform.SetParent(transform);

        ContentSizeFitter fitter = fitterGO.AddComponent<ContentSizeFitter>();
        fitter.horizontalFit = ContentSizeFitter.FitMode.PreferredSize;
        fitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;

        // Thêm Layout Group
        HorizontalLayoutGroup layout = fitterGO.AddComponent<HorizontalLayoutGroup>();
        layout.spacing = 10f;
        layout.childControlWidth = true;
        layout.childControlHeight = true;

        // Tạo buttons
        for (int i = 0; i < 3; i++)
        {
            CreateButton(fitterGO.transform, $"Button {i + 1}");
        }
    }

    void CreateButton(Transform parent, string buttonText)
    {
        GameObject buttonGO = new GameObject(buttonText);
        buttonGO.transform.SetParent(parent);

        Button button = buttonGO.AddComponent<Button>();
        Image buttonImage = buttonGO.AddComponent<Image>();
        button.targetGraphic = buttonImage;

        // Thêm text
        GameObject textGO = new GameObject("Text");
        textGO.transform.SetParent(buttonGO.transform);

        TextMeshProUGUI text = textGO.AddComponent<TextMeshProUGUI>();
        text.text = buttonText;
        text.fontSize = 14;
        text.color = Color.black;
        text.alignment = TextAlignmentOptions.Center;

        // Đặt RectTransform
        RectTransform textRect = textGO.GetComponent<RectTransform>();
        textRect.anchorMin = Vector2.zero;
        textRect.anchorMax = Vector2.one;
        textRect.offsetMin = Vector2.zero;
        textRect.offsetMax = Vector2.zero;
    }
}
```

## 📐 5. Anchors và Pivots chi tiết

### Anchors là gì?

**Anchors** định nghĩa **điểm neo** của UI element trên Canvas. Anchors quyết định cách element scale và position khi Canvas thay đổi kích thước.

### Anchor Presets

```csharp
public class AnchorExample : MonoBehaviour
{
    void Start()
    {
        RectTransform rectTransform = GetComponent<RectTransform>();

        // Anchor presets
        rectTransform.anchorMin = new Vector2(0, 0); // Bottom-left
        rectTransform.anchorMax = new Vector2(0, 0); // Bottom-left

        rectTransform.anchorMin = new Vector2(0, 1); // Top-left
        rectTransform.anchorMax = new Vector2(0, 1); // Top-left

        rectTransform.anchorMin = new Vector2(1, 1); // Top-right
        rectTransform.anchorMax = new Vector2(1, 1); // Top-right

        rectTransform.anchorMin = new Vector2(0.5f, 0.5f); // Center
        rectTransform.anchorMax = new Vector2(0.5f, 0.5f); // Center

        // Stretch horizontally
        rectTransform.anchorMin = new Vector2(0, 0.5f);
        rectTransform.anchorMax = new Vector2(1, 0.5f);

        // Stretch vertically
        rectTransform.anchorMin = new Vector2(0.5f, 0);
        rectTransform.anchorMax = new Vector2(0.5f, 1);

        // Stretch both
        rectTransform.anchorMin = new Vector2(0, 0);
        rectTransform.anchorMax = new Vector2(1, 1);
    }
}
```

### Pivot là gì?

**Pivot** định nghĩa **điểm xoay** của UI element. Pivot quyết định element xoay quanh điểm nào.

```csharp
public class PivotExample : MonoBehaviour
{
    void Start()
    {
        RectTransform rectTransform = GetComponent<RectTransform>();

        // Pivot presets
        rectTransform.pivot = new Vector2(0, 0); // Bottom-left
        rectTransform.pivot = new Vector2(0, 1); // Top-left
        rectTransform.pivot = new Vector2(1, 1); // Top-right
        rectTransform.pivot = new Vector2(1, 0); // Bottom-right
        rectTransform.pivot = new Vector2(0.5f, 0.5f); // Center

        // Custom pivot
        rectTransform.pivot = new Vector2(0.3f, 0.7f);
    }
}
```

### Anchors và Pivots trong thực tế

```csharp
public class AnchorPivotPractice : MonoBehaviour
{
    void Start()
    {
        // Health bar - Stretch horizontally, anchor to bottom
        SetupHealthBar();

        // Score display - Anchor to top-right
        SetupScoreDisplay();

        // Crosshair - Center of screen
        SetupCrosshair();

        // Inventory panel - Stretch ngang, neo ở đáy
        SetupInventoryPanel();
    }

    void SetupHealthBar()
    {
        // typeof(RectTransform): object UI cần RectTransform ngay từ đầu để GetComponent bên dưới không bị null
        GameObject healthBarGO = new GameObject("Health Bar", typeof(RectTransform));
        healthBarGO.transform.SetParent(transform);

        RectTransform rectTransform = healthBarGO.GetComponent<RectTransform>();

        // Anchor to bottom, stretch horizontally
        rectTransform.anchorMin = new Vector2(0, 0);
        rectTransform.anchorMax = new Vector2(1, 0);
        rectTransform.anchoredPosition = new Vector2(0, 50);
        rectTransform.sizeDelta = new Vector2(0, 20);

        Image healthBar = healthBarGO.AddComponent<Image>();
        healthBar.color = Color.red;
    }

    void SetupScoreDisplay()
    {
        GameObject scoreGO = new GameObject("Score Display", typeof(RectTransform));
        scoreGO.transform.SetParent(transform);

        RectTransform rectTransform = scoreGO.GetComponent<RectTransform>();

        // Anchor to top-right
        rectTransform.anchorMin = new Vector2(1, 1);
        rectTransform.anchorMax = new Vector2(1, 1);
        rectTransform.anchoredPosition = new Vector2(-100, -50);
        rectTransform.sizeDelta = new Vector2(200, 50);

        TextMeshProUGUI scoreText = scoreGO.AddComponent<TextMeshProUGUI>();
        scoreText.text = "Score: 0";
        scoreText.fontSize = 24;
        scoreText.color = Color.white;
        scoreText.alignment = TextAlignmentOptions.Right;
    }

    void SetupCrosshair()
    {
        GameObject crosshairGO = new GameObject("Crosshair", typeof(RectTransform));
        crosshairGO.transform.SetParent(transform);

        RectTransform rectTransform = crosshairGO.GetComponent<RectTransform>();

        // Center of screen
        rectTransform.anchorMin = new Vector2(0.5f, 0.5f);
        rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
        rectTransform.anchoredPosition = Vector2.zero;
        rectTransform.sizeDelta = new Vector2(50, 50);

        Image crosshair = crosshairGO.AddComponent<Image>();
        crosshair.color = Color.white;
    }

    void SetupInventoryPanel()
    {
        GameObject inventoryGO = new GameObject("Inventory Panel", typeof(RectTransform));
        inventoryGO.transform.SetParent(transform);

        RectTransform rectTransform = inventoryGO.GetComponent<RectTransform>();

        // Stretch ngang (anchorMin.x = 0, anchorMax.x = 1), neo ở đáy
        rectTransform.anchorMin = new Vector2(0, 0);
        rectTransform.anchorMax = new Vector2(1, 0);
        rectTransform.anchoredPosition = new Vector2(0, 100);
        rectTransform.sizeDelta = new Vector2(0, 200);

        Image inventory = inventoryGO.AddComponent<Image>();
        inventory.color = new Color(0, 0, 0, 0.5f);
    }
}
```

## 📱 6. Responsive Design

### Responsive Design là gì?

**Responsive Design** đảm bảo UI hoạt động tốt trên **tất cả kích thước màn hình**.

### Screen Size Detection

```csharp
public class ResponsiveDesign : MonoBehaviour
{
    void Start()
    {
        // Detect screen size
        float screenWidth = Screen.width;
        float screenHeight = Screen.height;
        float aspectRatio = screenWidth / screenHeight;

        Debug.Log($"Screen: {screenWidth}x{screenHeight}, Aspect Ratio: {aspectRatio}");

        // Adjust UI based on screen size
        AdjustUIForScreenSize(screenWidth, screenHeight, aspectRatio);
    }

    void AdjustUIForScreenSize(float width, float height, float aspectRatio)
    {
        // Màn hình dọc (aspect < 1, vd 9:16 = 0.56)
        if (aspectRatio < 1.0f)
        {
            Debug.Log("Mobile Portrait");
            AdjustForMobilePortrait();
        }
        // Gần vuông (vd tablet 4:3 = 1.33)
        else if (aspectRatio < 1.5f)
        {
            Debug.Log("Tablet");
            AdjustForTablet();
        }
        // Điện thoại nằm ngang (vd 19.5:9 = 2.17) - aspect giống desktop nên kiểm tra nền tảng
        else if (Application.isMobilePlatform)
        {
            Debug.Log("Mobile Landscape");
            AdjustForMobileLandscape();
        }
        // Desktop
        else
        {
            Debug.Log("Desktop");
            AdjustForDesktop();
        }
    }

    void AdjustForMobilePortrait()
    {
        // Larger buttons, bigger text
        AdjustButtonSizes(1.5f);
        AdjustTextSizes(1.3f);
        AdjustSpacing(1.2f);
    }

    void AdjustForMobileLandscape()
    {
        // Smaller buttons, compact layout
        AdjustButtonSizes(0.8f);
        AdjustTextSizes(0.9f);
        AdjustSpacing(0.7f);
    }

    void AdjustForTablet()
    {
        // Medium sizes
        AdjustButtonSizes(1.1f);
        AdjustTextSizes(1.1f);
        AdjustSpacing(1.0f);
    }

    void AdjustForDesktop()
    {
        // Standard sizes
        AdjustButtonSizes(1.0f);
        AdjustTextSizes(1.0f);
        AdjustSpacing(1.0f);
    }

    void AdjustButtonSizes(float multiplier)
    {
        Button[] buttons = FindObjectsByType<Button>(FindObjectsSortMode.None);
        foreach (Button button in buttons)
        {
            RectTransform rectTransform = button.GetComponent<RectTransform>();
            rectTransform.sizeDelta *= multiplier;
        }
    }

    void AdjustTextSizes(float multiplier)
    {
        TextMeshProUGUI[] texts = FindObjectsByType<TextMeshProUGUI>(FindObjectsSortMode.None);
        foreach (TextMeshProUGUI text in texts)
        {
            text.fontSize *= multiplier;
        }
    }

    void AdjustSpacing(float multiplier)
    {
        HorizontalLayoutGroup[] horizontalLayouts = FindObjectsByType<HorizontalLayoutGroup>(FindObjectsSortMode.None);
        foreach (HorizontalLayoutGroup layout in horizontalLayouts)
        {
            layout.spacing *= multiplier;
        }

        VerticalLayoutGroup[] verticalLayouts = FindObjectsByType<VerticalLayoutGroup>(FindObjectsSortMode.None);
        foreach (VerticalLayoutGroup layout in verticalLayouts)
        {
            layout.spacing *= multiplier;
        }
    }
}
```

### Dynamic UI Scaling

```csharp
public class DynamicUIScaling : MonoBehaviour
{
    public CanvasScaler canvasScaler;

    void Start()
    {
        canvasScaler = GetComponent<CanvasScaler>();

        // Listen for screen size changes
        StartCoroutine(MonitorScreenSize());
    }

    IEnumerator MonitorScreenSize()
    {
        Vector2 lastScreenSize = new Vector2(Screen.width, Screen.height);

        while (true)
        {
            Vector2 currentScreenSize = new Vector2(Screen.width, Screen.height);

            if (currentScreenSize != lastScreenSize)
            {
                Debug.Log($"Screen size changed: {lastScreenSize} -> {currentScreenSize}");
                AdjustCanvasScaler(currentScreenSize);
                lastScreenSize = currentScreenSize;
            }

            yield return new WaitForSeconds(0.1f);
        }
    }

    void AdjustCanvasScaler(Vector2 screenSize)
    {
        float aspectRatio = screenSize.x / screenSize.y;

        if (aspectRatio < 1.0f) // Màn hình dọc
        {
            canvasScaler.matchWidthOrHeight = 0f; // Match width
        }
        else if (aspectRatio > 2.0f) // Màn hình rất rộng (điện thoại nằm ngang)
        {
            canvasScaler.matchWidthOrHeight = 1f; // Match height
        }
        else if (aspectRatio < 1.5f) // Tablet
        {
            canvasScaler.matchWidthOrHeight = 0.5f; // Balance
        }
        else // Desktop
        {
            canvasScaler.matchWidthOrHeight = 0.5f; // Balance
        }
    }
}
```

## 🎮 7. Scene Management chi tiết

### Scene Loading

> ⚠️ Scene muốn load bằng code phải được thêm vào danh sách build: **File → Build Settings → Add Open Scenes** (Unity 6: **File → Build Profiles → Scene List**). Nếu không sẽ gặp lỗi "Scene couldn't be loaded because it has not been added to the build settings".

```csharp
// Không đặt tên class là "SceneManager" - sẽ trùng với UnityEngine.SceneManagement.SceneManager
public class SceneLoader : MonoBehaviour
{
    void Start()
    {
        // Load scene bằng tên
        // UnityEngine.SceneManagement.SceneManager.LoadScene("GameScene");

        // Load scene bằng index
        // UnityEngine.SceneManagement.SceneManager.LoadScene(1);

        // Load scene bất đồng bộ
        // StartCoroutine(LoadSceneAsync("GameScene"));
    }

    public void LoadGameScene()
    {
        UnityEngine.SceneManagement.SceneManager.LoadScene("GameScene");
    }

    public void LoadMenuScene()
    {
        UnityEngine.SceneManagement.SceneManager.LoadScene("MainMenu");
    }

    public void RestartCurrentScene()
    {
        string currentSceneName = UnityEngine.SceneManagement.SceneManager.GetActiveScene().name;
        UnityEngine.SceneManagement.SceneManager.LoadScene(currentSceneName);
    }

    IEnumerator LoadSceneAsync(string sceneName)
    {
        AsyncOperation asyncLoad = UnityEngine.SceneManagement.SceneManager.LoadSceneAsync(sceneName);

        // Không tự động chuyển scene khi load xong
        asyncLoad.allowSceneActivation = false;

        // Hiển thị loading progress
        while (!asyncLoad.isDone)
        {
            float progress = Mathf.Clamp01(asyncLoad.progress / 0.9f);
            Debug.Log($"Loading progress: {progress * 100}%");

            // Cập nhật loading bar
            // loadingBar.fillAmount = progress;

            if (asyncLoad.progress >= 0.9f)
            {
                // Load xong, cho phép chuyển scene
                asyncLoad.allowSceneActivation = true;
            }

            yield return null;
        }
    }
}
```

### Scene Transitions

```csharp
public class SceneTransition : MonoBehaviour
{
    public Animator transitionAnimator;
    public float transitionTime = 1f;

    public void TransitionToScene(string sceneName)
    {
        StartCoroutine(PlayTransition(sceneName));
    }

    IEnumerator PlayTransition(string sceneName)
    {
        // Play animation out
        transitionAnimator.SetTrigger("FadeOut");

        // Chờ animation hoàn thành
        yield return new WaitForSeconds(transitionTime);

        // Load scene - object này sẽ bị hủy khi scene cũ đóng (trừ khi dùng DontDestroyOnLoad),
        // nên animation "FadeIn" đặt ở scene mới (vd: Animator của màn che tự chạy FadeIn khi scene mở)
        UnityEngine.SceneManagement.SceneManager.LoadScene(sceneName);
    }
}
```

## 📊 8. Health Bar và Score Display chi tiết

### Health Bar System

```csharp
public class HealthBar : MonoBehaviour
{
    public Image healthBarFill;
    public TextMeshProUGUI healthText;
    public float maxHealth = 100f;
    public float currentHealth = 100f;

    void Start()
    {
        UpdateHealthBar();
    }

    public void TakeDamage(float damage)
    {
        currentHealth -= damage;
        currentHealth = Mathf.Clamp(currentHealth, 0, maxHealth);

        UpdateHealthBar();

        if (currentHealth <= 0)
        {
            OnDeath();
        }
    }

    public void Heal(float amount)
    {
        currentHealth += amount;
        currentHealth = Mathf.Clamp(currentHealth, 0, maxHealth);

        UpdateHealthBar();
    }

    void UpdateHealthBar()
    {
        if (healthBarFill != null)
        {
            float healthPercent = currentHealth / maxHealth;
            healthBarFill.fillAmount = healthPercent;

            // Đổi màu theo health
            if (healthPercent > 0.6f)
            {
                healthBarFill.color = Color.green;
            }
            else if (healthPercent > 0.3f)
            {
                healthBarFill.color = Color.yellow;
            }
            else
            {
                healthBarFill.color = Color.red;
            }
        }

        if (healthText != null)
        {
            healthText.text = $"{currentHealth:F0}/{maxHealth:F0}";
        }
    }

    void OnDeath()
    {
        Debug.Log("Player died!");
        // Logic khi chết
    }
}
```

### Score System

```csharp
public class ScoreSystem : MonoBehaviour
{
    public TextMeshProUGUI scoreText;
    public TextMeshProUGUI highScoreText;
    public int currentScore = 0;
    public int highScore = 0;

    void Start()
    {
        // Load high score từ PlayerPrefs
        highScore = PlayerPrefs.GetInt("HighScore", 0);
        UpdateScoreDisplay();
    }

    public void AddScore(int points)
    {
        currentScore += points;
        UpdateScoreDisplay();

        // Kiểm tra high score mới
        if (currentScore > highScore)
        {
            highScore = currentScore;
            PlayerPrefs.SetInt("HighScore", highScore);
            PlayerPrefs.Save();
        }
    }

    public void ResetScore()
    {
        currentScore = 0;
        UpdateScoreDisplay();
    }

    void UpdateScoreDisplay()
    {
        if (scoreText != null)
        {
            scoreText.text = $"Score: {currentScore:N0}";
        }

        if (highScoreText != null)
        {
            highScoreText.text = $"High Score: {highScore:N0}";
        }
    }
}
```

### UI Manager

```csharp
public class UIManager : MonoBehaviour
{
    public GameObject mainMenuPanel;
    public GameObject gamePanel;
    public GameObject pausePanel;
    public GameObject gameOverPanel;

    public HealthBar healthBar;
    public ScoreSystem scoreSystem;

    void Start()
    {
        ShowMainMenu();
    }

    public void ShowMainMenu()
    {
        HideAllPanels();
        mainMenuPanel.SetActive(true);
    }

    public void ShowGameUI()
    {
        HideAllPanels();
        gamePanel.SetActive(true);
    }

    public void ShowPauseMenu()
    {
        pausePanel.SetActive(true);
        Time.timeScale = 0f; // Pause game
    }

    public void HidePauseMenu()
    {
        pausePanel.SetActive(false);
        Time.timeScale = 1f; // Resume game
    }

    public void ShowGameOver()
    {
        HideAllPanels();
        gameOverPanel.SetActive(true);
    }

    void HideAllPanels()
    {
        mainMenuPanel.SetActive(false);
        gamePanel.SetActive(false);
        pausePanel.SetActive(false);
        gameOverPanel.SetActive(false);
    }

    public void OnStartButtonClick()
    {
        ShowGameUI();
        // Start game logic
    }

    public void OnPauseButtonClick()
    {
        ShowPauseMenu();
    }

    public void OnResumeButtonClick()
    {
        HidePauseMenu();
    }

    public void OnRestartButtonClick()
    {
        HidePauseMenu();
        // Restart game logic
    }

    public void OnQuitButtonClick()
    {
        Application.Quit();
    }
}
```

## 🎮 Bài tập thực hành nâng cao

### Bài tập 1: Responsive Main Menu

Tạo Main Menu responsive với:

- Layout Groups cho different screen sizes
- TextMeshPro với rich text formatting
- Custom event handlers với animations
- Scene transitions với loading bars
- Settings menu với sliders và dropdowns

### Bài tập 2: Advanced HUD System

Tạo HUD system với:

- Health bar với smooth animations
- Score display với TextMeshPro effects
- Mini-map với world space UI
- Weapon info với dynamic updates
- Crosshair với different styles
- Pause menu overlay với blur effect

### Bài tập 3: Inventory System UI

Tạo Inventory System với:

- Drag and drop functionality
- Grid layout với different item sizes
- Item tooltips với rich text
- Equipment slots với visual feedback
- Item stacking và splitting
- Search và filter functionality

## ✅ Checklist hoàn thành nâng cao

- [ ] Hiểu Canvas và Canvas Scaler với best practices
- [ ] Thành thạo các UI Elements và TextMeshPro
- [ ] Sử dụng Event System hiệu quả với custom handlers
- [ ] Tạo Button onClick events và drag & drop
- [ ] Quản lý Scene và transitions mượt mà
- [ ] Tạo Health bar và Score display với animations
- [ ] Thành thạo Layout Groups cho responsive UI
- [ ] Hiểu Anchors và Pivots chi tiết
- [ ] Tạo Responsive Design cho multiple screen sizes
- [ ] Sử dụng TextMeshPro cho typography chuyên nghiệp
- [ ] Hoàn thành ít nhất 2 bài tập nâng cao

## 🚀 Tiếp theo

Bạn đã nắm vững UI System cơ bản VÀ nâng cao! Giờ bạn có thể:

- Tạo responsive UI cho mọi screen size
- Sử dụng TextMeshPro cho typography chuyên nghiệp
- Implement complex UI interactions
- Design user-friendly interfaces

**Bài tiếp theo**: [Audio & Animation - Audio Source, Animator](./06-audio-animation.md)

---

💡 **Tips nâng cao**:

- **Layout Groups** là key cho responsive UI
- **TextMeshPro** mạnh hơn Text rất nhiều
- **Anchors và Pivots** quyết định UI behavior
- **Event System** mở ra nhiều possibilities
- **Responsive Design** là must-have cho modern games
