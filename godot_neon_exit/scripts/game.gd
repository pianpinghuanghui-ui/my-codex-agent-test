extends Spatial

const StageLibrary = preload("res://scripts/stage_library.gd")
const PLAYER_HEIGHT = 1.75
const PLAYER_RADIUS = 0.85
const INTERACT_DISTANCE = 4.2

var stage = StageLibrary.get_stage("shinjuku_like")
var rng = RandomNumberGenerator.new()
var run_seed = 0
var playing = false
var yaw = -PI * 0.75
var pitch = 0.0
var stamina = 100.0
var sanity = 100.0
var light_power = 100.0
var elapsed = 0.0
var message_timer = 0.0
var collected = {}

var player = Spatial.new()
var camera = Camera.new()
var flashlight = SpotLight.new()
var threat = Spatial.new()
var threat_light = OmniLight.new()
var start_position = Vector3.ZERO
var exit_position = Vector3.ZERO
var colliders = []
var interactables = []
var run_nodes = []

var hud_layer = CanvasLayer.new()
var start_layer = CanvasLayer.new()
var result_layer = CanvasLayer.new()
var objective_label = Label.new()
var items_label = Label.new()
var danger_label = Label.new()
var sanity_label = Label.new()
var stamina_label = Label.new()
var light_label = Label.new()
var seed_label = Label.new()
var prompt_label = Label.new()
var result_title = Label.new()
var result_message = Label.new()

var audio_player = AudioStreamPlayer.new()
var audio_playback = null
var audio_phase = 0.0

func _ready():
    rng.randomize()
    _setup_world_roots()
    _setup_ui()
    _setup_audio()
    set_process(true)

func _setup_world_roots():
    add_child(player)
    player.add_child(camera)
    camera.current = true
    camera.fov = 72.0
    camera.translation = Vector3(0, PLAYER_HEIGHT, 0)

    flashlight.light_energy = 4.8
    flashlight.spot_range = 42.0
    flashlight.spot_angle = 34.0
    flashlight.light_color = Color(0.90, 0.98, 1.0, 1.0)
    camera.add_child(flashlight)

    var environment = WorldEnvironment.new()
    var env = Environment.new()
    env.background_mode = Environment.BG_COLOR
    env.background_color = Color(0.02, 0.02, 0.04, 1.0)
    env.fog_enabled = true
    env.fog_color = stage.palette.fog
    env.fog_depth_enabled = true
    env.fog_depth_begin = 8.0
    env.fog_depth_end = 92.0
    environment.environment = env
    add_child(environment)

    var moon = DirectionalLight.new()
    moon.rotation_degrees = Vector3(-55, 35, 0)
    moon.light_energy = 0.34
    moon.light_color = Color(0.42, 0.52, 0.72, 1.0)
    add_child(moon)

