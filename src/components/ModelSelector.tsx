import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useLLMModel, LLM_MODELS, LLMModel } from '@/hooks/use-llm-model'
import { Sparkle, Eye } from '@phosphor-icons/react'

export function ModelSelector() {
  const { standardModel, setStandardModel, visionModel, setVisionModel } = useLLMModel()

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkle className="text-primary" size={20} />
            <CardTitle className="text-base">Standard-Modell</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Für Notizen, Aufgaben und Karteikarten
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="standard-model" className="text-sm">Modell</Label>
            <Select value={standardModel} onValueChange={(value) => setStandardModel(value as LLMModel)}>
              <SelectTrigger id="standard-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LLM_MODELS.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{model.label}</span>
                      <span className="text-xs text-muted-foreground">{model.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Eye className="text-primary" size={20} />
            <CardTitle className="text-base">Vision-Modell</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Für Handschrifterkennung und Bildanalyse
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="vision-model" className="text-sm">Modell</Label>
            <Select value={visionModel} onValueChange={(value) => setVisionModel(value as LLMModel)}>
              <SelectTrigger id="vision-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LLM_MODELS.filter(m => m.value.includes('4o') || m.value.includes('4-turbo')).map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{model.label}</span>
                      <span className="text-xs text-muted-foreground">{model.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
