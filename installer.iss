; TystText Inno Setup Script
; Genererar en enda .exe som installerar allt användaren behöver.
; KB-Whisper-modeller laddas ned vid första användning (håller exe:n liten).

#define MyAppName "TystText"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "TystText"
#define MyAppURL "https://github.com/Pluggentipsar/transav"
#define MyAppExeName "starta.bat"

[Setup]
AppId={{E8A2F5C1-3D4B-4E6F-9A1C-2B7D8E5F0A3C}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
; Ingen admin krävs — installerar i användarens programmapp
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputBaseFilename=TystText-Setup-{#MyAppVersion}
; Solid komprimering — bäst för många filer
Compression=lzma2/ultra64
SolidCompression=yes
; Visa framsteg
ShowLanguageDialog=no
; Disk space
DiskSpanning=no
; Inställningar
SetupIconFile=frontend\public\favicon.ico
WizardStyle=modern
WizardSizePercent=120

[Languages]
Name: "swedish"; MessagesFile: "compiler:Languages\Swedish.isl"

[Messages]
swedish.WelcomeLabel1=Välkommen till TystText
swedish.WelcomeLabel2=TystText transkriberar tal till text helt lokalt — ingen data lämnar din dator.%n%nDetta installerar:%n  - Transkriptionsmotor (KB-Whisper)%n  - Anonymisering (KB-BERT)%n  - Webbgränssnitt%n%nAI-modeller för transkription laddas ned vid första användning.
swedish.FinishedHeadingLabel=Installationen är klar!
swedish.FinishedLabel=TystText är redo att användas.%n%nStarta via genvägen på skrivbordet eller i startmenyn.

[Tasks]
Name: "desktopicon"; Description: "Skapa genväg på skrivbordet"; GroupDescription: "Genvägar:"; Flags: checked
Name: "cuda"; Description: "Installera GPU-stöd (NVIDIA CUDA) — kräver NVIDIA-grafikkort, ~2.5 GB extra"; GroupDescription: "Tillval:"; Flags: unchecked

[Files]
; Backend-kod
Source: "backend\app\*"; DestDir: "{app}\backend\app"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "backend\pyproject.toml"; DestDir: "{app}\backend"; Flags: ignoreversion

; Frontend (förbyggd)
Source: "frontend\out\*"; DestDir: "{app}\frontend\out"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "frontend\public\*"; DestDir: "{app}\frontend\public"; Flags: ignoreversion recursesubdirs createallsubdirs

; Launcher + scripts
Source: "launcher.py"; DestDir: "{app}"; Flags: ignoreversion
Source: "starta.bat"; DestDir: "{app}"; Flags: ignoreversion

; Runtime — Python embedded + alla pip-paket
Source: ".tysttext\python\*"; DestDir: "{app}\.tysttext\python"; Flags: ignoreversion recursesubdirs createallsubdirs

; Runtime — ffmpeg
Source: ".tysttext\ffmpeg\*"; DestDir: "{app}\.tysttext\ffmpeg"; Flags: ignoreversion recursesubdirs createallsubdirs

; Runtime — KB-BERT NER-modell (förpackad)
Source: ".tysttext\data\models\huggingface\*"; DestDir: "{app}\.tysttext\data\models\huggingface"; Flags: ignoreversion recursesubdirs createallsubdirs

; Step-markörer (så installera.ps1 vet att stegen redan är klara)
Source: ".tysttext\.step-python-installed"; DestDir: "{app}\.tysttext"; Flags: ignoreversion
Source: ".tysttext\.step-ffmpeg-installed"; DestDir: "{app}\.tysttext"; Flags: ignoreversion
Source: ".tysttext\.step-ner-model"; DestDir: "{app}\.tysttext"; Flags: ignoreversion

; GPU-val markör (sätts av [Code] baserat på CUDA-valet)
; Skapas dynamiskt i InitializeSetup

[Dirs]
Name: "{app}\.tysttext\data\uploads"
Name: "{app}\.tysttext\data\models"

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\frontend\public\favicon.ico"; Comment: "Starta TystText"
Name: "{group}\Avinstallera {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\frontend\public\favicon.ico"; Tasks: desktopicon; Comment: "Starta TystText — lokal transkription"

[Run]
; Erbjud att starta efter installation
Filename: "{app}\{#MyAppExeName}"; Description: "Starta TystText nu"; WorkingDir: "{app}"; Flags: nowait postinstall skipifsilent shellexec

[Code]
procedure CurStepChanged(CurStep: TSetupStep);
var
  GpuChoice: String;
  MarkerFile: String;
begin
  if CurStep = ssPostInstall then
  begin
    { Skriv GPU-val markör baserat på användarens val }
    if IsTaskSelected('cuda') then
      GpuChoice := 'cuda'
    else
      GpuChoice := 'cpu';

    MarkerFile := ExpandConstant('{app}\.tysttext\.gpu-choice');
    SaveStringToFile(MarkerFile, GpuChoice, False);

    { Skriv deps-markör }
    MarkerFile := ExpandConstant('{app}\.tysttext\.step-deps-' + GpuChoice);
    SaveStringToFile(MarkerFile, '', False);
  end;
end;

[UninstallDelete]
Type: filesandordirs; Name: "{app}\.tysttext\data"
Type: filesandordirs; Name: "{app}\.tysttext"