func _setup_ui():
    add_child(hud_layer)
    add_child(start_layer)
    add_child(result_layer)
    hud_layer.visible = false
    result_layer.visible = false

    var start_root = _full_overlay(start_layer, Color(0.02, 0.02, 0.04, 0.84))
    var start_box = _make_vbox(Vector2(44, 250), Vector2(660, 310))
    start_root.add_child(start_box)
    start_box.add_child(_make_label("Stage 1 / Shinjuku-like", Color(0.36, 0.95, 0.84, 1.0), true))
    start_box.add_child(_make_label("NEON EXIT", Color(1, 1, 1, 1), true))
    start_box.add_child(_make_label("Find the station pass, ward key, shrine charm, and gate fuse. Restore the exit, avoid the watcher, and escape the neon backstreets.", Color(0.84, 0.89, 0.95, 1.0), true))
    var start_button = Button.new()
    start_button.text = "Start run"
    start_button.rect_min_size = Vector2(180, 46)
    start_button.connect("pressed", self, "start_run")
    start_box.add_child(start_button)

    var result_root = _full_overlay(result_layer, Color(0.02, 0.02, 0.04, 0.90))
    var result_box = _make_vbox(Vector2(44, 250), Vector2(690, 320))
    result_root.add_child(result_box)
    result_title = _make_label("Run Ended", Color(1, 1, 1, 1), true)
    result_message = _make_label("", Color(0.84, 0.89, 0.95, 1.0), true)
    var restart_button = Button.new()
    restart_button.text = "Start another run"
    restart_button.rect_min_size = Vector2(220, 46)
    restart_button.connect("pressed", self, "start_run")
    result_box.add_child(result_title)
    result_box.add_child(result_message)
    result_box.add_child(restart_button)

    var hud_root = Control.new()
    _fill_rect(hud_root)
    hud_layer.add_child(hud_root)
    var hud_box = HBoxContainer.new()
    hud_box.rect_position = Vector2(14, 14)
    hud_box.rect_min_size = Vector2(1040, 90)
    hud_box.add_constant_override("separation", 8)
    hud_root.add_child(hud_box)

    objective_label = _hud_card(hud_box, "Objective", "Search the alleys", Vector2(390, 82))
    items_label = _hud_card(hud_box, "Items", "0 / 4", Vector2(95, 82))
    danger_label = _hud_card(hud_box, "Danger", "Low", Vector2(110, 82))
    sanity_label = _hud_card(hud_box, "Sanity", "100", Vector2(95, 82))
    stamina_label = _hud_card(hud_box, "Stamina", "100", Vector2(100, 82))
    light_label = _hud_card(hud_box, "Light", "100", Vector2(90, 82))
    seed_label = _hud_card(hud_box, "Seed", "--", Vector2(120, 82))

    prompt_label = _make_label("", Color(1, 1, 1, 1), true)
    prompt_label.align = Label.ALIGN_CENTER
    prompt_label.rect_position = Vector2(260, 650)
    prompt_label.rect_size = Vector2(760, 48)
    prompt_label.visible = false
    hud_root.add_child(prompt_label)

func _fill_rect(control):
    control.anchor_left = 0
    control.anchor_top = 0
    control.anchor_right = 1
    control.anchor_bottom = 1
    control.margin_left = 0
    control.margin_top = 0
    control.margin_right = 0
    control.margin_bottom = 0

func _full_overlay(layer, color):
    var root = Control.new()
    _fill_rect(root)
    layer.add_child(root)
    var bg = ColorRect.new()
    bg.color = color
    _fill_rect(bg)
    root.add_child(bg)
    return root

func _make_vbox(pos, min_size):
    var box = VBoxContainer.new()
    box.rect_position = pos
    box.rect_min_size = min_size
    box.add_constant_override("separation", 12)
    return box

func _make_label(text, color, wrap_text):
    var label = Label.new()
    label.text = text
    label.autowrap = wrap_text
    label.add_color_override("font_color", color)
    return label

func _hud_card(parent, title, value, min_size):
    var panel = PanelContainer.new()
    panel.rect_min_size = min_size
    parent.add_child(panel)
    var box = VBoxContainer.new()
    box.add_constant_override("separation", 2)
    panel.add_child(box)
    var title_label = _make_label(title, Color(0.62, 0.68, 0.76, 1.0), false)
    var value_label = _make_label(value, Color(1, 1, 1, 1), true)
    box.add_child(title_label)
    box.add_child(value_label)
    return value_label

func _setup_audio():
    var stream = AudioStreamGenerator.new()
    stream.mix_rate = 22050
    stream.buffer_length = 0.12
    audio_player.stream = stream
    audio_player.volume_db = -20
    add_child(audio_player)

func start_run():
    run_seed = int(OS.get_ticks_msec() % 1000000)
    rng.seed = run_seed
    playing = true
    elapsed = 0.0
    message_timer = 0.0
    yaw = -PI * 0.75
    pitch = 0.0
    stamina = 100.0
    sanity = 100.0
    light_power = 100.0
    collected.clear()
    for item in stage.items:
        collected[item.id] = false

    _clear_run_nodes()
    _build_stage()
    start_layer.visible = false
    result_layer.visible = false
    hud_layer.visible = true
    Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)
    audio_player.play()
    audio_playback = audio_player.get_stream_playback()
    _show_prompt("WASD moves, mouse looks, Shift runs, E interacts, Esc releases mouse.", 4.0)
    _update_hud()

