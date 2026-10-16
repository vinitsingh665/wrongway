$word = New-Object -ComObject Word.Application
$word.Visible = $false
$doc = $word.Documents.Open("d:\Program Files\Wrong way\Portfolio Risk Management Framework.pdf")
$text = ""
foreach($para in $doc.Paragraphs) {
    $text += $para.Range.Text + "`n"
}
$text | Out-File -FilePath "d:\Program Files\Wrong way\pdf_content.txt" -Encoding UTF8
$doc.Close()
$word.Quit()
Write-Host "Done"
