import { Group, Stack, Text } from '@mantine/core';
import { Dropzone, type FileRejection } from '@mantine/dropzone';
import { IconMusic, IconUpload, IconX } from '@tabler/icons-react';
import { useState } from 'react';

const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
const MP3_ACCEPT = { 'audio/mpeg': ['.mp3'] };
const ICON_SIZE = 40;

type AudioDropzoneProps = {
  onDrop: (file: File) => void;
  uploading?: boolean;
  disabled?: boolean;
  hasAudio?: boolean;
};

const rejectionMessage = (rejections: FileRejection[]) => {
  const codes = rejections.flatMap((rejection) => rejection.errors.map((error) => error.code));
  if (codes.includes('file-too-large')) return 'O arquivo passa de 15 MB.';
  if (codes.includes('too-many-files')) return 'Solte um arquivo por vez.';
  return 'Só arquivos mp3 são aceitos.';
};

export function AudioDropzone({ onDrop, uploading = false, disabled = false, hasAudio = false }: AudioDropzoneProps) {
  const [rejection, setRejection] = useState<string | null>(null);

  const idleText = disabled
    ? 'Salve a leitura para anexar o áudio.'
    : hasAudio
      ? 'Arraste outro mp3 para substituir, ou clique para escolher.'
      : 'Arraste o mp3 aqui, ou clique para escolher.';

  return (
    <Stack gap={4}>
      <Dropzone
        onDrop={(files) => {
          setRejection(null);
          const [file] = files;
          if (file) onDrop(file);
        }}
        onReject={(rejections) => setRejection(rejectionMessage(rejections))}
        accept={MP3_ACCEPT}
        maxSize={MAX_AUDIO_BYTES}
        maxFiles={1}
        multiple={false}
        loading={uploading}
        disabled={disabled}
        aria-label="Área de upload do áudio"
      >
        <Group justify="center" gap="md" mih={110} style={{ pointerEvents: 'none' }}>
          <Dropzone.Accept>
            <IconUpload size={ICON_SIZE} stroke={1.5} />
          </Dropzone.Accept>
          <Dropzone.Reject>
            <IconX size={ICON_SIZE} stroke={1.5} />
          </Dropzone.Reject>
          <Dropzone.Idle>
            <IconMusic size={ICON_SIZE} stroke={1.5} />
          </Dropzone.Idle>
          <Stack gap={2}>
            <Dropzone.Accept>
              <Text size="sm">Solte para enviar</Text>
            </Dropzone.Accept>
            <Dropzone.Reject>
              <Text size="sm">Só mp3, até 15 MB</Text>
            </Dropzone.Reject>
            <Dropzone.Idle>
              <Text size="sm" c={disabled ? 'dimmed' : undefined}>
                {idleText}
              </Text>
            </Dropzone.Idle>
            <Text size="xs" c="dimmed">
              mp3 · até 15 MB
            </Text>
          </Stack>
        </Group>
      </Dropzone>
      {rejection && (
        <Text size="sm" c="red" role="alert">
          {rejection}
        </Text>
      )}
    </Stack>
  );
}