func _clear_run_nodes():
    for node in run_nodes:
        if is_instance_valid(node):
            node.queue_free()
    run_nodes.clear()
    colliders.clear()
    interactables.clear()

func _build_stage():
    var size = int(stage.size)
    var cell = float(stage.cell_size)
    var open_edges = _generate_maze(size)
    start_position = _cell_to_world(0, 0)
    exit_position = _cell_to_world(size - 1, size - 1)
    player.translation = start_position
    player.rotation.y = yaw
    camera.rotation.x = pitch

    _add_box(Vector3.ZERO, Vector3(size * cell + 18.0, 0.18, size * cell + 18.0), stage.palette.ground, Color(0, 0, 0, 1), false)
    var rail = _add_box(_cell_to_world(2, size - 3) + Vector3(0, 6.2, 0), Vector3(size * cell, 0.9, 3.0), Color(0.15, 0.19, 0.27, 1), Color(0.03, 0.04, 0.08, 1), false)
    rail.rotation.y = 0.05

    for z in range(size):
        for x in range(size):
            var world = _cell_to_world(x, z)
            var is_start = x < 2 and z < 2
            var is_exit = x > size - 3 and z > size - 3
            if not is_start and not is_exit and rng.randf() > 0.66:
                var height = rng.randf_range(7.0, 20.0)
                var building_size = Vector3(rng.randf_range(3.0, 5.2), height, rng.randf_range(3.0, 5.2))
                _add_box(world + Vector3(0, height * 0.5, 0), building_size, stage.palette.wall, Color(0.02, 0.02, 0.05, 1), true)
                if rng.randf() > 0.42:
                    var sign_color = stage.palette.signs[rng.randi_range(0, stage.palette.signs.size() - 1)]
                    _add_neon(world + Vector3(rng.randf_range(-2.2, 2.2), rng.randf_range(2.6, 9.0), rng.randf_range(-2.2, 2.2)), sign_color, rng.randf_range(1.8, 4.4))
            if rng.randf() > 0.90:
                _add_shrine(world + Vector3(0, 0, 2.4))

            if x < size - 1 and not open_edges.has(_edge_key(x, z, x + 1, z)):
                _add_box(world + Vector3(cell * 0.5, 1.8, 0), Vector3(0.45, 3.6, cell + 0.45), stage.palette.dark, Color(0, 0, 0, 1), true)
            if z < size - 1 and not open_edges.has(_edge_key(x, z, x, z + 1)):
                _add_box(world + Vector3(0, 1.8, cell * 0.5), Vector3(cell + 0.45, 3.6, 0.45), stage.palette.dark, Color(0, 0, 0, 1), true)

    _add_neon(start_position + Vector3(2.4, 3.1, 2.4), Color(0.16, 0.91, 1.0, 1.0), 3.8)
    _add_light(start_position + Vector3(2.0, 3.0, 2.0), Color(0.16, 0.91, 1.0, 1.0), 2.6, 20.0)
    _add_exit_gate()
    _place_items()
    _create_threat()

func _generate_maze(size):
    var visited = {}
    var edges = {}
    _carve_maze(0, 0, size, visited, edges)
    for z in range(size):
        for x in range(size):
            if x < size - 1 and rng.randf() > 0.78:
                edges[_edge_key(x, z, x + 1, z)] = true
            if z < size - 1 and rng.randf() > 0.78:
                edges[_edge_key(x, z, x, z + 1)] = true
    return edges

func _carve_maze(x, z, size, visited, edges):
    visited["%s,%s" % [x, z]] = true
    var dirs = [Vector2(1, 0), Vector2(-1, 0), Vector2(0, 1), Vector2(0, -1)]
    _shuffle(dirs)
    for dir in dirs:
        var nx = x + int(dir.x)
        var nz = z + int(dir.y)
        var key = "%s,%s" % [nx, nz]
        if nx < 0 or nz < 0 or nx >= size or nz >= size or visited.has(key):
            continue
        edges[_edge_key(x, z, nx, nz)] = true
        _carve_maze(nx, nz, size, visited, edges)

