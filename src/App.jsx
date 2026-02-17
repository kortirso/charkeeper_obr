import { createSignal, For, Show, batch, onMount, onCleanup } from 'solid-js';
import OBR from '@owlbear-rodeo/sdk';
import { createConsumer } from '@rails/actioncable';

import './App.css'

function App() {
  const [region, setRegion] = createSignal('ru');
  const [campaignId, setCampaignId] = createSignal('');
  const [messages, setMessages] = createSignal([]);

  const [userRole, setUserRole] = createSignal(undefined);
  const [activeConsumer, setActiveConsumer] = createSignal(undefined);

  const checkCampaign = () => {
    const host = region() === 'ru' ? 'charkeeper.ru' : 'charkeeper.org';
    const url = `https://${host}/owlbear/campaigns/${campaignId()}`;
    return fetch(url, { method: 'GET' })
      .then((response) => response.json())
      .then((data) => data)
      .catch(() => { return { errors_list: ['Internal server error, an error report has been sent to the developer!'] } });
  }

  const connectToCable = () => {
    if (activeConsumer()) return;
    if (campaignId().length === 0) return;

    const host = region() === 'ru' ? 'charkeeper.ru' : 'charkeeper.org';
    const consumer = createConsumer(`wss://${host}/cable`);
    const campaignChannel = consumer.subscriptions.create(
      { channel: 'CampaignChannel', campaign_id: campaignId() },
      {
        connected() {
          console.log('Connected to the channel:', this);
        },
        disconnected() {
          console.log('Disconnected');
        },
        received(data) {
          if (data.message) setMessages([data.message].concat(messages()));
        }
      }
    )
    setActiveConsumer(consumer);
  }

  onMount(() => {
    const readMetadata = async () => {
      const metadata = await OBR.room.getMetadata();
      const role = await OBR.player.getRole();
      const theme = await OBR.theme.getTheme();

      if (theme.mode === 'DARK') {
        document.getElementById('body').className += ' dark'; 
      }
    
      batch(() => {
        setRegion(metadata.region);
        setCampaignId(metadata.charkeeperChannelId);
        setUserRole(role);
      });

      const result = await checkCampaign();
      if (!!result.errors) {
        setMessages(result.errors.concat(messages()));
      } else {
        connectToCable();
      }
    }

    const checkRoom = async () => {
      if (OBR.scene.messageBus.ready) {
        clearInterval(interval)

        readMetadata();
      }
    }
    const interval = setInterval(() => { checkRoom() }, 1000);
    
    onCleanup(() => clearInterval(interval));
  });

  const submitCampaign = async () => {
    if (userRole() !== 'GM') return setMessages(['Forbidden'].concat(messages())); // disable for users
    if (campaignId().length === 0) return; // disable for empty ID

    const result = await checkCampaign();
    if (!!result.errors) {
      setMessages(result.errors.concat(messages()));
    } else {
      await OBR.room.setMetadata({ 'region': region(), 'charkeeperChannelId': campaignId() });
      connectToCable();
    }
  }

  const disconnectCampaign = async () => {
    if (userRole() !== 'GM') return setMessages(['Forbidden'].concat(messages())); // disable for users
    if (!activeConsumer()) return;

    activeConsumer().disconnect();
    await OBR.room.setMetadata({ 'region': 'ru', 'charkeeperChannelId': '' });
    batch(() => {
      setActiveConsumer(undefined);
      setCampaignId('');
    });
  }

  return (
    <>
      <Show when={userRole() === 'GM'}>
        <Show
          when={!activeConsumer()}
          fallback={
            <div id="logout">
              <p onClick={disconnectCampaign}>Disconnect</p>
            </div>
          }
        >
          <div id="login">
            <select value={region()} onInput={(e) => setRegion(event.currentTarget.value)}>
              <For each={['en', 'ru']}>
                {(option) => <option value={option}>{option}</option>}
              </For>
            </select>
            <input placeholder="Campaign ID" value={campaignId()} onInput={(e) => setCampaignId(e.target.value)} />
            <p onClick={submitCampaign}>Connect</p>
          </div>
        </Show>
      </Show>
      <div id="content">
        <For each={messages()}>
          {(message) =>
            <div class="message" innerHTML={message} />
          }
        </For>
      </div>
    </>
  )
}

export default App