func _shuffle(array):
    for i in range(array.size() - 1, 0, -1):
        var j = rng.randi_range(0, i)
        var tmp = array[i]
        array[i] = array[j]
        array[j] = tmp

func _edge_key(ax, az, bx, bz):
    var a = "%s,%s" % [ax, az]
    var b = "%s,%s" % [bx, bz]
    if a < b:
        return "%s|%s" % [a, b]
    return "%s|%s" % [b, a]

func _cell_to_world(x, z):
    var offset = (float(stage.size - 1) * stage.cell_size) * 0.5
    return Vector3(float(x) * stage.cell_size - offset, 0, float(z) * stage.cell_size - offset)

func _add_box(position, size, color, emission, solid):
    var mesh = MeshInstance.new()
    var cube = CubeMesh.new()
    cube.size = size
    mesh.mesh = cube
    mesh.translation = position
    mesh.material_override = _material(color, emission)
    add_child(mesh)
    run_nodes.append(mesh)
    if solid:
        colliders.append({"center": position, "half": size * 0.5})
    return mesh

func _material(color, emission):
    var mat = SpatialMaterial.new()
    mat.albedo_color = color
    mat.roughness = 0.82
    if emission.r + emission.g + emission.b > 0.0:
        mat.emission_enabled = true
        mat.emission = emission
        mat.emission_energy = 1.1
    return mat

func _add_neon(position, color, width):
    var sign = _add_box(position, Vector3(width, 0.12, 0.9), color, color, false)
    sign.rotation.y = rng.randf_range(-PI, PI)
    _add_light(position, color, 1.45, 14.0)

func _add_light(position, color, energy, light_range):
    var light = OmniLight.new()
    light.translation = position
    light.light_color = color
    light.light_energy = energy
    light.omni_range = light_range
    add_child(light)
    run_nodes.append(light)
    return light

func _add_shrine(position):
    var base = _add_box(position + Vector3(0, 0.35, 0), Vector3(1.2, 0.7, 0.8), Color(0.28, 0.15, 0.11, 1), Color(0.08, 0.02, 0.02, 1), false)
    var roof = _add_box(position + Vector3(0, 0.9, 0), Vector3(1.5, 0.22, 1.0), Color(0.50, 0.10, 0.10, 1), Color(0.18, 0.02, 0.02, 1), false)
    var angle = rng.randf_range(-PI, PI)
    base.rotation.y = angle
    roof.rotation.y = angle

func _add_exit_gate():
    var gate = _add_box(exit_position + Vector3(0, 2.6, 0), Vector3(4.8, 5.2, 0.5), Color(0.06, 0.22, 0.13, 1), stage.palette.exit, false)
    interactables.append({"type": "exit", "node": gate, "position": exit_position + Vector3(0, 1.8, 0)})
    _add_light(exit_position + Vector3(0, 4.2, 0), stage.palette.exit, 2.6, 24.0)

func _place_items():
    var cells = []
    for z in range(2, int(stage.size) - 1):
        for x in range(2, int(stage.size) - 1):
            if x + z > 6:
                cells.append(Vector2(x, z))
    _shuffle(cells)
    for i in range(stage.items.size()):
        var item = stage.items[i]
        var cell = cells[i]
        var pos = _cell_to_world(int(cell.x), int(cell.y)) + Vector3(0, 1.15, 0)
        var mesh = MeshInstance.new()
        var sphere = SphereMesh.new()
        sphere.radius = 0.62
        sphere.height = 1.24
        mesh.mesh = sphere
        mesh.translation = pos
        mesh.material_override = _material(item.color, item.color)
        add_child(mesh)
        run_nodes.append(mesh)
        _add_light(pos, item.color, 1.3, 9.0)
        interactables.append({"type": "item", "node": mesh, "position": pos, "item": item})

func _create_threat():
    threat = Spatial.new()
    threat.translation = _cell_to_world(int(stage.size) - 2, 2) + Vector3(0, 1.25, 0)
    add_child(threat)
    run_nodes.append(threat)

    var body = MeshInstance.new()
    var capsule = CapsuleMesh.new()
    capsule.radius = 0.7
    capsule.mid_height = 1.6
    body.mesh = capsule
    body.material_override = _material(Color(0.08, 0.02, 0.04, 1), stage.palette.threat)
    threat.add_child(body)

    var eye = MeshInstance.new()
    var eye_mesh = SphereMesh.new()
    eye_mesh.radius = 0.16
    eye.mesh = eye_mesh
    eye.translation = Vector3(0, 0.55, -0.65)
    eye.material_override = _material(Color(1, 1, 1, 1), Color(1, 1, 1, 1))
    threat.add_child(eye)
    threat_light = _add_light(threat.translation, stage.palette.threat, 2.2, 20.0)

func _process(delta):
    _fill_audio()
    if not playing:
        return
    elapsed += delta
    _move_player(delta)
    _update_threat(delta)
    _animate_items(delta)
    _update_prompt(delta)
    _update_hud()

func _input(event):
    if event is InputEventMouseMotion and playing and Input.get_mouse_mode() == Input.MOUSE_MODE_CAPTURED:
        yaw -= event.relative.x * 0.0024
        pitch = clamp(pitch - event.relative.y * 0.002, -1.22, 1.15)
        player.rotation.y = yaw
        camera.rotation.x = pitch
    elif event is InputEventKey and event.pressed:
        if event.scancode == KEY_ESCAPE:
            Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
        elif event.scancode == KEY_E:
            _interact()
        elif event.scancode == KEY_R and not playing:
            start_run()
    elif event is InputEventMouseButton and event.pressed and playing:
        Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)

func _move_player(delta):
    var x_axis = float(Input.is_key_pressed(KEY_D)) - float(Input.is_key_pressed(KEY_A))
    var z_axis = float(Input.is_key_pressed(KEY_W)) - float(Input.is_key_pressed(KEY_S))
    var input = Vector2(x_axis, z_axis)
    if input.length() > 1.0:
        input = input.normalized()
    var sprinting = Input.is_key_pressed(KEY_SHIFT) and z_axis > 0.0 and stamina > 2.0
    var speed = 8.0 if sprinting else 4.6
    if input.length() > 0.0:
        var direction = Basis(Vector3.UP, yaw).xform(Vector3(input.x, 0, -input.y)).normalized()
        var next_pos = player.translation + direction * speed * delta
        if not _collides(next_pos):
            player.translation = next_pos
        stamina = clamp(stamina + (-26.0 if sprinting else 14.0) * delta, 0.0, 100.0)
        light_power = clamp(light_power - (2.4 if sprinting else 1.2) * delta, 0.0, 100.0)
    else:
        stamina = clamp(stamina + 18.0 * delta, 0.0, 100.0)
        light_power = clamp(light_power - 0.7 * delta, 0.0, 100.0)

func _collides(position):
    for col in colliders:
        var center = col.center
        var half = col.half
        if abs(position.x - center.x) < half.x + PLAYER_RADIUS and abs(position.z - center.z) < half.z + PLAYER_RADIUS:
            return true
    return false

func _update_threat(delta):
    var to_player = player.translation - threat.translation
    var distance = to_player.length()
    var light_penalty = 1.0 - light_power / 100.0
    var alert = clamp(1.0 - distance / 38.0 + light_penalty * 0.25, 0.0, 1.0)
    if distance < 48.0:
        var dir = Vector3(to_player.x, 0, to_player.z).normalized()
        var next = threat.translation + dir * (3.25 * (0.65 + alert * 1.25)) * delta
        if not _collides(next):
            threat.translation = next
            threat_light.translation = next
        threat.look_at(Vector3(player.translation.x, threat.translation.y, player.translation.z), Vector3.UP)
    sanity = clamp(sanity - (alert * 7.0 + (5.0 if light_power < 15.0 else 0.0)) * delta, 0.0, 100.0)
    if distance < 2.25:
        _end_run(false, "The watcher caught you in the alley static.")
    elif sanity <= 0.0:
        _end_run(false, "Your map of the streets collapsed into noise.")

func _animate_items(delta):
    for entry in interactables:
        if entry.type != "item":
            continue
        var node = entry.node
        if not node.visible:
            continue
        node.rotation.y += delta * 1.8
        node.translation.y = entry.position.y + sin(elapsed * 3.0 + entry.position.x) * 0.12

func _best_target():
    var best = {}
    var forward = -camera.global_transform.basis.z.normalized()
    for entry in interactables:
        var node = entry.node
        if entry.type == "item" and not node.visible:
            continue
        var offset = entry.position - camera.global_transform.origin
        var distance = offset.length()
        if distance > INTERACT_DISTANCE:
            continue
        var dot = forward.dot(offset.normalized())
        if dot > 0.72 and (best.empty() or distance < best.distance):
            best = entry.duplicate()
            best.distance = distance
    return best

func _interact():
    if not playing:
        return
    var target = _best_target()
    if target.empty():
        _show_prompt("Nothing useful is within reach.", 1.2)
        return
    if target.type == "item":
        var item = target.item
        collected[item.id] = true
        target.node.visible = false
        _show_prompt("%s collected. %s" % [item.label, item.hint], 2.5)
    elif target.type == "exit":
        if _collected_count() >= stage.items.size():
            _end_run(true, "You powered the gate and escaped into the first train glow.")
        else:
            _show_prompt("The exit gate is dark. It needs every target item.", 2.0)

func _update_prompt(delta):
    if message_timer > 0.0:
        message_timer -= delta
        if message_timer <= 0.0:
            prompt_label.visible = false
        return
    var target = _best_target()
    if target.empty():
        prompt_label.visible = false
    elif target.type == "item":
        prompt_label.text = "Press E to take %s" % target.item.label
        prompt_label.visible = true
    else:
        prompt_label.text = "Press E to escape" if _collected_count() >= stage.items.size() else "Exit locked: collect every target item"
        prompt_label.visible = true

func _show_prompt(text, seconds):
    prompt_label.text = text
    prompt_label.visible = true
    message_timer = seconds

func _update_hud():
    var missing = []
    for item in stage.items:
        if not collected.get(item.id, false):
            missing.append(item)
    if missing.empty():
        objective_label.text = "All items found. Reach the green exit lantern."
    else:
        objective_label.text = "Find %s. %s" % [missing[0].label, missing[0].hint]
    items_label.text = "%s / %s" % [_collected_count(), stage.items.size()]
    var distance = player.translation.distance_to(threat.translation)
    var danger = clamp(1.0 - distance / 38.0 + (1.0 - light_power / 100.0) * 0.25, 0.0, 1.0)
    danger_label.text = "Extreme" if danger > 0.7 else ("Near" if danger > 0.42 else ("Rising" if danger > 0.2 else "Low"))
    danger_label.add_color_override("font_color", Color(0.98, 0.44, 0.52, 1) if danger > 0.7 else (Color(0.98, 0.80, 0.08, 1) if danger > 0.42 else Color(1, 1, 1, 1)))
    sanity_label.text = str(ceil(sanity))
    stamina_label.text = str(ceil(stamina))
    light_label.text = str(ceil(light_power))
    seed_label.text = str(run_seed)
    flashlight.light_energy = 1.8 + (light_power / 100.0) * 5.0

func _collected_count():
    var count = 0
    for item in stage.items:
        if collected.get(item.id, false):
            count += 1
    return count

func _end_run(success, text):
    if not playing:
        return
    playing = false
    Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
    hud_layer.visible = false
    result_layer.visible = true
    result_title.text = "You Escaped" if success else "You Were Lost"
    result_title.add_color_override("font_color", stage.palette.exit if success else stage.palette.threat)
    result_message.text = text

func _fill_audio():
    if audio_playback == null:
        return
    var frames = audio_playback.get_frames_available()
    var base_freq = 52.0 if playing else 38.0
    var danger_freq = 92.0 if playing and player.translation.distance_to(threat.translation) < 16.0 else 0.0
    for _i in range(frames):
        var sample = sin(audio_phase) * 0.028
        if danger_freq > 0.0:
            sample += sin(audio_phase * (danger_freq / base_freq)) * 0.018
        audio_playback.push_frame(Vector2(sample, sample))
        audio_phase += TAU * base_freq / 22050.0
        if audio_phase > TAU:
            audio_phase -= TAU
